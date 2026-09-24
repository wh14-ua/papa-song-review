import { useMemo } from 'react'
import { useSelections } from '../app/contexts'
import { Link } from '../components/Link'
import { ProgressBar } from '../components/ProgressBar'
import { StatsSummary } from '../components/StatsSummary'
import { computeStats, findResumeSongId } from '../data/progress'
import type { ReviewCatalog } from '../types'

export function DoneScreen({ catalog }: { catalog: ReviewCatalog }) {
  const { records } = useSelections()
  const stats = useMemo(() => computeStats(catalog.songs, records), [catalog, records])
  const resumeId = findResumeSongId(catalog.songs, records)
  const allDone = stats.pending === 0
  const firstId = catalog.songs[0]?.id

  return (
    <div className="screen screen--done">
      <header className="home-cover home-cover--short">
        <div className="home-cover__inner">
          <h1 className="home-cover__title">{allDone ? '完成了 🎉' : '还差一点'}</h1>
          <p className="home-cover__text">
            {allDone ? '辛苦了！所有的歌都选完了。' : `还有 ${stats.pending} 首没有选好。`}
          </p>
          {!allDone && resumeId !== null && (
            <div className="home-cover__actions">
              <Link to={{ name: 'song', songId: resumeId }} className="btn btn--on-red">
                继续选
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="page">
        <section className="panel" aria-labelledby="summary-title">
          <h2 id="summary-title" className="section-title">
            总结
          </h2>
          <ProgressBar percent={stats.percent} />
          <StatsSummary stats={stats} />
        </section>
        <div className="link-stack">
          {firstId !== undefined && (
            <Link to={{ name: 'song', songId: firstId }} className="btn btn--secondary btn--block">
              从头查看
            </Link>
          )}
          <Link to={{ name: 'list' }} className="btn btn--secondary btn--block">
            📋 查看全部歌曲
          </Link>
          <Link to={{ name: 'home' }} className="btn btn--quiet btn--block">
            回到首页
          </Link>
        </div>
      </main>
    </div>
  )
}
