import { useCallback, useEffect, useRef, useState } from 'react'
import { buildCatalog, parseDataset } from '../data/catalog'
import type { ReviewCatalog } from '../types'

export type CatalogState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; catalog: ReviewCatalog }

const SONGS_URL = `${import.meta.env.BASE_URL}songs.json`

/** Carga public/songs.json (la fuente de verdad) y construye las 121 canciones a revisar. */
export function useCatalog(): { state: CatalogState; retry: () => void } {
  const [state, setState] = useState<CatalogState>({ status: 'loading' })
  const controllerRef = useRef<AbortController | null>(null)

  const load = useCallback(() => {
    controllerRef.current?.abort()
    const controller = new AbortController()
    controllerRef.current = controller
    fetch(SONGS_URL, { signal: controller.signal, cache: 'no-cache' })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`)
        return response.json() as Promise<unknown>
      })
      .then((json) => {
        setState({ status: 'ready', catalog: buildCatalog(parseDataset(json)) })
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setState({ status: 'error', message: error instanceof Error ? error.message : String(error) })
      })
  }, [])

  useEffect(() => {
    load()
    return () => controllerRef.current?.abort()
  }, [load])

  const retry = useCallback(() => {
    setState({ status: 'loading' })
    load()
  }, [load])

  return { state, retry }
}
