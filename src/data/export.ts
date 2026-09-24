import type { ReviewCatalog, ReviewSong, SelectionStatus } from '../types'
import type { SelectionMap } from './progress'

/**
 * Formato de exportación. Los 6 primeros campos son los acordados para el
 * script de descarga; el resto es información adicional.
 */
export interface ExportRow {
  song_id: number
  title: string | null
  artist: string | null
  video_id: string | null
  youtube_url: string | null
  status: SelectionStatus | 'pending'
  video_title: string | null
  notes: string | null
  source_text: string
  /** En filas de duplicados: id canónico del que heredan la elección */
  duplicate_of: number | null
  /** En filas canónicas: duplicados que heredan esta elección */
  duplicate_ids: number[]
}

function canonicalRow(song: ReviewSong, records: SelectionMap): ExportRow {
  const record = records[song.id]
  const row: ExportRow = {
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    video_id: null,
    youtube_url: null,
    status: record?.status ?? 'pending',
    video_title: null,
    notes: record?.notes ?? null,
    source_text: song.sourceText,
    duplicate_of: null,
    duplicate_ids: [...song.duplicateIds],
  }
  if (record?.status === 'selected' && record.selected_video_id) {
    row.video_id = record.selected_video_id
    row.youtube_url = record.selected_url
    row.video_title = record.selected_title
    // Título/artista de la interpretación que papá eligió (puede ser una alternativa).
    const group = song.groups.find((g) => g.candidates.some((c) => c.video_id === record.selected_video_id))
    const candidate = group?.candidates.find((c) => c.video_id === record.selected_video_id)
    if (group) {
      row.title = group.title ?? song.title
      row.artist = candidate?.artist || group.artist || song.artist
    }
  }
  return row
}

export function buildExportRows(
  catalog: ReviewCatalog,
  records: SelectionMap,
  options: { includeDuplicates: boolean },
): ExportRow[] {
  const rows: ExportRow[] = []
  for (const song of catalog.songs) {
    const row = canonicalRow(song, records)
    rows.push(row)
    if (!options.includeDuplicates) continue
    for (const duplicateId of song.duplicateIds) {
      rows.push({
        ...row,
        song_id: duplicateId,
        source_text: catalog.rawById.get(duplicateId)?.source_text ?? '',
        duplicate_of: song.id,
        duplicate_ids: [],
      })
    }
  }
  return rows.sort((a, b) => a.song_id - b.song_id)
}

export function toJson(rows: ExportRow[]): string {
  return `${JSON.stringify(rows, null, 2)}\n`
}

const CSV_COLUMNS: (keyof ExportRow)[] = [
  'song_id',
  'title',
  'artist',
  'video_id',
  'youtube_url',
  'status',
  'video_title',
  'notes',
  'source_text',
  'duplicate_of',
  'duplicate_ids',
]

function csvCell(value: ExportRow[keyof ExportRow]): string {
  if (value === null) return ''
  const text = Array.isArray(value) ? value.join(' ') : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** CSV RFC 4180 con BOM para que Excel reconozca el UTF-8 (caracteres chinos). */
export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(','), ...rows.map((row) => CSV_COLUMNS.map((col) => csvCell(row[col])).join(','))]
  return `﻿${lines.join('\r\n')}\r\n`
}
