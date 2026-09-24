import { useEffect, useMemo, useState } from 'react'
import { useSelections } from '../app/contexts'
import { CassetteMark } from '../components/CassetteMark'
import { Link } from '../components/Link'
import { ProgressBar } from '../components/ProgressBar'
import { StatsSummary } from '../components/StatsSummary'
import { StorageWarning } from '../components/StorageWarning'
import { computeStats, findResumeSongId } from '../data/progress'
import type { ReviewCatalog } from '../types'

const REMOTE_WAIT_MS = 6000

/** true mientras `active` y como mucho REMOTE_WAIT_MS (luego se muestra lo local). */
function useBriefWait(active: boolean): boolean {
  const [expired, setExpired] = useState(false)
  useEffect(() => {
    if (!active) return
    const timer = window.setTimeout(() => setExpired(true), REMOTE_WAIT_MS)
    return () => window.clearTimeout(timer)
  }, [active])
  return active && !expired
}

export function HomeScreen({ catalog }: { catalog: ReviewCatalog }) {
  const { records, initialLoad } = useSelections()
  const stats = useMemo(() => computeStats(catalog.songs, records), [catalog, records])
  const resumeId = findResumeSongId(catalog.songs, records)
  const firstId = catalog.songs[0]?.id
  const hasProgress = stats.untouched < stats.total
  // En un móvil nuevo, esperar un momento al progreso guardado en Supabase.
  const waiting = useBriefWait(initialLoad === 'loading' && !hasProgress)

  return (
    <div className="screen screen--home">
      <header className="home-cover">
        <div className="home-cover__inner">
          <CassetteMark className="home-cover__mark" />
          <h1 className="home-cover__title">爸爸的歌单</h1>
          <p className="home-cover__text">
            这些歌是之前记下来的。
            <br />
            请听一下每个版本，然后选您想要的那个。
          </p>

          <div className="home-cover__actions">
            {waiting ? (
              <output className="home-cover__loading">
                <span className="spinner" aria-hidden="true" /> 正在读取您的进度…
              </output>
            ) : !hasProgress ? (
              firstId !== undefined && (
                <Link to={{ name: 'song', songId: firstId }} className="btn btn--on-red">
                  开始
                </Link>
              )
            ) : (
              <>
                {resumeId !== null ? (
                  <Link to={{ name: 'song', songId: resumeId }} className="btn btn--on-red">
                    <span>继续上次</span>
                    <span className="btn__count">
                      {stats.done} / {stats.total}
                    </span>
                  </Link>
                ) : (
                  <Link to={{ name: 'done' }} className="btn btn--on-red">
                    🎉 全部完成了，看总结
                  </Link>
                )}
                {firstId !== undefined && (
                  <Link to={{ name: 'song', songId: firstId }} className="btn btn--on-red-outline">
                    从头查看
                  </Link>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="page">
        <StorageWarning />
        {hasProgress && (
          <section className="panel" aria-labelledby="progress-title">
            <h2 id="progress-title" className="section-title">
              您的进度
            </h2>
            <ProgressBar percent={stats.percent} />
            <StatsSummary stats={stats} />
          </section>
        )}
        <p className="hint">您选的会自动保存。随时可以关掉，下次打开会接着上次。</p>
        <Link to={{ name: 'list' }} className="btn btn--secondary btn--block">
          📋 查看全部歌曲
        </Link>
      </main>
    </div>
  )
}
