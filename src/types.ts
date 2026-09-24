/* ------------------------------------------------------------------ */
/* Formato de public/songs.json (fuente de verdad, no se modifica)     */
/* ------------------------------------------------------------------ */

export interface YoutubeCandidate {
  title: string
  artist: string
  url: string
  video_id: string
  channel: string
  /** studio | topic | official_mv | live | cover | other */
  type: string
  /** Explicación (en español) de por qué se propuso este vídeo. */
  why: string
  /** "main" o "alt:<título> (<artista>)" */
  song_ref: string
}

export interface Alternative {
  title: string
  artist: string | null
  approx_year: number | null
  why: string
  confidence: number
}

export interface AlternativesCheckEntry {
  song_ref?: string
  has_video: boolean
  video_ids?: string[]
  note?: string
  coverage?: string
}

export interface YoutubeAlternativesCheck {
  checked: string
  main: AlternativesCheckEntry
  alternatives: AlternativesCheckEntry[]
}

export interface RawSong {
  id: number
  source_text: string
  normalized_title: string | null
  artist: string | null
  approx_year: number | null
  language: string | null
  status: string
  duplicate_of: number | null
  alternatives: Alternative[]
  youtube_candidates: YoutubeCandidate[]
  youtube_status: string
  youtube_search_url: string | null
  needs_father_review: boolean
  manual_review: boolean
  manual_review_question_zh: string | null
  same_song_ids: number[]
  youtube_alternatives_check?: YoutubeAlternativesCheck
}

export interface SongsDataset {
  generated: string
  counts: {
    entries: number
    unique_songs: number
  }
  songs: RawSong[]
}

/* ------------------------------------------------------------------ */
/* Modelo de revisión (derivado del dataset)                          */
/* ------------------------------------------------------------------ */

/** Una posible canción ("interpretación") y sus grabaciones. */
export interface InterpretationGroup {
  /** "main" o el song_ref de la alternativa */
  ref: string
  /** A = identificación principal, B… = alternativas (mismo orden que manual_review_question_zh) */
  letter: string
  isMain: boolean
  title: string | null
  artist: string | null
  year: number | null
  candidates: YoutubeCandidate[]
}

export interface ReviewSong {
  id: number
  /** Posición 1…N dentro de las canciones canónicas */
  position: number
  sourceText: string
  title: string | null
  artist: string | null
  year: number | null
  language: string | null
  datasetStatus: string
  needsFatherReview: boolean
  manualReview: boolean
  question: string | null
  /** Grupos que se muestran (en manual_review también los que no tienen vídeo) */
  groups: InterpretationGroup[]
  /** Todos los candidatos en el orden en que se muestran */
  candidates: YoutubeCandidate[]
  searchUrl: string | null
  /** Registros duplicados que heredan la elección de esta canción */
  duplicateIds: number[]
}

export interface ReviewCatalog {
  songs: ReviewSong[]
  byId: ReadonlyMap<number, ReviewSong>
  /** Todos los registros del dataset (incluidos duplicados), por id */
  rawById: ReadonlyMap<number, RawSong>
  expectedUniqueSongs: number
  totalEntries: number
}

/* ------------------------------------------------------------------ */
/* Selecciones                                                         */
/* ------------------------------------------------------------------ */

export const SELECTION_STATUSES = ['selected', 'none', 'wrong_song', 'search_more', 'skipped'] as const
export type SelectionStatus = (typeof SELECTION_STATUSES)[number]

/** Una fila de la tabla song_selections. */
export interface SelectionRecord {
  session_id: string
  song_id: number
  status: SelectionStatus
  selected_video_id: string | null
  selected_url: string | null
  selected_title: string | null
  notes: string | null
  created_at: string
  updated_at: string
}
