import { useMemo, useState } from 'react'
import { useSelections } from '../app/contexts'
import { Link } from '../components/Link'
import { computeStats, isDone } from '../data/progress'
import { STATUS_LABELS } from '../labels'
import type { ReviewCatalog } from '../types'

/** Lista de las 121 canciones para saltar directamente a cualquiera. */
export function SongListScreen({ catalog }: { catalog: ReviewCatalog }) {
  const { records } = useSelections()
  const [onlyPending, setOnlyPending] = useState(false)
  const stats = useMemo(() => computeStats(catalog.songs, records), [catalog, records])
  const visible = onlyPending ? catalog.songs.filter((s) => !isDone(records[s.id]?.status)) : catalog.songs

  return (
    <div className="screen screen--list">
      <header className="mini-cover">
        <div className="mini-cover__inner">
          <Link to={{ name: 'home' }} className="cover__home">
            ← 首页
          </Link>
          <h1 className="mini-cover__title">全部歌曲</h1>
        </div>
      </header>

      <main className="page">
        <fieldset className="segmented">
          <legend className="sr-only">显示哪些歌</legend>
          <button type="button" aria-pressed={!onlyPending} onClick={() => setOnlyPending(false)}>
            全部 {stats.total}
          </button>
          <button type="button" aria-pressed={onlyPending} onClick={() => setOnlyPending(true)}>
            还没选 {stats.pending}
          </button>
        </fieldset>

        {visible.length === 0 ? (
          <p className="empty-state__text">都选好了 🎉</p>
        ) : (
          <ol className="song-list">
            {visible.map((song) => {
              const status = records[song.id]?.status
              const showTitle = Boolean(song.title) && !song.manualReview
              return (
                <li key={song.id}>
                  <Link to={{ name: 'song', songId: song.id }} className="song-list__row">
                    <span className="song-list__num">{song.position}</span>
                    <span className="song-list__main">
                      <span className="song-list__title">{showTitle ? song.title : `「${song.sourceText}」`}</span>
                      {showTitle && song.artist && <span className="song-list__artist">{song.artist}</span>}
                    </span>
                    <span className="song-list__status">
                      <span aria-hidden="true">{status ? STATUS_LABELS[status].icon : ''}</span>
                      <span className="sr-only">{status ? STATUS_LABELS[status].zh : '还没选'}</span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </main>
    </div>
  )
}
