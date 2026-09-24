import { useEffect, useRef, useState } from 'react'
import { describePlayerError, embedUrl, loadYouTubeApi, type PlayerProblem, type YTPlayer } from '../lib/youtube'

const PROBLEM_TEXT: Record<PlayerProblem, string> = {
  'not-embeddable': '这个视频不能在这里播放。请点下面的「在 YouTube 打开」。',
  removed: '这个视频已经没有了（被删除或设为私密）。请选别的版本。',
  failed: '播放出了问题。请点下面的「在 YouTube 打开」。',
}

interface YouTubePlayerProps {
  videoId: string
  title: string
}

/**
 * Reproductor de YouTube. Usa la IFrame API para saber si el vídeo no se puede
 * insertar (y decírselo a papá); si la API no carga, usa un iframe normal.
 */
export function YouTubePlayer({ videoId, title }: YouTubePlayerProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [plainIframe, setPlainIframe] = useState(false)
  const [problem, setProblem] = useState<PlayerProblem | null>(null)

  useEffect(() => {
    const host = hostRef.current
    if (plainIframe || !host) return
    let player: YTPlayer | null = null
    let cancelled = false
    // La API sustituye este div por su iframe: React no debe gestionarlo.
    const target = document.createElement('div')
    host.replaceChildren(target)

    loadYouTubeApi().then(
      (YT) => {
        if (cancelled) return
        player = new YT.Player(target, {
          videoId,
          width: '100%',
          height: '100%',
          playerVars: { autoplay: 1, playsinline: 1, rel: 0 },
          events: {
            onReady: (event) => event.target.getIframe().setAttribute('title', title),
            onError: (event) => setProblem(describePlayerError(event.data)),
          },
        })
      },
      () => {
        if (!cancelled) setPlainIframe(true)
      },
    )

    return () => {
      cancelled = true
      try {
        player?.destroy()
      } catch {
        // ya destruido
      }
      host.replaceChildren()
    }
  }, [videoId, title, plainIframe])

  return (
    <div className="player">
      {plainIframe ? (
        // oxlint-disable-next-line react/iframe-missing-sandbox -- YouTube necesita scripts y su propio origen; el aislamiento lo da el origen cruzado
        <iframe
          className="player__frame"
          src={embedUrl(videoId)}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
        />
      ) : (
        <div ref={hostRef} className="player__frame" />
      )}
      {problem && (
        <p className="player__problem" role="alert">
          {PROBLEM_TEXT[problem]}
        </p>
      )}
    </div>
  )
}
