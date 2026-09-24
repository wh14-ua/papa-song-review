import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, parseDataset } from './catalog'
import { buildExportRows, toCsv, toJson, type ExportRow } from './export'
import type { SelectionRecord, SelectionStatus } from '../types'

const catalog = buildCatalog(
  parseDataset(JSON.parse(readFileSync(new URL('../../public/songs.json', import.meta.url), 'utf8'))),
)

function rec(song_id: number, status: SelectionStatus, video?: { id: string; title: string }, notes: string | null = null): SelectionRecord {
  return {
    session_id: 'papa',
    song_id,
    status,
    selected_video_id: video?.id ?? null,
    selected_url: video ? `https://www.youtube.com/watch?v=${video.id}` : null,
    selected_title: video?.title ?? null,
    notes,
    created_at: '2026-09-24T10:00:00.000Z',
    updated_at: '2026-09-24T10:00:00.000Z',
  }
}

function rowFor(rows: ExportRow[], songId: number): ExportRow {
  const row = rows.find((r) => r.song_id === songId)
  if (!row) throw new Error(`row ${songId} missing`)
  return row
}

describe('buildExportRows', () => {
  const records = {
    37: rec(37, 'selected', { id: 'Yl9sIjmaZP8', title: '張學友 - 一千個傷心的理由 (Official Video)' }),
    6: rec(6, 'selected', { id: 'tTVnpfxPF4s', title: '一瞬间 汪峰' }),
    117: rec(117, 'selected', { id: 'ev7e-luzsRs', title: 'x' }),
    3: rec(3, 'none', undefined, 'quiero la versión en directo'),
  }

  it('exporta una fila por canción canónica con el formato pedido', () => {
    const rows = buildExportRows(catalog, records, { includeDuplicates: false })
    expect(rows).toHaveLength(119)
    expect(rowFor(rows, 37)).toMatchObject({
      song_id: 37,
      title: '一千个伤心的理由',
      artist: '张学友',
      video_id: 'Yl9sIjmaZP8',
      youtube_url: 'https://www.youtube.com/watch?v=Yl9sIjmaZP8',
      status: 'selected',
      video_title: '張學友 - 一千個傷心的理由 (Official Video)',
    })
    expect(Object.keys(rowFor(rows, 37)).slice(0, 6)).toEqual([
      'song_id',
      'title',
      'artist',
      'video_id',
      'youtube_url',
      'status',
    ])
  })

  it('si papá eligió una alternativa, exporta el título y artista de esa alternativa', () => {
    const rows = buildExportRows(catalog, records, { includeDuplicates: false })
    expect(rowFor(rows, 6)).toMatchObject({ title: '一瞬间', artist: '汪峰', video_id: 'tTVnpfxPF4s' })
    expect(rowFor(rows, 117)).toMatchObject({
      title: '时间能不能走慢点（青春别散场live大合唱版）',
      artist: 'Lee 木子',
      video_id: 'ev7e-luzsRs',
    })
  })

  it('exporta todas las versiones cuando papá selecciona varias', () => {
    const multi = {
      ...records,
      3: {
        ...rec(3, 'selected', { id: 'Ov_BFvQ2haU', title: 'legacy placeholder' }),
        selected_title: '__multi__:Ov_BFvQ2haU,lasUoe2Zzyk',
      },
    }
    const rows = buildExportRows(catalog, multi, { includeDuplicates: false })
    expect(rowFor(rows, 3)).toMatchObject({
      video_id: 'Ov_BFvQ2haU',
      video_ids: ['Ov_BFvQ2haU', 'lasUoe2Zzyk'],
      youtube_urls: [
        'https://www.youtube.com/watch?v=Ov_BFvQ2haU',
        'https://www.youtube.com/watch?v=lasUoe2Zzyk',
      ],
      status: 'selected',
    })
    expect(rowFor(rows, 3).video_titles).toHaveLength(2)
  })

  it('las canciones sin vídeo elegido no llevan vídeo y las no revisadas salen como pending', () => {
    const rows = buildExportRows(catalog, records, { includeDuplicates: false })
    expect(rowFor(rows, 3)).toMatchObject({
      title: '忘不了的人',
      artist: '洋澜一',
      video_id: null,
      youtube_url: null,
      status: 'none',
      notes: 'quiero la versión en directo',
    })
    expect(rowFor(rows, 5)).toMatchObject({ video_id: null, youtube_url: null, status: 'pending' })
  })

  it('las filas canónicas indican qué duplicados heredan la elección', () => {
    const rows = buildExportRows(catalog, records, { includeDuplicates: false })
    expect(rowFor(rows, 3)).toMatchObject({ duplicate_of: null, duplicate_ids: [11, 131] })
    expect(rows.some((r) => r.song_id === 11)).toBe(false)
  })

  it('con duplicados: 140 filas (sin las entradas 1 y 2) y cada duplicado hereda la elección del canónico', () => {
    const rows = buildExportRows(catalog, records, { includeDuplicates: true })
    expect(rows).toHaveLength(140)
    expect(rows.map((r) => r.song_id)).toEqual(Array.from({ length: 140 }, (_, i) => i + 3))
    expect(rowFor(rows, 74)).toMatchObject({
      song_id: 74,
      title: '一千个伤心的理由',
      artist: '张学友',
      video_id: 'Yl9sIjmaZP8',
      status: 'selected',
      duplicate_of: 37,
      source_text: '1000个伤心的理由',
    })
    expect(rowFor(rows, 131)).toMatchObject({ status: 'none', video_id: null, duplicate_of: 3 })
  })
})

describe('toCsv', () => {
  const rows: ExportRow[] = [
    {
      song_id: 3,
      title: '忘不了的人',
      artist: '洋澜一',
      video_id: null,
      youtube_url: null,
      status: 'none',
      video_title: null,
      video_ids: [],
      youtube_urls: [],
      video_titles: [],
      notes: 'dice "otra", con comas\ny salto',
      source_text: '忘不了的人',
      duplicate_of: null,
      duplicate_ids: [11, 131],
    },
  ]

  it('genera UTF-8 con BOM, cabecera y escapa comillas, comas y saltos de línea', () => {
    expect(toCsv(rows)).toBe(
      '﻿' +
        'song_id,title,artist,video_id,youtube_url,status,video_title,video_ids,youtube_urls,video_titles,notes,source_text,duplicate_of,duplicate_ids\r\n' +
        '3,忘不了的人,洋澜一,,,none,,,,,"dice ""otra"", con comas\ny salto",忘不了的人,,11 | 131\r\n',
    )
  })

  it('toJson produce un array JSON legible que se puede volver a leer', () => {
    expect(JSON.parse(toJson(rows))).toEqual(rows)
  })
})
