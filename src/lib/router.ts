import { useMemo, useSyncExternalStore } from 'react'
import { parseRoute, routePath, type Route } from './routes'

const BASE = import.meta.env.BASE_URL
const NAVIGATE_EVENT = 'cancionero:navigate'

function subscribe(onChange: () => void): () => void {
  window.addEventListener('popstate', onChange)
  window.addEventListener(NAVIGATE_EVENT, onChange)
  return () => {
    window.removeEventListener('popstate', onChange)
    window.removeEventListener(NAVIGATE_EVENT, onChange)
  }
}

function currentPath(): string {
  return window.location.pathname
}

export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, currentPath)
  return useMemo(() => parseRoute(pathname, BASE), [pathname])
}

export function hrefFor(route: Route): string {
  return routePath(route, BASE)
}

/**
 * Cambia de pantalla. Entre canciones se usa replace para que el botón "atrás"
 * del móvil vuelva a la portada en lugar de recorrer las 121 canciones.
 */
export function navigate(route: Route, options: { replace?: boolean } = {}): void {
  const path = routePath(route, BASE)
  if (path !== window.location.pathname) {
    if (options.replace) window.history.replaceState(null, '', path)
    else window.history.pushState(null, '', path)
  }
  window.dispatchEvent(new Event(NAVIGATE_EVENT))
  // Cada pantalla empieza arriba.
  window.scrollTo(0, 0)
}
