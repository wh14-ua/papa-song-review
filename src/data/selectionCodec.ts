import type { SelectionRecord } from '../types'

const MULTI_PREFIX = '__multi__:'
const VIDEO_ID = /^[A-Za-z0-9_-]{1,32}$/

export interface StoredVideoSelection {
  videoId: string
  url: string
  title: string
}

/**
 * Lee las versiones elegidas de una fila. Compatible con las filas antiguas
 * (una sola selección) y con el formato multi-select, que guarda la lista de
 * video_ids dentro de selected_title para no exigir una migración de Supabase.
 */
export function selectedVideoIds(record: SelectionRecord | undefined): string[] {
  if (!record || record.status !== 'selected' || !record.selected_video_id) return []

  if (record.selected_title?.startsWith(MULTI_PREFIX)) {
    const ids = record.selected_title
      .slice(MULTI_PREFIX.length)
      .split(',')
      .map((id) => id.trim())
      .filter((id) => VIDEO_ID.test(id))
    return [...new Set(ids)]
  }

  return [record.selected_video_id]
}

/**
 * Codifica una o varias selecciones usando las columnas existentes.
 * Para una sola conserva selected_title como antes. Para varias, selected_title
 * contiene únicamente los ids; título/URL se reconstruyen desde songs.json.
 */
export function encodeVideoSelections(videos: readonly StoredVideoSelection[]): {
  selected_video_id: string
  selected_url: string
  selected_title: string
} | null {
  const unique = [...new Map(videos.map((video) => [video.videoId, video])).values()]
  if (unique.length === 0) return null

  const first = unique[0]
  if (unique.length === 1) {
    return {
      selected_video_id: first.videoId,
      selected_url: first.url,
      selected_title: first.title,
    }
  }

  return {
    selected_video_id: first.videoId,
    selected_url: first.url,
    selected_title: `${MULTI_PREFIX}${unique.map((video) => video.videoId).join(',')}`,
  }
}

export function isMultiSelectionTitle(value: string | null): boolean {
  return value?.startsWith(MULTI_PREFIX) ?? false
}
