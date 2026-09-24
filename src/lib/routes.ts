export type Route =
  | { name: 'home' }
  | { name: 'song'; songId: number }
  | { name: 'done' }
  | { name: 'list' }
  | { name: 'admin' }
  | { name: 'not-found' }

const NOT_FOUND: Route = { name: 'not-found' }

function withTrailingSlash(base: string): string {
  return base.endsWith('/') ? base : `${base}/`
}

/** Convierte location.pathname (con la base de Vite, p. ej. "/mi-repo/") en una ruta. */
export function parseRoute(pathname: string, base: string): Route {
  const root = withTrailingSlash(base)
  let rest: string
  if (pathname === root.slice(0, -1) || pathname === root) rest = ''
  else if (pathname.startsWith(root)) rest = pathname.slice(root.length)
  else return NOT_FOUND

  const segments = rest.split('/').filter(Boolean)
  const [first, second, ...more] = segments
  if (first === undefined || (first === 'index.html' && second === undefined)) return { name: 'home' }
  if (more.length > 0) return NOT_FOUND

  switch (first) {
    case 'admin':
    case 'done':
    case 'list':
      return second === undefined ? { name: first } : NOT_FOUND
    case 'song':
      return second !== undefined && /^[1-9]\d{0,5}$/.test(second) ? { name: 'song', songId: Number(second) } : NOT_FOUND
    default:
      return NOT_FOUND
  }
}

export function routePath(route: Route, base: string): string {
  const root = withTrailingSlash(base)
  switch (route.name) {
    case 'home':
    case 'not-found':
      return root
    case 'song':
      return `${root}song/${route.songId}`
    default:
      return `${root}${route.name}`
  }
}
