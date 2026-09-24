import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FakeRemote, MemoryStorage, steppingClock } from '../test/fakes'
import { createLocalPersistence } from './localPersistence'
import { SelectionStore } from './selectionStore'
import type { SelectionRecord } from '../types'

const VIDEO = { videoId: 'Yl9sIjmaZP8', url: 'https://www.youtube.com/watch?v=Yl9sIjmaZP8', title: '一千个伤心的理由' }

function makeStore(opts: { storage?: MemoryStorage | null; remote?: FakeRemote | null; clock?: ReturnType<typeof steppingClock>; sessionId?: string } = {}) {
  const storage = opts.storage === undefined ? new MemoryStorage() : opts.storage
  const sessionId = opts.sessionId ?? 'papa'
  const store = new SelectionStore({
    sessionId,
    local: createLocalPersistence(storage, sessionId),
    remote: opts.remote ?? null,
    now: (opts.clock ?? steppingClock()).now,
  })
  return { store, storage }
}

function remoteRecord(song_id: number, updated_at: string, overrides: Partial<SelectionRecord> = {}): SelectionRecord {
  return {
    session_id: 'papa',
    song_id,
    status: 'none',
    selected_video_id: null,
    selected_url: null,
    selected_title: null,
    notes: null,
    created_at: updated_at,
    updated_at,
    ...overrides,
  }
}

describe('SelectionStore sin Supabase (localStorage)', () => {
  it('guarda la elección y la recupera al volver a abrir la web', async () => {
    const { store, storage } = makeStore()
    await store.start()
    store.setStatus(37, 'selected', VIDEO)

    const reopened = makeStore({ storage }).store
    await reopened.start()
    expect(reopened.getSnapshot().records[37]).toMatchObject({
      session_id: 'papa',
      song_id: 37,
      status: 'selected',
      selected_video_id: 'Yl9sIjmaZP8',
      selected_url: 'https://www.youtube.com/watch?v=Yl9sIjmaZP8',
      selected_title: '一千个伤心的理由',
    })
  })

  it('permite elegir varias versiones y quitar una o todas', async () => {
    const { store } = makeStore()
    await store.start()
    const other = { videoId: 'lasUoe2Zzyk', url: 'https://www.youtube.com/watch?v=lasUoe2Zzyk', title: 'otra versión' }

    store.setVideoSelections(3, [VIDEO, other])
    expect(store.getSnapshot().records[3]).toMatchObject({
      status: 'selected',
      selected_video_id: 'Yl9sIjmaZP8',
      selected_title: '__multi__:Yl9sIjmaZP8,lasUoe2Zzyk',
    })

    store.setVideoSelections(3, [other])
    expect(store.getSnapshot().records[3]).toMatchObject({
      status: 'selected',
      selected_video_id: 'lasUoe2Zzyk',
      selected_title: '__multi__:lasUoe2Zzyk',
    })

    store.setVideoSelections(3, [])
    expect(store.getSnapshot().records[3]).toMatchObject({
      status: 'skipped',
      selected_video_id: null,
      selected_url: null,
      selected_title: null,
    })
  })

  it('cada sesión tiene su propio progreso', async () => {
    const storage = new MemoryStorage()
    const papa = makeStore({ storage }).store
    await papa.start()
    papa.setStatus(1, 'skipped')

    const other = makeStore({ storage, sessionId: 'prueba' }).store
    await other.start()
    expect(other.getSnapshot().records).toEqual({})
  })

  it('al cambiar de "elegida" a otro estado borra el vídeo pero conserva la nota', async () => {
    const { store } = makeStore()
    await store.start()
    store.setStatus(5, 'selected', VIDEO)
    store.setNotes(5, 'la de 1995')
    store.setStatus(5, 'wrong_song')
    expect(store.getSnapshot().records[5]).toMatchObject({
      status: 'wrong_song',
      selected_video_id: null,
      selected_url: null,
      selected_title: null,
      notes: 'la de 1995',
    })
  })

  it('las notas se recortan, vacías pasan a null y sin estado previo se ignoran', async () => {
    const { store } = makeStore()
    await store.start()
    store.setNotes(8, 'sin estado')
    expect(store.getSnapshot().records[8]).toBeUndefined()
    store.setStatus(8, 'search_more')
    store.setNotes(8, '  李克勤的版本  ')
    expect(store.getSnapshot().records[8]?.notes).toBe('李克勤的版本')
    store.setNotes(8, '   ')
    expect(store.getSnapshot().records[8]?.notes).toBeNull()
  })

  it('updated_at siempre avanza aunque el reloj no cambie', async () => {
    const clock = steppingClock()
    clock.freeze()
    const { store } = makeStore({ clock })
    await store.start()
    store.setStatus(2, 'none')
    const first = store.getSnapshot().records[2]?.updated_at ?? ''
    store.setStatus(2, 'skipped')
    const second = store.getSnapshot().records[2]?.updated_at ?? ''
    expect(Date.parse(second)).toBeGreaterThan(Date.parse(first))
  })

  it('mantiene created_at de la primera acción', async () => {
    const { store } = makeStore()
    await store.start()
    store.setStatus(2, 'none')
    const created = store.getSnapshot().records[2]?.created_at
    store.setStatus(2, 'skipped')
    expect(store.getSnapshot().records[2]?.created_at).toBe(created)
  })

  it('queda en modo local con las selecciones pendientes de subir', async () => {
    const { store } = makeStore()
    await store.start()
    store.setStatus(3, 'none')
    expect(store.getSnapshot()).toMatchObject({ mode: 'local', pendingCount: 1 })
  })

  it('un localStorage corrupto no rompe la web', async () => {
    const storage = new MemoryStorage()
    storage.setItem('cancionero-papa:v1:papa', '{no es json')
    const { store } = makeStore({ storage })
    await store.start()
    expect(store.getSnapshot().records).toEqual({})
    store.setStatus(1, 'none')
    expect(store.getSnapshot().records[1]?.status).toBe('none')
  })

  it('sin localStorage disponible sigue funcionando en memoria y lo indica', async () => {
    const { store } = makeStore({ storage: null })
    await store.start()
    store.setStatus(1, 'none')
    expect(store.getSnapshot().records[1]?.status).toBe('none')
    expect(store.getSnapshot().localAvailable).toBe(false)
  })

  it('si localStorage falla al escribir (cuota), lo indica sin perder el estado en memoria', async () => {
    const storage = new MemoryStorage()
    const { store } = makeStore({ storage })
    await store.start()
    storage.failWrites = true
    store.setStatus(1, 'none')
    expect(store.getSnapshot().records[1]?.status).toBe('none')
    expect(store.getSnapshot().localAvailable).toBe(false)
  })
})

describe('SelectionStore con Supabase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('cada pulsación hace upsert inmediatamente', async () => {
    const remote = new FakeRemote()
    const { store } = makeStore({ remote })
    await store.start()
    store.setStatus(37, 'selected', VIDEO)
    await store.flush()
    expect(remote.upsertCalls).toHaveLength(1)
    expect(remote.rows.get('papa:37')).toMatchObject({ status: 'selected', selected_video_id: 'Yl9sIjmaZP8' })
    expect(store.getSnapshot()).toMatchObject({ mode: 'supabase', pendingCount: 0, phase: 'synced' })
  })

  it('si Supabase falla, conserva la selección pendiente (también tras recargar) y la reintenta', async () => {
    const remote = new FakeRemote()
    const storage = new MemoryStorage()
    const { store } = makeStore({ remote, storage })
    await store.start()
    remote.failing = true
    store.setStatus(9, 'search_more')
    await store.flush()
    expect(store.getSnapshot()).toMatchObject({ phase: 'error', pendingCount: 1 })

    // Se cierra la web con el fallo pendiente y se vuelve a abrir más tarde.
    const reopened = makeStore({ remote, storage }).store
    await reopened.start()
    expect(reopened.getSnapshot().pendingCount).toBe(1)

    remote.failing = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(remote.rows.get('papa:9')?.status).toBe('search_more')
    expect(reopened.getSnapshot().pendingCount).toBe(0)
  })

  it('al configurar Supabase sube el progreso que se hizo solo en local', async () => {
    const storage = new MemoryStorage()
    const localOnly = makeStore({ storage }).store
    await localOnly.start()
    localOnly.setStatus(1, 'wrong_song')
    localOnly.setStatus(3, 'selected', VIDEO)

    const remote = new FakeRemote()
    const withSupabase = makeStore({ storage, remote }).store
    await withSupabase.start()
    expect([...remote.rows.keys()].sort()).toEqual(['papa:1', 'papa:3'])
    expect(withSupabase.getSnapshot().pendingCount).toBe(0)
  })

  it('registra la hora de sincronización también cuando solo descarga', async () => {
    const remote = new FakeRemote()
    const { store } = makeStore({ remote })
    await store.start()
    expect(store.getSnapshot()).toMatchObject({ phase: 'synced', pendingCount: 0 })
    expect(store.getSnapshot().lastSyncedAt).not.toBeNull()
  })

  it('carga el progreso guardado en Supabase desde otro dispositivo', async () => {
    const remote = new FakeRemote()
    remote.seed(remoteRecord(44, '2026-09-20T08:00:00.000Z', { status: 'selected', selected_video_id: 'abc', selected_url: 'https://www.youtube.com/watch?v=abc' }))
    const { store } = makeStore({ remote })
    await store.start()
    expect(store.getSnapshot().records[44]?.status).toBe('selected')
    expect(store.getSnapshot().initialLoad).toBe('done')
  })

  it('en conflicto gana el cambio más reciente (remoto más nuevo que el pendiente local)', async () => {
    const storage = new MemoryStorage()
    const clock = steppingClock('2026-09-24T10:00:00.000Z')
    const offline = makeStore({ storage, clock }).store
    await offline.start()
    offline.setStatus(7, 'skipped') // local, 10:00

    const remote = new FakeRemote()
    remote.seed(remoteRecord(7, '2026-09-24T11:00:00.000Z', { status: 'none' }))
    const { store } = makeStore({ storage, remote, clock })
    await store.start()
    expect(store.getSnapshot().records[7]?.status).toBe('none')
    expect(remote.rows.get('papa:7')?.status).toBe('none')
  })

  it('en conflicto gana el cambio más reciente (pendiente local más nuevo que el remoto)', async () => {
    const storage = new MemoryStorage()
    const clock = steppingClock('2026-09-24T12:00:00.000Z')
    const offline = makeStore({ storage, clock }).store
    await offline.start()
    offline.setStatus(7, 'skipped') // local, 12:00

    const remote = new FakeRemote()
    remote.seed(remoteRecord(7, '2026-09-24T11:00:00.000Z', { status: 'none' }))
    const { store } = makeStore({ storage, remote, clock })
    await store.start()
    expect(store.getSnapshot().records[7]?.status).toBe('skipped')
    expect(remote.rows.get('papa:7')?.status).toBe('skipped')
  })

  it('una fila ya sincronizada que falta en Supabase se vuelve a subir (nunca se pierde)', async () => {
    const storage = new MemoryStorage()
    const remote = new FakeRemote()
    const first = makeStore({ storage, remote }).store
    await first.start()
    first.setStatus(12, 'none')
    await first.flush()
    remote.rows.clear() // p. ej. se cambió de proyecto Supabase

    const second = makeStore({ storage, remote }).store
    await second.start()
    expect(remote.rows.get('papa:12')?.status).toBe('none')
  })

  it('un cambio hecho mientras se envía otro no se pierde', async () => {
    const remote = new FakeRemote()
    const { store } = makeStore({ remote })
    await store.start()
    remote.hold()
    store.setStatus(20, 'none')
    const inFlight = store.flush()
    store.setStatus(20, 'selected', VIDEO)
    remote.release()
    await inFlight
    await store.flush()
    expect(remote.rows.get('papa:20')).toMatchObject({ status: 'selected', selected_video_id: 'Yl9sIjmaZP8' })
    expect(store.getSnapshot().pendingCount).toBe(0)
  })

  it('una descarga lenta con datos viejos no pisa una elección más reciente', async () => {
    const remote = new FakeRemote()
    remote.seed(remoteRecord(15, '2026-09-24T09:00:00.000Z', { status: 'none' }))
    const { store } = makeStore({ remote, clock: steppingClock('2026-09-24T10:00:00.000Z') })
    remote.holdFetch()
    const starting = store.start()
    // La descarga ya ha leído la tabla (fila 15 antigua) pero aún no ha respondido.
    await vi.waitFor(() => expect(remote.fetchCalls).toBe(1))
    store.setStatus(15, 'selected', VIDEO)
    await store.flush()
    remote.releaseFetch()
    await starting
    await store.flush()
    expect(store.getSnapshot().records[15]?.status).toBe('selected')
    expect(remote.rows.get('papa:15')?.status).toBe('selected')
  })

  it('si la carga inicial falla, usa lo local y lo vuelve a intentar', async () => {
    const remote = new FakeRemote()
    remote.failing = true
    remote.seed(remoteRecord(30, '2026-09-20T08:00:00.000Z', { status: 'wrong_song' }))
    const { store } = makeStore({ remote })
    await store.start()
    expect(store.getSnapshot()).toMatchObject({ initialLoad: 'failed', phase: 'error' })

    remote.failing = false
    await vi.advanceTimersByTimeAsync(60_000)
    expect(store.getSnapshot().records[30]?.status).toBe('wrong_song')
    expect(store.getSnapshot().initialLoad).toBe('done')
  })

  it('ignora filas remotas con un estado desconocido', async () => {
    const remote = new FakeRemote()
    remote.seed(remoteRecord(50, '2026-09-20T08:00:00.000Z', { status: 'borrado' as never }))
    const { store } = makeStore({ remote })
    await store.start()
    expect(store.getSnapshot().records[50]).toBeUndefined()
  })
})
