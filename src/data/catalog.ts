import type {
  Alternative,
  InterpretationGroup,
  RawSong,
  ReviewCatalog,
  ReviewSong,
  SongsDataset,
  YoutubeAlternativesCheck,
  YoutubeCandidate,
} from '../types'

export class DatasetError extends Error {
  override name = 'DatasetError'
}

/* ------------------------------------------------------------------ */
/* Validación mínima del JSON (solo los campos que usa la web)         */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>

function isObj(value: unknown): value is Obj {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(path: string, expected: string): never {
  throw new DatasetError(`songs.json: "${path}" debería ser ${expected}`)
}

function reqString(obj: Obj, key: string, path: string): string {
  const value = obj[key]
  if (typeof value !== 'string' || value === '') invalid(`${path}.${key}`, 'un texto no vacío')
  return value
}

function optString(obj: Obj, key: string, path: string): string | null {
  const value = obj[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'string') invalid(`${path}.${key}`, 'un texto o null')
  return value
}

function optNumber(obj: Obj, key: string, path: string): number | null {
  const value = obj[key]
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value)) invalid(`${path}.${key}`, 'un número o null')
  return value
}

function reqInt(obj: Obj, key: string, path: string): number {
  const value = obj[key]
  if (typeof value !== 'number' || !Number.isInteger(value)) invalid(`${path}.${key}`, 'un número entero')
  return value
}

function optBool(obj: Obj, key: string): boolean {
  return obj[key] === true
}

function list(obj: Obj, key: string, path: string): unknown[] {
  const value = obj[key]
  if (value === undefined || value === null) return []
  if (!Array.isArray(value)) invalid(`${path}.${key}`, 'una lista')
  return value
}

function parseCandidate(value: unknown, path: string): YoutubeCandidate {
  if (!isObj(value)) invalid(path, 'un objeto')
  return {
    title: optString(value, 'title', path) ?? '',
    artist: optString(value, 'artist', path) ?? '',
    url: optString(value, 'url', path) ?? '',
    video_id: reqString(value, 'video_id', path),
    channel: optString(value, 'channel', path) ?? '',
    type: optString(value, 'type', path) ?? 'other',
    why: optString(value, 'why', path) ?? '',
    song_ref: optString(value, 'song_ref', path) ?? 'main',
  }
}

function parseAlternative(value: unknown, path: string): Alternative {
  if (!isObj(value)) invalid(path, 'un objeto')
  return {
    title: reqString(value, 'title', path),
    artist: optString(value, 'artist', path),
    approx_year: optNumber(value, 'approx_year', path),
    why: optString(value, 'why', path) ?? '',
    confidence: optNumber(value, 'confidence', path) ?? 0,
  }
}

function parseSong(value: unknown, path: string): RawSong {
  if (!isObj(value)) invalid(path, 'un objeto')
  const song: RawSong = {
    id: reqInt(value, 'id', path),
    source_text: optString(value, 'source_text', path) ?? '',
    normalized_title: optString(value, 'normalized_title', path),
    artist: optString(value, 'artist', path),
    approx_year: optNumber(value, 'approx_year', path),
    language: optString(value, 'language', path),
    status: optString(value, 'status', path) ?? '',
    duplicate_of: optNumber(value, 'duplicate_of', path),
    alternatives: list(value, 'alternatives', path).map((a, i) => parseAlternative(a, `${path}.alternatives[${i}]`)),
    youtube_candidates: list(value, 'youtube_candidates', path).map((c, i) =>
      parseCandidate(c, `${path}.youtube_candidates[${i}]`),
    ),
    youtube_status: optString(value, 'youtube_status', path) ?? '',
    youtube_search_url: optString(value, 'youtube_search_url', path),
    needs_father_review: optBool(value, 'needs_father_review'),
    manual_review: optBool(value, 'manual_review'),
    manual_review_question_zh: optString(value, 'manual_review_question_zh', path),
    same_song_ids: list(value, 'same_song_ids', path).filter((n): n is number => typeof n === 'number'),
  }
  if (isObj(value.youtube_alternatives_check)) {
    song.youtube_alternatives_check = value.youtube_alternatives_check as unknown as YoutubeAlternativesCheck
  }
  return song
}

export function parseDataset(json: unknown): SongsDataset {
  if (!isObj(json)) invalid('(raíz)', 'un objeto')
  if (!Array.isArray(json.songs)) invalid('songs', 'una lista')
  const songs = json.songs.map((s, i) => parseSong(s, `songs[${i}]`))
  const counts = isObj(json.counts) ? json.counts : {}
  const uniqueSongs =
    typeof counts.unique_songs === 'number'
      ? counts.unique_songs
      : songs.filter((s) => s.duplicate_of === null).length
  return {
    generated: typeof json.generated === 'string' ? json.generated : '',
    counts: {
      entries: typeof counts.entries === 'number' ? counts.entries : songs.length,
      unique_songs: uniqueSongs,
    },
    songs,
  }
}

/* ------------------------------------------------------------------ */
/* Enlaces                                                             */
/* ------------------------------------------------------------------ */

const YOUTUBE_URL = /^https:\/\/(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\//

export function watchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`
}

function safeCandidate(candidate: YoutubeCandidate): YoutubeCandidate {
  return YOUTUBE_URL.test(candidate.url) ? candidate : { ...candidate, url: watchUrl(candidate.video_id) }
}

function safeSearchUrl(raw: RawSong): string {
  if (raw.youtube_search_url && YOUTUBE_URL.test(raw.youtube_search_url)) return raw.youtube_search_url
  const query = raw.normalized_title ? [raw.normalized_title, raw.artist].filter(Boolean).join(' ') : raw.source_text
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

/* ------------------------------------------------------------------ */
/* Agrupación por interpretación                                       */
/* ------------------------------------------------------------------ */

/** Clave con la que los candidatos apuntan a una alternativa: "alt:<título> (<artista>)". */
export function altRef(alternative: Alternative): string {
  return `alt:${alternative.title}${alternative.artist ? ` (${alternative.artist})` : ''}`
}

/**
 * Separa "alt:<título> (<artista>)" en título y artista. El artista es el último
 * paréntesis ASCII equilibrado precedido de un espacio (puede contener paréntesis).
 */
export function parseSongRef(ref: string): { title: string; artist: string | null } {
  const body = ref.startsWith('alt:') ? ref.slice(4) : ref
  if (body.endsWith(')')) {
    let depth = 0
    for (let i = body.length - 1; i >= 0; i--) {
      const ch = body[i]
      if (ch === ')') depth++
      else if (ch === '(') {
        depth--
        if (depth === 0) {
          if (i > 0 && body[i - 1] === ' ') {
            const artist = body.slice(i + 1, -1).trim()
            return { title: body.slice(0, i - 1).trim(), artist: artist || null }
          }
          break
        }
      }
    }
  }
  return { title: body.trim(), artist: null }
}

function letterFor(index: number): string {
  return index < 26 ? String.fromCharCode(65 + index) : String(index + 1)
}

function buildGroups(raw: RawSong): InterpretationGroup[] {
  const groups: InterpretationGroup[] = []
  const byRef = new Map<string, InterpretationGroup>()
  const add = (group: Omit<InterpretationGroup, 'letter' | 'candidates'>) => {
    const created: InterpretationGroup = { ...group, letter: letterFor(groups.length), candidates: [] }
    groups.push(created)
    byRef.set(created.ref, created)
    return created
  }

  add({ ref: 'main', isMain: true, title: raw.normalized_title, artist: raw.artist, year: raw.approx_year })
  for (const alternative of raw.alternatives) {
    const ref = altRef(alternative)
    if (byRef.has(ref)) continue
    add({ ref, isMain: false, title: alternative.title, artist: alternative.artist, year: alternative.approx_year })
  }

  for (const candidate of raw.youtube_candidates) {
    const ref = candidate.song_ref || 'main'
    let group = byRef.get(ref)
    if (!group) {
      // Candidato que apunta a una interpretación no listada en alternatives.
      const parsed = parseSongRef(ref)
      group = add({ ref, isMain: false, title: parsed.title, artist: parsed.artist ?? (candidate.artist || null), year: null })
    }
    group.candidates.push(safeCandidate(candidate))
  }

  // En manual_review se enseñan todas las opciones con nombre (coinciden con las
  // letras de la pregunta); en el resto, solo las que tienen algún vídeo.
  return groups.filter((g) => g.candidates.length > 0 || (raw.manual_review && Boolean(g.title)))
}

/* ------------------------------------------------------------------ */
/* Catálogo de revisión                                                */
/* ------------------------------------------------------------------ */

// Estas dos entradas no son canciones reales para revisar:
// 1 = prueba de micrófono del dictado; 2 = fragmento no identificado sin canción/candidatos.
// Se mantienen en songs.json como trazabilidad de la investigación, pero la UI las omite.
const EXCLUDED_REVIEW_ENTRIES = new Map<number, string>([
  [1, '现在可以你录得好好听得见吗'],
  [2, '从相拥守着碎碎将来'],
])

function isExcludedReviewEntry(song: RawSong): boolean {
  return EXCLUDED_REVIEW_ENTRIES.get(song.id) === song.source_text
}

/** Sigue duplicate_of hasta el registro canónico; null si la cadena está rota. */
function canonicalRoot(song: RawSong, rawById: ReadonlyMap<number, RawSong>): RawSong | null {
  const seen = new Set<number>()
  let current = song
  while (current.duplicate_of !== null) {
    if (seen.has(current.id)) return null
    seen.add(current.id)
    const next = rawById.get(current.duplicate_of)
    if (!next) return null
    current = next
  }
  return current
}

export function buildCatalog(dataset: SongsDataset): ReviewCatalog {
  const sorted = [...dataset.songs].sort((a, b) => a.id - b.id)
  const rawById = new Map(sorted.map((s) => [s.id, s]))

  const duplicatesOf = new Map<number, number[]>()
  const canonical: RawSong[] = []
  let excludedCount = 0
  for (const song of sorted) {
    if (isExcludedReviewEntry(song)) {
      excludedCount++
      continue
    }
    if (song.duplicate_of === null) {
      canonical.push(song)
      continue
    }
    const root = canonicalRoot(song, rawById)
    if (!root) {
      // Duplicado roto: mejor revisarlo como canción propia que perderlo.
      canonical.push(song)
      continue
    }
    const ids = duplicatesOf.get(root.id) ?? []
    ids.push(song.id)
    duplicatesOf.set(root.id, ids)
  }

  const songs: ReviewSong[] = canonical.map((raw, index) => {
    const groups = buildGroups(raw)
    return {
      id: raw.id,
      position: index + 1,
      sourceText: raw.source_text,
      title: raw.normalized_title,
      artist: raw.artist,
      year: raw.approx_year,
      language: raw.language,
      datasetStatus: raw.status,
      needsFatherReview: raw.needs_father_review,
      manualReview: raw.manual_review,
      question: raw.manual_review_question_zh,
      groups,
      candidates: groups.flatMap((g) => g.candidates),
      searchUrl: safeSearchUrl(raw),
      duplicateIds: duplicatesOf.get(raw.id) ?? [],
    }
  })

  return {
    songs,
    byId: new Map(songs.map((s) => [s.id, s])),
    rawById,
    expectedUniqueSongs: dataset.counts.unique_songs - excludedCount,
    totalEntries: dataset.songs.length - excludedCount,
  }
}
