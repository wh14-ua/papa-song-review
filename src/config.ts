/**
 * Configuración central.
 *
 * - Sesión de revisión: por defecto "papa". Se puede cambiar con la variable
 *   VITE_REVIEW_SESSION_ID o, para hacer pruebas sin tocar el progreso de papá,
 *   abriendo la web con ?session=prueba (se recuerda en esa pestaña).
 * - Supabase: VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY. Sin ellas la web
 *   funciona igual guardando en el navegador (localStorage).
 */

export const DEFAULT_SESSION_ID = 'papa'

/** Nombre de la tabla en Supabase. */
export const SELECTIONS_TABLE = 'song_selections'

const SESSION_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

function validSession(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && SESSION_PATTERN.test(trimmed) ? trimmed : null
}

export function pickSessionId(input: {
  search: string
  remembered: string | null
  envDefault: string | undefined
}): string {
  const fromUrl = validSession(new URLSearchParams(input.search).get('session'))
  return fromUrl ?? validSession(input.remembered) ?? validSession(input.envDefault) ?? DEFAULT_SESSION_ID
}

const SESSION_TAB_KEY = 'cancionero-papa:session'

/** Resuelve la sesión en el navegador y recuerda ?session= en la pestaña. */
export function resolveBrowserSessionId(): string {
  let remembered: string | null = null
  try {
    remembered = sessionStorage.getItem(SESSION_TAB_KEY)
  } catch {
    // sessionStorage bloqueado: no pasa nada
  }
  const sessionId = pickSessionId({
    search: window.location.search,
    remembered,
    envDefault: import.meta.env.VITE_REVIEW_SESSION_ID,
  })
  if (new URLSearchParams(window.location.search).has('session')) {
    try {
      sessionStorage.setItem(SESSION_TAB_KEY, sessionId)
    } catch {
      // ignorar
    }
  }
  return sessionId
}

/* ------------------------------------------------------------------ */
/* Supabase                                                            */
/* ------------------------------------------------------------------ */

export interface SupabaseSettings {
  url: string
  key: string
}

export type SupabaseConfig =
  | { status: 'ok'; settings: SupabaseSettings }
  /** Sin variables: modo local */
  | { status: 'missing' }
  /** Solo una de las dos variables */
  | { status: 'incomplete' }
  | { status: 'invalid-url' }
  /** Se ha puesto una service_role / secret key: NO se usa */
  | { status: 'forbidden-key' }

function jwtRole(key: string): string | null {
  const parts = key.split('.')
  if (parts.length !== 3 || !parts[1]) return null
  try {
    const base64 = parts[1].replaceAll('-', '+').replaceAll('_', '/')
    const payload: unknown = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '=')))
    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      return typeof payload.role === 'string' ? payload.role : null
    }
  } catch {
    // no es un JWT legible
  }
  return null
}

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:') return true
    return parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')
  } catch {
    return false
  }
}

export function readSupabaseConfig(env: { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }): SupabaseConfig {
  const url = env.VITE_SUPABASE_URL?.trim() ?? ''
  const key = env.VITE_SUPABASE_ANON_KEY?.trim() ?? ''
  if (!url && !key) return { status: 'missing' }
  if (!url || !key) return { status: 'incomplete' }
  if (key.startsWith('sb_secret_') || jwtRole(key) === 'service_role') return { status: 'forbidden-key' }
  if (!isAllowedUrl(url)) return { status: 'invalid-url' }
  return { status: 'ok', settings: { url: url.replace(/\/+$/, ''), key } }
}
