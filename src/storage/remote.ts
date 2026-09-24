import type { SelectionRecord } from '../types'

/** Almacenamiento remoto de selecciones (Supabase en producción). */
export interface RemoteGateway {
  /** Todas las filas de la sesión. */
  fetchAll(sessionId: string): Promise<SelectionRecord[]>
  /** Upsert por (session_id, song_id). */
  upsert(records: SelectionRecord[]): Promise<void>
}
