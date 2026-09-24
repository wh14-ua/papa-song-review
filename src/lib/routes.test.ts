import { describe, expect, it } from 'vitest'
import { parseRoute, routePath } from './routes'

describe('parseRoute', () => {
  it.each([
    ['/', '/', { name: 'home' }],
    ['/index.html', '/', { name: 'home' }],
    ['/song/37', '/', { name: 'song', songId: 37 }],
    ['/song/37/', '/', { name: 'song', songId: 37 }],
    ['/admin', '/', { name: 'admin' }],
    ['/admin/', '/', { name: 'admin' }],
    ['/done', '/', { name: 'done' }],
    ['/list', '/', { name: 'list' }],
    ['/song/abc', '/', { name: 'not-found' }],
    ['/song/0', '/', { name: 'not-found' }],
    ['/song/37/extra', '/', { name: 'not-found' }],
    ['/cualquier-cosa', '/', { name: 'not-found' }],
  ])('%s (base %s)', (pathname, base, expected) => {
    expect(parseRoute(pathname, base)).toEqual(expected)
  })

  it('respeta la base de GitHub Pages', () => {
    expect(parseRoute('/mi-repo/', '/mi-repo/')).toEqual({ name: 'home' })
    expect(parseRoute('/mi-repo', '/mi-repo/')).toEqual({ name: 'home' })
    expect(parseRoute('/mi-repo/song/5', '/mi-repo/')).toEqual({ name: 'song', songId: 5 })
    expect(parseRoute('/mi-repo/admin', '/mi-repo/')).toEqual({ name: 'admin' })
    expect(parseRoute('/otro/admin', '/mi-repo/')).toEqual({ name: 'not-found' })
  })
})

describe('routePath', () => {
  it('construye rutas con la base', () => {
    expect(routePath({ name: 'home' }, '/')).toBe('/')
    expect(routePath({ name: 'song', songId: 37 }, '/')).toBe('/song/37')
    expect(routePath({ name: 'admin' }, '/mi-repo/')).toBe('/mi-repo/admin')
    expect(routePath({ name: 'home' }, '/mi-repo/')).toBe('/mi-repo/')
  })

  it('ida y vuelta: parseRoute(routePath(r)) === r', () => {
    for (const route of [{ name: 'done' }, { name: 'list' }, { name: 'song', songId: 142 }] as const) {
      expect(parseRoute(routePath(route, '/x/'), '/x/')).toEqual(route)
    }
  })
})
