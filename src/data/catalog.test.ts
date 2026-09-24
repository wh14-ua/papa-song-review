import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { buildCatalog, parseDataset, parseSongRef } from './catalog'
import type { RawSong } from '../types'

const realJson: unknown = JSON.parse(
  readFileSync(new URL('../../public/songs.json', import.meta.url), 'utf8'),
)

function realCatalog() {
  return buildCatalog(parseDataset(realJson))
}

function summarizeGroups(songId: number) {
  const song = realCatalog().byId.get(songId)
  if (!song) throw new Error(`song ${songId} missing`)
  return song.groups.map((g) => ({
    letter: g.letter,
    title: g.title,
    artist: g.artist,
    year: g.year,
    videos: g.candidates.map((c) => c.video_id),
  }))
}

function rawSong(overrides: Partial<RawSong> & Pick<RawSong, 'id'>): RawSong {
  return {
    source_text: `texto ${overrides.id}`,
    normalized_title: `canción ${overrides.id}`,
    artist: 'artista',
    approx_year: 2000,
    language: '国语',
    status: 'confirmed',
    duplicate_of: null,
    alternatives: [],
    youtube_candidates: [],
    youtube_status: 'verified_candidates',
    youtube_search_url: null,
    needs_father_review: false,
    manual_review: false,
    manual_review_question_zh: null,
    same_song_ids: [],
    ...overrides,
  }
}

function fixture(songs: RawSong[]) {
  return { generated: '2026-09-24', counts: { entries: songs.length, unique_songs: songs.length }, songs }
}

describe('songs.json real', () => {
  it('se carga y deja exactamente las 121 canciones canónicas', () => {
    const catalog = realCatalog()
    expect(catalog.songs).toHaveLength(121)
    expect(catalog.expectedUniqueSongs).toBe(121)
    expect(catalog.totalEntries).toBe(142)
  })

  it('no incluye ningún registro con duplicate_of', () => {
    const catalog = realCatalog()
    for (const duplicateId of [11, 131, 28, 30, 33, 55, 74, 140]) {
      expect(catalog.byId.has(duplicateId)).toBe(false)
    }
    expect(catalog.songs.every((s) => catalog.rawById.get(s.id)?.duplicate_of === null)).toBe(true)
  })

  it('asocia a cada canónica los duplicados que heredarán su elección', () => {
    const catalog = realCatalog()
    expect(catalog.byId.get(3)?.duplicateIds).toEqual([11, 131])
    expect(catalog.byId.get(18)?.duplicateIds).toEqual([33, 55])
    expect(catalog.byId.get(37)?.duplicateIds).toEqual([74])
    expect(catalog.byId.get(6)?.duplicateIds).toEqual([])
  })

  it('numera las posiciones en orden de id', () => {
    const catalog = realCatalog()
    expect(catalog.songs[0]?.id).toBe(1)
    expect(catalog.songs[0]?.position).toBe(1)
    expect(catalog.byId.get(37)?.position).toBe(33)
    expect(catalog.songs[120]?.id).toBe(142)
    expect(catalog.songs[120]?.position).toBe(121)
  })

  it('mantiene título, artista, año y texto original de la canción 37', () => {
    const song = realCatalog().byId.get(37)
    expect(song).toMatchObject({
      title: '一千个伤心的理由',
      artist: '张学友',
      year: 1995,
      sourceText: '一个1000个伤心的理由',
    })
    expect(song?.candidates.map((c) => c.video_id)).toEqual(['Yl9sIjmaZP8', 'gEpjMDlrjcE', 'oceW_MHAzyQ'])
  })

  it('muestra cada youtube_candidate exactamente una vez (473 en total)', () => {
    const catalog = realCatalog()
    let shown = 0
    for (const song of catalog.songs) {
      const inGroups = song.groups.flatMap((g) => g.candidates.map((c) => c.video_id))
      const raw = catalog.rawById.get(song.id)?.youtube_candidates.map((c) => c.video_id) ?? []
      expect([...inGroups].sort()).toEqual([...raw].sort())
      expect(song.candidates.map((c) => c.video_id)).toEqual(inGroups)
      shown += inGroups.length
    }
    expect(shown).toBe(473)
  })
})

describe('agrupación por interpretación', () => {
  it('manual_review: una letra por posible canción, en el orden de la pregunta (canción 6)', () => {
    expect(summarizeGroups(6)).toEqual([
      { letter: 'A', title: '一瞬间', artist: '丽江小倩', year: 2011, videos: ['Kt9yJTNwTzw', 'tegQl2XxTMs'] },
      { letter: 'B', title: '一瞬间', artist: '汪峰', year: 2011, videos: ['tTVnpfxPF4s'] },
      { letter: 'C', title: '一瞬间', artist: '马融', year: 2016, videos: ['JDhVYa-LSTg'] },
      { letter: 'D', title: '一百万个可能', artist: '克丽丝叮 (Christine Welch)', year: 2014, videos: ['hzypdAfwN24'] },
      { letter: 'E', title: '一瞬间', artist: '何静', year: 2001, videos: ['AjO7y2BRyoo'] },
    ])
  })

  it('manual_review: conserva también las opciones sin vídeo (canción 45, E y G)', () => {
    const groups = summarizeGroups(45)
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    expect(groups[4]).toMatchObject({ artist: '杨崇荣', videos: [] })
    expect(groups[6]).toMatchObject({ artist: '刘奕君', videos: [] })
  })

  it('crea un grupo extra para un song_ref que no está en alternatives (canción 117)', () => {
    const groups = summarizeGroups(117)
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'])
    expect(groups[0]).toMatchObject({ title: '青春不散场', artist: null, videos: [] })
    expect(groups[6]).toMatchObject({ title: '你是偶像', videos: ['30g2I-npR8I'] })
    expect(groups[7]).toEqual({
      letter: 'H',
      title: '时间能不能走慢点（青春别散场live大合唱版）',
      artist: 'Lee 木子',
      year: null,
      videos: ['ev7e-luzsRs'],
    })
  })

  it('sin manual_review: solo muestra las interpretaciones que tienen vídeo (canción 3)', () => {
    expect(summarizeGroups(3)).toEqual([
      { letter: 'A', title: '忘不了的人', artist: '洋澜一', year: 2025, videos: ['Ov_BFvQ2haU', 'lasUoe2Zzyk'] },
      { letter: 'B', title: '忘不了的人', artist: '陈浩民', year: 2012, videos: ['Bag_yZGVr60'] },
    ])
  })

  it('sin manual_review y sin vídeos de alternativas: un único grupo (canción 97)', () => {
    expect(summarizeGroups(97)).toEqual([
      { letter: 'A', title: '知心爱人', artist: '付笛声、任静', year: 1997, videos: ['GCSEsxulsh8', 'FtLf3-120hM'] },
    ])
  })

  it('una canción sin candidatos no tiene grupos visibles (canción 1)', () => {
    const song = realCatalog().byId.get(1)
    expect(song?.groups).toEqual([])
    expect(song?.candidates).toEqual([])
    expect(song?.searchUrl).toContain('youtube.com/results')
  })

  it('manual_review sin identificar y sin opciones: tampoco inventa un grupo vacío (canción 2)', () => {
    const song = realCatalog().byId.get(2)
    expect(song?.manualReview).toBe(true)
    expect(song?.groups).toEqual([])
    expect(song?.question).toContain('从相拥守着碎碎将来')
  })
})

describe('parseSongRef', () => {
  it('separa título y artista aunque el artista lleve paréntesis', () => {
    expect(parseSongRef('alt:一百万个可能 (克丽丝叮 (Christine Welch))')).toEqual({
      title: '一百万个可能',
      artist: '克丽丝叮 (Christine Welch)',
    })
  })

  it('no confunde los paréntesis chinos del título con los del artista', () => {
    expect(parseSongRef('alt:时间能不能走慢点（青春别散场live大合唱版） (Lee 木子)')).toEqual({
      title: '时间能不能走慢点（青春别散场live大合唱版）',
      artist: 'Lee 木子',
    })
  })

  it('acepta referencias sin artista', () => {
    expect(parseSongRef('alt:诗意盎然')).toEqual({ title: '诗意盎然', artist: null })
  })
})

describe('parseDataset', () => {
  it('rechaza un JSON sin lista de canciones', () => {
    expect(() => parseDataset({ generated: 'x' })).toThrow(/songs/)
  })

  it('rechaza una canción sin id numérico', () => {
    expect(() => parseDataset(fixture([{ ...rawSong({ id: 1 }), id: 'uno' as unknown as number }]))).toThrow(/id/)
  })

  it('rechaza un candidato sin video_id', () => {
    const song = rawSong({
      id: 1,
      youtube_candidates: [
        { title: 't', artist: 'a', url: 'https://www.youtube.com/watch?v=x', channel: 'c', type: 'studio', why: '', song_ref: 'main' } as never,
      ],
    })
    expect(() => parseDataset(fixture([song]))).toThrow(/video_id/)
  })
})

describe('buildCatalog', () => {
  it('ordena por id aunque el JSON venga desordenado', () => {
    const catalog = buildCatalog(parseDataset(fixture([rawSong({ id: 5 }), rawSong({ id: 2 }), rawSong({ id: 9 })])))
    expect(catalog.songs.map((s) => [s.id, s.position])).toEqual([
      [2, 1],
      [5, 2],
      [9, 3],
    ])
  })

  it('un duplicado apuntando a otro duplicado hereda del canónico final', () => {
    const catalog = buildCatalog(
      parseDataset(fixture([rawSong({ id: 1 }), rawSong({ id: 2, duplicate_of: 1 }), rawSong({ id: 3, duplicate_of: 2 })])),
    )
    expect(catalog.songs.map((s) => s.id)).toEqual([1])
    expect(catalog.byId.get(1)?.duplicateIds).toEqual([2, 3])
  })

  it('un duplicado cuyo canónico no existe se revisa como canción propia (no se pierde)', () => {
    const catalog = buildCatalog(parseDataset(fixture([rawSong({ id: 1 }), rawSong({ id: 2, duplicate_of: 99 })])))
    expect(catalog.songs.map((s) => s.id)).toEqual([1, 2])
  })
})

describe('enlaces seguros', () => {
  it('usa la URL original de YouTube y reconstruye una URL no válida a partir del video_id', () => {
    const catalog = buildCatalog(
      parseDataset(
        fixture([
          rawSong({
            id: 1,
            youtube_search_url: 'javascript:alert(1)',
            youtube_candidates: [
              { title: 'ok', artist: 'a', url: 'https://www.youtube.com/watch?v=Ov_BFvQ2haU', video_id: 'Ov_BFvQ2haU', channel: 'c', type: 'studio', why: '', song_ref: 'main' },
              { title: 'mala', artist: 'a', url: 'javascript:alert(1)', video_id: 'lasUoe2Zzyk', channel: 'c', type: 'studio', why: '', song_ref: 'main' },
            ],
          }),
        ]),
      ),
    )
    const song = catalog.byId.get(1)
    expect(song?.candidates.map((c) => c.url)).toEqual([
      'https://www.youtube.com/watch?v=Ov_BFvQ2haU',
      'https://www.youtube.com/watch?v=lasUoe2Zzyk',
    ])
    // título + artista del fixture: "canción 1" + "artista"
    expect(song?.searchUrl).toBe('https://www.youtube.com/results?search_query=canci%C3%B3n%201%20artista')
  })
})
