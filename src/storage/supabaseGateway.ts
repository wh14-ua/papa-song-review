import type { SupabaseClient } from '@supabase/supabase-js'
import { SELECTIONS_TABLE, type SupabaseSettings } from '../config'
import type { SelectionRecord } from '../types'
import { normalizeRecord } from './localPersistence'
import type { RemoteGateway } from './remote'

const REQUEST_TIMEOUT_MS = 15_000
const COLUMNS = 'session_id,song_id,status,selected_video_id,selected_url,selected_title,notes,created_at,updated_at'

/**
 * Columnas que se envían en el upsert. Las fechas son las del momento de la
 * acción en el móvil (created_at = primera vez, se conserva siempre igual);
 * el id lo pone la base de datos.
 */
export function toUpsertRow(record: SelectionRecord) {
  return {
    session_id: record.session_id,
    song_id: record.song_id,
    status: record.status,
    selected_video_id: record.selected_video_id,
    selected_url: record.selected_url,
    selected_title: record.selected_title,
    notes: record.notes,
    created_at: record.created_at,
    updated_at: record.updated_at,
  }
}

/** fetch con tiempo máximo, para que una red colgada no deje la sync "pensando" para siempre. */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  const outer = init?.signal
  if (outer) {
    if (outer.aborted) controller.abort()
    else outer.addEventListener('abort', () => controller.abort(), { once: true })
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

function describe(error: { message: string; code?: string }): Error {
  return new Error(error.code ? `${error.code}: ${error.message}` : error.message)
}

export function createSupabaseGateway(settings: SupabaseSettings): RemoteGateway {
  let clientPromise: Promise<SupabaseClient> | null = null

  // supabase-js se descarga aparte y solo si hay configuración (la web carga antes).
  const getClient = (): Promise<SupabaseClient> => {
    clientPromise ??= import('@supabase/supabase-js')
      .then(({ createClient }) =>
        createClient(settings.url, settings.key, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: fetchWithTimeout },
        }),
      )
      .catch((error: unknown) => {
        clientPromise = null // p. ej. sin conexión: se reintentará
        throw error
      })
    return clientPromise
  }

  return {
    async fetchAll(sessionId) {
      const client = await getClient()
      const { data, error } = await client.from(SELECTIONS_TABLE).select(COLUMNS).eq('session_id', sessionId).order('song_id')
      if (error) throw describe(error)
      return (data ?? [])
        .map((row: unknown) => normalizeRecord(row, sessionId))
        .filter((r): r is SelectionRecord => r !== null)
    },

    async upsert(records) {
      if (records.length === 0) return
      const client = await getClient()
      const { error } = await client
        .from(SELECTIONS_TABLE)
        .upsert(records.map(toUpsertRow), { onConflict: 'session_id,song_id' })
      if (error) throw describe(error)
    },
  }
}
