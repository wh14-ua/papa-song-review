import type { SelectionMap } from '../data/progress'
import { encodeVideoSelections } from '../data/selectionCodec'
import type { SelectionRecord, SelectionStatus } from '../types'
import { normalizeRecord, type LocalPersistence } from './localPersistence'
import type { RemoteGateway } from './remote'

export type SyncPhase = 'local-only' | 'syncing' | 'synced' | 'error'
export type InitialLoad = 'none' | 'loading' | 'done' | 'failed'

export interface StoreSnapshot {
  records: SelectionMap
  /** Cambios guardados en el navegador que aún no están en Supabase */
  pendingCount: number
  mode: 'local' | 'supabase'
  phase: SyncPhase
  /** Primera descarga desde Supabase ('none' en modo local) */
  initialLoad: InitialLoad
  lastSyncedAt: string | null
  lastError: string | null
  /** false si el navegador no deja guardar en localStorage */
  localAvailable: boolean
}

export interface SelectedVideo {
  videoId: string
  url: string
  title: string
}

export interface SelectionStoreOptions {
  sessionId: string
  local: LocalPersistence
  remote: RemoteGateway | null
  now?: () => Date
}

const RETRY_DELAYS_MS = [2_000, 5_000, 15_000, 30_000, 60_000]
const MAX_FLUSH_ROUNDS = 5
export const MAX_NOTES_LENGTH = 2000

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/**
 * Guarda cada acción al instante en localStorage y la sube a Supabase (si está
 * configurado). Lo que no se pueda subir queda pendiente —también entre
 * recargas— y se reintenta. Conflictos: gana el updated_at más reciente.
 */
export class SelectionStore {
  readonly sessionId: string
  private readonly local: LocalPersistence
  private readonly remote: RemoteGateway | null
  private readonly now: () => Date
  private records: Record<number, SelectionRecord> = {}
  private readonly pending = new Set<number>()
  private readonly listeners = new Set<() => void>()
  private snapshot: StoreSnapshot
  private startPromise: Promise<void> | null = null
  private inflight: Promise<void> | null = null
  private flushAgain = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null
  private retryAttempt = 0

  constructor(options: SelectionStoreOptions) {
    this.sessionId = options.sessionId
    this.local = options.local
    this.remote = options.remote
    this.now = options.now ?? (() => new Date())
    this.snapshot = {
      records: this.records,
      pendingCount: 0,
      mode: this.remote ? 'supabase' : 'local',
      phase: this.remote ? 'syncing' : 'local-only',
      initialLoad: this.remote ? 'loading' : 'none',
      lastSyncedAt: null,
      lastError: null,
      localAvailable: this.local.available,
    }
  }

  /* ---------- API para React (useSyncExternalStore) ---------- */

  getSnapshot = (): StoreSnapshot => this.snapshot

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /* ---------- Ciclo de vida ---------- */

  /** Carga lo guardado en el navegador y, si hay Supabase, sincroniza. Idempotente. */
  start(): Promise<void> {
    this.startPromise ??= this.doStart()
    return this.startPromise
  }

  private async doStart(): Promise<void> {
    const saved = this.local.load()
    if (saved) {
      this.records = Object.fromEntries(saved.records.map((r) => [r.song_id, r]))
      for (const id of saved.pending) this.pending.add(id)
    }
    this.publish({})
    await this.sync()
  }

  /** Descarga lo que hay en Supabase, fusiona y sube lo pendiente. */
  syncNow(): Promise<void> {
    return this.sync()
  }

  /* ---------- Acciones ---------- */

  setStatus(songId: number, status: 'selected', video: SelectedVideo): void
  setStatus(songId: number, status: Exclude<SelectionStatus, 'selected'>): void
  setStatus(songId: number, status: SelectionStatus, video?: SelectedVideo): void {
    const previous = this.records[songId]
    const timestamp = this.nextTimestamp(previous?.updated_at)
    const chosen = status === 'selected' && video ? video : null
    this.commit({
      session_id: this.sessionId,
      song_id: songId,
      status,
      selected_video_id: chosen?.videoId ?? null,
      selected_url: chosen?.url ?? null,
      selected_title: chosen?.title ?? null,
      notes: previous?.notes ?? null,
      created_at: previous?.created_at ?? timestamp,
      updated_at: timestamp,
    })
  }

  /**
   * Guarda una o varias versiones para la misma canción. Si se quita la última,
   * la canción vuelve a pendiente mediante el estado "skipped" (no cuenta como hecha).
   */
  setVideoSelections(songId: number, videos: readonly SelectedVideo[]): void {
    if (videos.length === 0) {
      this.setStatus(songId, 'skipped')
      return
    }
    const previous = this.records[songId]
    const timestamp = this.nextTimestamp(previous?.updated_at)
    const encoded = encodeVideoSelections(videos)
    if (!encoded) return
    this.commit({
      session_id: this.sessionId,
      song_id: songId,
      status: 'selected',
      selected_video_id: encoded.selected_video_id,
      selected_url: encoded.selected_url,
      selected_title: encoded.selected_title,
      notes: previous?.notes ?? null,
      created_at: previous?.created_at ?? timestamp,
      updated_at: timestamp,
    })
  }

  /** Nota libre de papá. Solo tiene sentido si la canción ya tiene un estado. */
  setNotes(songId: number, notes: string): void {
    const previous = this.records[songId]
    if (!previous) return
    const cleaned = notes.trim().slice(0, MAX_NOTES_LENGTH)
    const value = cleaned === '' ? null : cleaned
    if (value === previous.notes) return
    this.commit({ ...previous, notes: value, updated_at: this.nextTimestamp(previous.updated_at) })
  }

  /** Sube a Supabase todo lo pendiente (no hace nada en modo local). */
  flush(): Promise<void> {
    if (!this.remote) return Promise.resolve()
    if (this.inflight) {
      this.flushAgain = true
      return this.inflight
    }
    const run = this.runFlush().finally(() => {
      this.inflight = null
    })
    this.inflight = run
    return run
  }

  /* ---------- Interno ---------- */

  private nextTimestamp(previous: string | undefined): string {
    let ms = this.now().getTime()
    const prev = previous ? Date.parse(previous) : Number.NaN
    if (!Number.isNaN(prev) && ms <= prev) ms = prev + 1
    return new Date(ms).toISOString()
  }

  private commit(record: SelectionRecord): void {
    this.records = { ...this.records, [record.song_id]: record }
    this.pending.add(record.song_id)
    this.persist()
    this.publish({})
    void this.flush()
  }

  private async sync(): Promise<void> {
    const remote = this.remote
    if (!remote) return
    const wasLoaded = this.snapshot.initialLoad === 'done'
    this.publish({ phase: 'syncing', initialLoad: wasLoaded ? 'done' : 'loading' })
    let rows: SelectionRecord[]
    try {
      rows = await remote.fetchAll(this.sessionId)
    } catch (error) {
      this.publish({ phase: 'error', initialLoad: wasLoaded ? 'done' : 'failed', lastError: describeError(error) })
      this.scheduleRetry()
      return
    }
    this.merge(rows)
    this.publish({ initialLoad: 'done', lastSyncedAt: this.now().toISOString() })
    await this.flush()
  }

  /** Fusión "gana el último cambio" + unión: nada local se pierde. */
  private merge(rows: readonly SelectionRecord[]): void {
    const next = { ...this.records }
    const seen = new Set<number>()
    for (const raw of rows) {
      const row = normalizeRecord(raw, this.sessionId)
      if (!row) continue
      seen.add(row.song_id)
      const local = next[row.song_id]
      if (!local) {
        next[row.song_id] = row
        continue
      }
      const remoteTime = Date.parse(row.updated_at)
      const localTime = Date.parse(local.updated_at)
      if (remoteTime > localTime) {
        next[row.song_id] = row
        this.pending.delete(row.song_id)
      } else if (remoteTime < localTime) {
        this.pending.add(row.song_id)
      }
    }
    for (const key of Object.keys(next)) {
      const id = Number(key)
      if (!seen.has(id)) this.pending.add(id)
    }
    this.records = next
    this.persist()
    this.publish({})
  }

  private async runFlush(): Promise<void> {
    const remote = this.remote
    if (!remote) return
    for (let round = 0; round < MAX_FLUSH_ROUNDS; round++) {
      this.flushAgain = false
      const batch = [...this.pending]
        .map((id) => this.records[id])
        .filter((r): r is SelectionRecord => r !== undefined)
      if (batch.length === 0) {
        this.pending.clear()
        this.publish({ phase: 'synced', lastError: null })
        return
      }
      this.publish({ phase: 'syncing' })
      try {
        await remote.upsert(batch)
      } catch (error) {
        this.publish({ phase: 'error', lastError: describeError(error) })
        this.scheduleRetry()
        return
      }
      for (const sent of batch) {
        // Si cambió mientras se enviaba, sigue pendiente y sale en la siguiente vuelta.
        if (this.records[sent.song_id]?.updated_at === sent.updated_at) this.pending.delete(sent.song_id)
      }
      this.retryAttempt = 0
      this.persist()
      this.publish({
        phase: this.pending.size > 0 ? 'syncing' : 'synced',
        lastSyncedAt: this.now().toISOString(),
        lastError: null,
      })
      if (this.pending.size === 0 && !this.flushAgain) return
    }
    this.scheduleRetry()
  }

  private scheduleRetry(): void {
    if (!this.remote || this.retryTimer !== null) return
    const delay = RETRY_DELAYS_MS[Math.min(this.retryAttempt, RETRY_DELAYS_MS.length - 1)]
    this.retryAttempt++
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null
      void this.sync()
    }, delay)
  }

  private persist(): void {
    const ok = this.local.save({ records: Object.values(this.records), pending: [...this.pending] })
    if (ok !== this.snapshot.localAvailable) this.publish({ localAvailable: ok })
  }

  private publish(partial: Partial<StoreSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...partial, records: this.records, pendingCount: this.pending.size }
    for (const listener of this.listeners) listener()
  }
}
