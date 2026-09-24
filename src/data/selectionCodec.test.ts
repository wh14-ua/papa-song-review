import { describe, expect, it } from 'vitest'
import { encodeVideoSelections, selectedVideoIds } from './selectionCodec'
import type { SelectionRecord } from '../types'

function record(overrides: Partial<SelectionRecord> = {}): SelectionRecord {
  return {
    session_id: 'papa',
    song_id: 3,
    status: 'selected',
    selected_video_id: 'Ov_BFvQ2haU',
    selected_url: 'https://www.youtube.com/watch?v=Ov_BFvQ2haU',
    selected_title: 'título antiguo',
    notes: null,
    created_at: '2026-09-24T10:00:00.000Z',
    updated_at: '2026-09-24T10:00:00.000Z',
    ...overrides,
  }
}

describe('selectedVideoIds', () => {
  it('sigue leyendo las selecciones antiguas de un solo vídeo', () => {
    expect(selectedVideoIds(record())).toEqual(['Ov_BFvQ2haU'])
  })

  it('lee varias selecciones y elimina ids repetidos', () => {
    expect(
      selectedVideoIds(
        record({
          selected_title: '__multi__:Ov_BFvQ2haU,lasUoe2Zzyk,Ov_BFvQ2haU',
        }),
      ),
    ).toEqual(['Ov_BFvQ2haU', 'lasUoe2Zzyk'])
  })

  it('no devuelve vídeos para estados no seleccionados', () => {
    expect(selectedVideoIds(record({ status: 'skipped', selected_video_id: null }))).toEqual([])
  })
})

describe('encodeVideoSelections', () => {
  it('guarda varios ids en formato compacto y mantiene la primera URL por compatibilidad', () => {
    expect(
      encodeVideoSelections([
        {
          videoId: 'Ov_BFvQ2haU',
          url: 'https://www.youtube.com/watch?v=Ov_BFvQ2haU',
          title: 'uno',
        },
        {
          videoId: 'lasUoe2Zzyk',
          url: 'https://www.youtube.com/watch?v=lasUoe2Zzyk',
          title: 'dos',
        },
      ]),
    ).toEqual({
      selected_video_id: 'Ov_BFvQ2haU',
      selected_url: 'https://www.youtube.com/watch?v=Ov_BFvQ2haU',
      selected_title: '__multi__:Ov_BFvQ2haU,lasUoe2Zzyk',
    })
  })

  it('devuelve null sin selección', () => {
    expect(encodeVideoSelections([])).toBeNull()
  })
})
