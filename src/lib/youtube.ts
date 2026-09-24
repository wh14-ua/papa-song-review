/** Miniatura 480×360 (existe para todos los vídeos); se recorta a 16:9 con CSS. */
export function thumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
}

export function embedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}?autoplay=1&playsinline=1&rel=0`
}

/* ------------------------------------------------------------------ */
/* YouTube IFrame Player API (solo lo que usamos)                      */
/* ------------------------------------------------------------------ */

export interface YTPlayer {
  destroy(): void
  getIframe(): HTMLIFrameElement
}

interface YTPlayerOptions {
  videoId: string
  width?: string | number
  height?: string | number
  playerVars?: Record<string, string | number>
  events?: {
    onReady?: (event: { target: YTPlayer }) => void
    onError?: (event: { data: number }) => void
  }
}

export interface YTNamespace {
  Player: new (element: HTMLElement, options: YTPlayerOptions) => YTPlayer
}

declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}

let apiPromise: Promise<YTNamespace> | null = null

/**
 * Carga https://www.youtube.com/iframe_api una sola vez. Se usa para detectar
 * vídeos con la inserción desactivada (errores 101/150). Si no carga a tiempo,
 * se rechaza y el reproductor usa un iframe normal.
 */
export function loadYouTubeApi(timeoutMs = 8000): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  apiPromise ??= new Promise<YTNamespace>((resolve, reject) => {
    const fail = (error: Error) => {
      window.clearTimeout(timer)
      apiPromise = null
      reject(error)
    }
    const timer = window.setTimeout(() => fail(new Error('YouTube API timeout')), timeoutMs)
    const previous = window.onYouTubeIframeAPIReady
    window.onYouTubeIframeAPIReady = () => {
      previous?.()
      window.clearTimeout(timer)
      if (window.YT?.Player) resolve(window.YT)
      else fail(new Error('YouTube API unavailable'))
    }
    const script = document.createElement('script')
    script.src = 'https://www.youtube.com/iframe_api'
    script.async = true
    script.addEventListener(
      'error',
      () => {
        script.remove()
        fail(new Error('YouTube API failed to load'))
      },
      { once: true },
    )
    document.head.appendChild(script)
  })
  return apiPromise
}

export type PlayerProblem = 'not-embeddable' | 'removed' | 'failed'

/** Códigos de error de la IFrame API → qué decirle a papá. */
export function describePlayerError(code: number): PlayerProblem {
  if (code === 101 || code === 150 || code === 153) return 'not-embeddable'
  if (code === 100) return 'removed'
  return 'failed'
}
