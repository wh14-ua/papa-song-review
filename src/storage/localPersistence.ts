import { SELECTION_STATUSES, type SelectionRecord, type SelectionStatus } from '../types'

/** Subconjunto de window.localStorage que usamos. */
export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

export interface PersistedState {
  records: SelectionRecord[]
  /** song_id con cambios que todavía no se han subido a Supabase */
  pending: number[]
}

export interface LocalPersistence {
  /** null si no hay nada guardado o no se puede leer */
  load(): PersistedState | null
  /** false si el navegador no permite guardar (modo privado, cuota…) */
  save(state: PersistedState): boolean
  readonly available: boolean
}

const STORAGE_PREFIX = 'cancionero-papa:v1:'

export function storageKey(sessionId: string): string {
  return `${STORAGE_PREFIX}${sessionId}`
}

/** localStorage del navegador, o null si no está disponible o bloqueado. */
export function browserStorage(): StorageLike | null {
  try {
    const storage = globalThis.localStorage
    const probe = `${STORAGE_PREFIX}probe`
    storage.setItem(probe, '1')
    storage.removeItem(probe)
    return storage
  } catch {
    return null
  }
}

function isStatus(value: unknown): value is SelectionStatus {
  return typeof value === 'string' && (SELECTION_STATUSES as readonly string[]).includes(value)
}

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

/** Valida una fila (de localStorage o de Supabase); null si no es válida. */
export function normalizeRecord(value: unknown, sessionId: string): SelectionRecord | null {
  if (typeof value !== 'object' || value === null) return null
  const row = value as Record<string, unknown>
  const songId = row.song_id
  if (typeof songId !== 'number' || !Number.isInteger(songId) || !isStatus(row.status)) return null
  const updatedAt = textOrNull(row.updated_at)
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) return null
  const selected = row.status === 'selected'
  return {
    session_id: sessionId,
    song_id: songId,
    status: row.status,
    selected_video_id: selected ? textOrNull(row.selected_video_id) : null,
    selected_url: selected ? textOrNull(row.selected_url) : null,
    selected_title: selected ? textOrNull(row.selected_title) : null,
    notes: textOrNull(row.notes),
    created_at: textOrNull(row.created_at) ?? updatedAt,
    updated_at: updatedAt,
  }
}

export function createLocalPersistence(storage: StorageLike | null, sessionId: string): LocalPersistence {
  const key = storageKey(sessionId)
  return {
    available: storage !== null,
    load() {
      if (!storage) return null
      try {
        const raw = storage.getItem(key)
        if (!raw) return null
        const parsed: unknown = JSON.parse(raw)
        if (typeof parsed !== 'object' || parsed === null) return null
        const data = parsed as { records?: unknown; pending?: unknown }
        const records = Array.isArray(data.records)
          ? data.records.map((r) => normalizeRecord(r, sessionId)).filter((r): r is SelectionRecord => r !== null)
          : []
        const known = new Set(records.map((r) => r.song_id))
        const pending = Array.isArray(data.pending)
          ? data.pending.filter((id): id is number => typeof id === 'number' && known.has(id))
          : []
        return { records, pending }
      } catch {
        return null
      }
    },
    save(state) {
      if (!storage) return false
      try {
        storage.setItem(key, JSON.stringify(state))
        return true
      } catch {
        return false
      }
    },
  }
}
