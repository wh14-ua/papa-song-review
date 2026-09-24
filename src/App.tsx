import { useCallback, useEffect, useState } from 'react'
import { ServicesContext, ToastContext, type AppServices } from './app/contexts'
import { useCatalog } from './app/useCatalog'
import { Toast, type ToastMessage } from './components/Toast'
import { navigate, useRoute } from './lib/router'
import type { Route } from './lib/routes'
import { AdminScreen } from './screens/AdminScreen'
import { DoneScreen } from './screens/DoneScreen'
import { HomeScreen } from './screens/HomeScreen'
import { ReviewScreen } from './screens/ReviewScreen'
import { SongListScreen } from './screens/SongListScreen'
import { ErrorScreen, LoadingScreen, NotFoundScreen } from './screens/StatusScreens'
import type { ReviewCatalog } from './types'

const TOAST_MS = 2600

function Screen({ route, catalog }: { route: Route; catalog: ReviewCatalog }) {
  const canonicalId =
    route.name === 'song' && !catalog.byId.has(route.songId)
      ? (catalog.rawById.get(route.songId)?.duplicate_of ?? null)
      : null

  // /song/11 (un duplicado) → su canción canónica.
  useEffect(() => {
    if (canonicalId !== null) navigate({ name: 'song', songId: canonicalId }, { replace: true })
  }, [canonicalId])

  switch (route.name) {
    case 'home':
      return <HomeScreen catalog={catalog} />
    case 'song': {
      const song = catalog.byId.get(route.songId)
      if (song) return <ReviewScreen key={song.id} catalog={catalog} song={song} />
      return canonicalId !== null ? null : <NotFoundScreen />
    }
    case 'done':
      return <DoneScreen catalog={catalog} />
    case 'list':
      return <SongListScreen catalog={catalog} />
    case 'admin':
      return <AdminScreen catalog={catalog} />
    case 'not-found':
      return <NotFoundScreen />
  }
}

export function App({ services }: { services: AppServices }) {
  const route = useRoute()
  const { state, retry } = useCatalog()
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const showToast = useCallback((text: string) => {
    setToast((previous) => ({ id: (previous?.id ?? 0) + 1, text }))
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), TOAST_MS)
    return () => window.clearTimeout(timer)
  }, [toast])

  return (
    <ServicesContext.Provider value={services}>
      <ToastContext.Provider value={showToast}>
        {state.status === 'loading' && <LoadingScreen />}
        {state.status === 'error' && <ErrorScreen message={state.message} onRetry={retry} />}
        {state.status === 'ready' && <Screen route={route} catalog={state.catalog} />}
        <Toast message={toast} />
      </ToastContext.Provider>
    </ServicesContext.Provider>
  )
}
