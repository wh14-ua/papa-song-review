import { describe, expect, it } from 'vitest'
import { adjacentSongIds, computeStats, findResumeSongId } from './progress'
import type { SelectionRecord, SelectionStatus } from '../types'

const songs = [{ id: 1 }, { id: 2 }, { id: 4 }, { id: 7 }, { id: 9 }]

function rec(song_id: number, status: SelectionStatus): SelectionRecord {
  return {
    session_id: 'papa',
    song_id,
    status,
    selected_video_id: status === 'selected' ? 'Ov_BFvQ2haU' : null,
    selected_url: status === 'selected' ? 'https://www.youtube.com/watch?v=Ov_BFvQ2haU' : null,
    selected_title: null,
    notes: null,
    created_at: '2026-09-24T10:00:00.000Z',
    updated_at: '2026-09-24T10:00:00.000Z',
  }
}

function records(...list: SelectionRecord[]) {
  return Object.fromEntries(list.map((r) => [r.song_id, r]))
}

describe('computeStats', () => {
  it('cuenta cada estado y trata saltadas + sin tocar como pendientes', () => {
    const stats = computeStats(songs, records(rec(1, 'selected'), rec(2, 'none'), rec(4, 'skipped')))
    expect(stats).toEqual({
      total: 5,
      selected: 1,
      none: 1,
      wrong_song: 0,
      search_more: 0,
      skipped: 1,
      untouched: 2,
      pending: 3,
      done: 2,
      percent: 40,
    })
  })

  it('ignora selecciones de canciones que no están en la lista (p. ej. duplicados)', () => {
    const stats = computeStats(songs, records(rec(3, 'selected'), rec(99, 'none'), rec(7, 'wrong_song')))
    expect(stats.selected).toBe(0)
    expect(stats.none).toBe(0)
    expect(stats.wrong_song).toBe(1)
    expect(stats.done).toBe(1)
    expect(stats.untouched).toBe(4)
  })

  it('redondea el porcentaje (73 de 121 → 60 %)', () => {
    const many = Array.from({ length: 121 }, (_, i) => ({ id: i + 1 }))
    const done = Array.from({ length: 73 }, (_, i) => rec(i + 1, 'search_more'))
    const stats = computeStats(many, records(...done))
    expect(stats.done).toBe(73)
    expect(stats.percent).toBe(60)
  })

  it('con 0 canciones no divide entre cero', () => {
    expect(computeStats([], {}).percent).toBe(0)
  })
})

describe('findResumeSongId', () => {
  it('continúa en la primera canción sin tocar, aunque haya saltadas antes', () => {
    expect(findResumeSongId(songs, records(rec(1, 'selected'), rec(2, 'skipped'), rec(4, 'none')))).toBe(7)
  })

  it('si solo quedan saltadas, vuelve a la primera saltada', () => {
    const all = records(rec(1, 'selected'), rec(2, 'skipped'), rec(4, 'none'), rec(7, 'skipped'), rec(9, 'wrong_song'))
    expect(findResumeSongId(songs, all)).toBe(2)
  })

  it('devuelve null cuando todo está revisado', () => {
    const all = records(rec(1, 'selected'), rec(2, 'none'), rec(4, 'none'), rec(7, 'search_more'), rec(9, 'wrong_song'))
    expect(findResumeSongId(songs, all)).toBeNull()
  })

  it('sin progreso empieza por la primera canción', () => {
    expect(findResumeSongId(songs, {})).toBe(1)
  })
})

describe('adjacentSongIds', () => {
  it('da la anterior y la siguiente según el orden de la lista', () => {
    expect(adjacentSongIds(songs, 4)).toEqual({ prev: 2, next: 7 })
  })

  it('no hay anterior en la primera ni siguiente en la última', () => {
    expect(adjacentSongIds(songs, 1)).toEqual({ prev: null, next: 2 })
    expect(adjacentSongIds(songs, 9)).toEqual({ prev: 7, next: null })
  })

  it('un id desconocido no tiene vecinos', () => {
    expect(adjacentSongIds(songs, 3)).toEqual({ prev: null, next: null })
  })
})
