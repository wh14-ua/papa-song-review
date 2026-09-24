import { useEffect, useRef } from 'react'
import { languageLabel, questionLead, yearLabel } from '../labels'
import type { ReviewSong } from '../types'
import { Link } from './Link'
import { ProgressBar } from './ProgressBar'

interface SongCoverProps {
  song: ReviewSong
  total: number
  percent: number
}

/** ¿Se usa el texto de papá como título? (canción dudosa o sin identificar) */
function usesHandwritingTitle(song: ReviewSong): boolean {
  return song.manualReview || !song.title
}

function badgeFor(song: ReviewSong): string | null {
  if (!song.title) return '还没找到这首歌'
  if (song.manualReview) return song.groups.length > 1 ? '❓ 有几首歌都可能是，请您确认' : '❓ 请您确认'
  if (song.needsFatherReview) return '🎧 请听一听，确认是不是这首'
  return null
}

/** Portada roja de la canción: primero QUÉ canción es. */
export function SongCover({ song, total, percent }: SongCoverProps) {
  const headingRef = useRef<HTMLHeadingElement>(null)
  const handwriting = usesHandwritingTitle(song)
  const badge = badgeFor(song)
  const year = yearLabel(song.year)
  const language = languageLabel(song.language)

  // Cada canción monta una portada nueva (key): el foco va al título para
  // que los lectores de pantalla anuncien la canción.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true })
  }, [])

  return (
    <>
      <header className="cover">
        <div className="cover__inner">
          <div className="cover__bar">
            <Link to={{ name: 'home' }} className="cover__home">
              ← 首页
            </Link>
            <p className="cover__count" aria-label={`第 ${song.position} 首，共 ${total} 首`}>
              {song.position} / {total}
            </p>
          </div>
          <ProgressBar percent={percent} tone="on-red" />

          {badge && <p className="cover__badge">{badge}</p>}

          {handwriting ? (
            <>
              <p className="cover__label">您写的是：</p>
              <h1 className="cover__handwriting" tabIndex={-1} ref={headingRef}>
                「{song.sourceText}」
              </h1>
              {song.question && <p className="cover__question">{questionLead(song.question)}</p>}
            </>
          ) : (
            <>
              <h1 className="cover__title" tabIndex={-1} ref={headingRef}>
                {song.title}
              </h1>
              <p className="cover__artist">
                <span>{song.artist}</span>
                {year && <span className="cover__chip">{year}</span>}
                {language && <span className="cover__chip">{language}</span>}
              </p>
            </>
          )}
        </div>
      </header>

      {!handwriting && (
        <div className="note-card">
          <div className="note-card__paper">
            <p className="note-card__label">您原来写的：</p>
            <p className="note-card__text">{song.sourceText}</p>
          </div>
        </div>
      )}
    </>
  )
}
