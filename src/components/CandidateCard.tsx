import { useState } from 'react'
import { typeLabel } from '../labels'
import { thumbnailUrl } from '../lib/youtube'
import type { YoutubeCandidate } from '../types'
import { YouTubePlayer } from './YouTubePlayer'

interface CandidateCardProps {
  candidate: YoutubeCandidate
  /** "版本 N" (numeración continua en toda la canción) */
  number: number
  selected: boolean
  playing: boolean
  onPlay: () => void
  onStop: () => void
  onChoose: () => void
}

export function CandidateCard({ candidate, number, selected, playing, onPlay, onStop, onChoose }: CandidateCardProps) {
  const [thumbBroken, setThumbBroken] = useState(false)

  return (
    <article className={selected ? 'card card--selected' : 'card'} aria-label={`版本 ${number}`}>
      <div className="card__media">
        {playing ? (
          <YouTubePlayer videoId={candidate.video_id} title={candidate.title} />
        ) : (
          <button type="button" className="thumb" onClick={onPlay} aria-label={`播放版本 ${number}`}>
            {!thumbBroken && (
              <img
                src={thumbnailUrl(candidate.video_id)}
                alt=""
                loading="lazy"
                decoding="async"
                onError={() => setThumbBroken(true)}
              />
            )}
            <span className="thumb__play" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="30" height="30">
                <path d="M8 5.5v13l11-6.5z" fill="currentColor" />
              </svg>
            </span>
          </button>
        )}
      </div>

      <div className="card__body">
        <div className="card__tags">
          <span className="card__number">版本 {number}</span>
          <span className="tag">{typeLabel(candidate.type)}</span>
          {selected && <span className="tag tag--chosen">✅ 已选</span>}
        </div>
        <p className="card__title">{candidate.title}</p>
        <p className="card__meta">歌手：{candidate.artist || '不详'}</p>
        {candidate.channel && <p className="card__meta card__meta--soft">频道：{candidate.channel}</p>}

        <div className="card__row">
          <button
            type="button"
            className="btn btn--secondary"
            onClick={playing ? onStop : onPlay}
            aria-pressed={playing}
          >
            {playing ? '■ 停止' : '▶ 听一听'}
          </button>
          <a className="btn btn--quiet" href={candidate.url} target="_blank" rel="noopener noreferrer">
            在 YouTube 打开
          </a>
        </div>

        <button
          type="button"
          className={selected ? 'btn btn--chosen btn--block' : 'btn btn--primary btn--block'}
          onClick={onChoose}
          aria-pressed={selected}
        >
          <span>{selected ? '✅ 已选这个' : '✅ 就这个'}</span>
          <span className="btn__es">{selected ? 'Elegida' : 'Elegir esta'}</span>
        </button>
      </div>
    </article>
  )
}
