import { describe, expect, it } from 'vitest'
import { toUpsertRow } from './supabaseGateway'

describe('toUpsertRow', () => {
  it('envía las fechas del cliente (momento de la acción) y nunca el id', () => {
    const row = toUpsertRow({
      session_id: 'papa',
      song_id: 37,
      status: 'selected',
      selected_video_id: 'Yl9sIjmaZP8',
      selected_url: 'https://www.youtube.com/watch?v=Yl9sIjmaZP8',
      selected_title: '一千个伤心的理由',
      notes: null,
      created_at: '2026-09-24T09:00:00.000Z',
      updated_at: '2026-09-24T10:00:00.000Z',
    })
    expect(row).toEqual({
      session_id: 'papa',
      song_id: 37,
      status: 'selected',
      selected_video_id: 'Yl9sIjmaZP8',
      selected_url: 'https://www.youtube.com/watch?v=Yl9sIjmaZP8',
      selected_title: '一千个伤心的理由',
      notes: null,
      created_at: '2026-09-24T09:00:00.000Z',
      updated_at: '2026-09-24T10:00:00.000Z',
    })
  })
})
