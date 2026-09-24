import type { RemoteGateway } from '../storage/remote'
import type { StorageLike } from '../storage/localPersistence'
import type { SelectionRecord } from '../types'

/** localStorage en memoria (mismo contrato que window.localStorage). */
export class MemoryStorage implements StorageLike {
  readonly data = new Map<string, string>()
  failWrites = false

  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    if (this.failWrites) throw new DOMException('QuotaExceededError')
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }
}

interface Deferred {
  promise: Promise<void>
  resolve: () => void
}

function noop(): void {}

function deferred(): Deferred {
  let resolve: () => void = noop
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

/** Tabla song_selections en memoria con semántica de upsert por (session_id, song_id). */
export class FakeRemote implements RemoteGateway {
  readonly rows = new Map<string, SelectionRecord>()
  readonly upsertCalls: SelectionRecord[][] = []
  fetchCalls = 0
  failing = false
  private gate: Deferred | null = null
  private fetchGate: Deferred | null = null

  static key(sessionId: string, songId: number): string {
    return `${sessionId}:${songId}`
  }

  seed(record: SelectionRecord): void {
    this.rows.set(FakeRemote.key(record.session_id, record.song_id), { ...record })
  }

  /** Las siguientes llamadas a upsert quedan en espera hasta release(). */
  hold(): void {
    this.gate = deferred()
  }

  release(): void {
    const gate = this.gate
    this.gate = null
    gate?.resolve()
  }

  /** La siguiente descarga lee la tabla ahora pero no responde hasta releaseFetch() (respuesta "vieja"). */
  holdFetch(): void {
    this.fetchGate = deferred()
  }

  releaseFetch(): void {
    const gate = this.fetchGate
    this.fetchGate = null
    gate?.resolve()
  }

  async fetchAll(sessionId: string): Promise<SelectionRecord[]> {
    this.fetchCalls++
    if (this.failing) throw new Error('network down')
    const snapshot = [...this.rows.values()].filter((r) => r.session_id === sessionId).map((r) => ({ ...r }))
    if (this.fetchGate) await this.fetchGate.promise
    return snapshot
  }

  async upsert(records: SelectionRecord[]): Promise<void> {
    this.upsertCalls.push(records.map((r) => ({ ...r })))
    if (this.gate) await this.gate.promise
    if (this.failing) throw new Error('network down')
    for (const record of records) this.seed(record)
  }
}

/** Reloj controlable que avanza 1 s por lectura salvo que se fije. */
export function steppingClock(startIso = '2026-09-24T10:00:00.000Z') {
  let current = Date.parse(startIso)
  let frozen = false
  return {
    now: () => {
      const value = new Date(current)
      if (!frozen) current += 1000
      return value
    },
    freeze() {
      frozen = true
    },
    set(iso: string) {
      current = Date.parse(iso)
    },
  }
}
