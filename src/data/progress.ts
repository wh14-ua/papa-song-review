import type { SelectionRecord, SelectionStatus } from '../types'

/** Selecciones indexadas por song_id. */
export type SelectionMap = Readonly<Record<number, SelectionRecord>>

type SongLike = { readonly id: number }

export interface ProgressStats {
  total: number
  selected: number
  none: number
  wrong_song: number
  search_more: number
  skipped: number
  /** Sin ninguna acción todavía */
  untouched: number
  /** skipped + untouched */
  pending: number
  /** selected + none + wrong_song + search_more */
  done: number
  /** done / total, redondeado */
  percent: number
}

/** Estados que cuentan como "revisada". Saltar no cuenta. */
export function isDone(status: SelectionStatus | undefined): boolean {
  return status !== undefined && status !== 'skipped'
}

export function computeStats(songs: readonly SongLike[], records: SelectionMap): ProgressStats {
  const stats: ProgressStats = {
    total: songs.length,
    selected: 0,
    none: 0,
    wrong_song: 0,
    search_more: 0,
    skipped: 0,
    untouched: 0,
    pending: 0,
    done: 0,
    percent: 0,
  }
  for (const song of songs) {
    const status = records[song.id]?.status
    if (status === undefined) stats.untouched++
    else stats[status]++
  }
  stats.done = stats.selected + stats.none + stats.wrong_song + stats.search_more
  stats.pending = stats.skipped + stats.untouched
  stats.percent = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
  return stats
}

/**
 * Dónde continuar: la primera canción sin tocar; si no queda ninguna,
 * la primera saltada; si todo está revisado, null.
 */
export function findResumeSongId(songs: readonly SongLike[], records: SelectionMap): number | null {
  const untouched = songs.find((s) => records[s.id] === undefined)
  if (untouched) return untouched.id
  const skipped = songs.find((s) => records[s.id]?.status === 'skipped')
  return skipped ? skipped.id : null
}

export function adjacentSongIds(songs: readonly SongLike[], id: number): { prev: number | null; next: number | null } {
  const index = songs.findIndex((s) => s.id === id)
  if (index === -1) return { prev: null, next: null }
  return {
    prev: songs[index - 1]?.id ?? null,
    next: songs[index + 1]?.id ?? null,
  }
}
