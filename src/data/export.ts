import type { ReviewCatalog, ReviewSong, SelectionStatus, YoutubeCandidate } from '../types'
import type { SelectionMap } from './progress'
import { selectedVideoIds } from './selectionCodec'

/**
 * Formato de exportación. Los campos singulares video_id/youtube_url/video_title
 * conservan la primera opción por compatibilidad; los arrays contienen TODAS
 * las versiones elegidas.
 */
export interface ExportRow {
  song_id: number
  title: string | null
  artist: string | null
  video_id: string | null
  youtube_url: string | null
  status: SelectionStatus | 'pending'
  video_title: string | null
  video_ids: string[]
  youtube_urls: string[]
  video_titles: string[]
  notes: string | null
  source_text: string
  /** En filas de duplicados: id canónico del que heredan la elección */
  duplicate_of: number | null
  /** En filas canónicas: duplicados que heredan esta elección */
  duplicate_ids: number[]
}

function chosenCandidates(song: ReviewSong, records: SelectionMap): YoutubeCandidate[] {
  const ids = selectedVideoIds(records[song.id])
  return ids
    .map((id) => song.candidates.find((candidate) => candidate.video_id === id))
    .filter((candidate): candidate is YoutubeCandidate => candidate !== undefined)
}

function canonicalRow(song: ReviewSong, records: SelectionMap): ExportRow {
  const record = records[song.id]
  const chosen = chosenCandidates(song, records)
  const first = chosen[0] ?? null
  const row: ExportRow = {
    song_id: song.id,
    title: song.title,
    artist: song.artist,
    video_id: first?.video_id ?? null,
    youtube_url: first?.url ?? null,
    status: record?.status ?? 'pending',
    video_title: first?.title ?? null,
    video_ids: chosen.map((candidate) => candidate.video_id),
    youtube_urls: chosen.map((candidate) => candidate.url),
    video_titles: chosen.map((candidate) => candidate.title),
    notes: record?.notes ?? null,
    source_text: song.sourceText,
    duplicate_of: null,
    duplicate_ids: [...song.duplicateIds],
  }

  // Título/artista de la interpretación de la primera versión elegida.
  if (first) {
    const group = song.groups.find((g) => g.candidates.some((c) => c.video_id === first.video_id))
    if (group) {
      row.title = group.title ?? song.title
      row.artist = first.artist || group.artist || song.artist
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
        video_ids: [...row.video_ids],
        youtube_urls: [...row.youtube_urls],
        video_titles: [...row.video_titles],
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
  'video_ids',
  'youtube_urls',
  'video_titles',
  'notes',
  'source_text',
  'duplicate_of',
  'duplicate_ids',
]

function csvCell(value: ExportRow[keyof ExportRow]): string {
  if (value === null) return ''
  const text = Array.isArray(value) ? value.join(' | ') : String(value)
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text
}

/** CSV RFC 4180 con BOM para que Excel reconozca el UTF-8 (caracteres chinos). */
export function toCsv(rows: ExportRow[]): string {
  const lines = [CSV_COLUMNS.join(','), ...rows.map((row) => CSV_COLUMNS.map((col) => csvCell(row[col])).join(','))]
  return `﻿${lines.join('\r\n')}\r\n`
}
