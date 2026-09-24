import { describe, expect, it } from 'vitest'
import { DEFAULT_SESSION_ID, pickSessionId, readSupabaseConfig } from './config'

function b64url(value: object): string {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function jwtWithRole(role: string): string {
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ iss: 'supabase', ref: 'abcd', role })}.firma`
}

describe('pickSessionId', () => {
  it('por defecto la sesión es "papa"', () => {
    expect(DEFAULT_SESSION_ID).toBe('papa')
    expect(pickSessionId({ search: '', remembered: null, envDefault: undefined })).toBe('papa')
  })

  it('la variable de entorno cambia la sesión por defecto', () => {
    expect(pickSessionId({ search: '', remembered: null, envDefault: 'mama' })).toBe('mama')
  })

  it('?session= en la URL tiene prioridad, y si no, la recordada en la pestaña', () => {
    expect(pickSessionId({ search: '?session=prueba', remembered: 'otra', envDefault: 'mama' })).toBe('prueba')
    expect(pickSessionId({ search: '', remembered: 'otra', envDefault: 'mama' })).toBe('otra')
  })

  it('ignora identificadores con caracteres raros', () => {
    expect(pickSessionId({ search: '?session=a%20b', remembered: '../x', envDefault: '<script>' })).toBe('papa')
  })
})

describe('readSupabaseConfig', () => {
  const url = 'https://abcd.supabase.co'

  it('sin variables → modo local', () => {
    expect(readSupabaseConfig({})).toEqual({ status: 'missing' })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: ' ', VITE_SUPABASE_ANON_KEY: '' })).toEqual({ status: 'missing' })
  })

  it('con solo una de las dos variables → incompleto', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: url })).toEqual({ status: 'incomplete' })
  })

  it('acepta la anon key (JWT con role anon) y la publishable key', () => {
    const anon = jwtWithRole('anon')
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: `${url}/`, VITE_SUPABASE_ANON_KEY: anon })).toEqual({
      status: 'ok',
      settings: { url, key: anon },
    })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' })).toMatchObject({
      status: 'ok',
    })
  })

  it('rechaza una service_role key o una secret key', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: jwtWithRole('service_role') })).toEqual({
      status: 'forbidden-key',
    })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: url, VITE_SUPABASE_ANON_KEY: 'sb_secret_abc' })).toEqual({
      status: 'forbidden-key',
    })
  })

  it('rechaza URLs que no sean https (salvo localhost para Supabase local)', () => {
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://abcd.supabase.co', VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' })).toEqual({
      status: 'invalid-url',
    })
    expect(readSupabaseConfig({ VITE_SUPABASE_URL: 'http://127.0.0.1:54321', VITE_SUPABASE_ANON_KEY: 'sb_publishable_abc' })).toMatchObject({
      status: 'ok',
    })
  })
})
