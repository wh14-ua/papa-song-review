import { useMemo, useState } from 'react'
import { useSelections, useServices, useToast } from '../app/contexts'
import { BottomNav } from '../components/BottomNav'
import { CandidateCard } from '../components/CandidateCard'
import { GroupSection, type GroupMode } from '../components/GroupSection'
import { Link } from '../components/Link'
import { NoteEditor } from '../components/NoteEditor'
import { SongCover } from '../components/SongCover'
import { StatusActions } from '../components/StatusActions'
import { StorageWarning } from '../components/StorageWarning'
import { adjacentSongIds, computeStats } from '../data/progress'
import { selectedVideoIds } from '../data/selectionCodec'
import { OTHER_STATUSES, STATUS_LABELS } from '../labels'
import { navigate } from '../lib/router'
import type { InterpretationGroup, ReviewCatalog, ReviewSong, YoutubeCandidate } from '../types'

interface ReviewScreenProps {
  catalog: ReviewCatalog
  song: ReviewSong
}

export function ReviewScreen({ catalog, song }: ReviewScreenProps) {
  const { store } = useServices()
  const { records } = useSelections()
  const showToast = useToast()
  const record = records[song.id]
  const stats = useMemo(() => computeStats(catalog.songs, records), [catalog, records])
  const { prev, next } = adjacentSongIds(catalog.songs, song.id)
  const [playingId, setPlayingId] = useState<string | null>(null)
  const [noteOpen, setNoteOpen] = useState(false)
  const selectedIds = useMemo(() => selectedVideoIds(record), [record])

  const groupMode: GroupMode = song.manualReview ? 'choice' : song.groups.length > 1 ? 'likely' : 'single'
  // "版本 N" continúa entre grupos: primer número de cada grupo.
  const firstNumber = useMemo(() => {
    const starts: number[] = []
    let count = 0
    for (const group of song.groups) {
      starts.push(count + 1)
      count += group.candidates.length
    }
    return starts
  }, [song])

  const goTo = (songId: number | null) => {
    setPlayingId(null)
    if (songId === null) navigate({ name: 'done' }, { replace: true })
    else navigate({ name: 'song', songId }, { replace: true })
  }

  const choose = (candidate: YoutubeCandidate, number: number) => {
    const alreadySelected = selectedIds.includes(candidate.video_id)
    const nextIds = alreadySelected
      ? selectedIds.filter((id) => id !== candidate.video_id)
      : [...selectedIds, candidate.video_id]
    const videos = nextIds
      .map((id) => song.candidates.find((item) => item.video_id === id))
      .filter((item): item is YoutubeCandidate => item !== undefined)
      .map((item) => ({ videoId: item.video_id, url: item.url, title: item.title }))
    store.setVideoSelections(song.id, videos)
    showToast(
      alreadySelected
        ? nextIds.length > 0
          ? `✓ 已取消版本 ${number}，还选了 ${nextIds.length} 个`
          : '✓ 已取消选择，这首歌稍后再选'
        : `✓ 已保存：已选 ${nextIds.length} 个版本`,
    )
  }

  const mark = (status: (typeof OTHER_STATUSES)[number]) => {
    store.setStatus(song.id, status)
    if (status === 'skipped') {
      showToast('⏭️ 已跳过，以后再听')
      goTo(next)
      return
    }
    showToast(`✓ 已保存：${STATUS_LABELS[status].zh}`)
    setNoteOpen(true)
  }

  const saveNote = (text: string) => {
    // Escribir una nota sin haber elegido nada equivale a "再找找".
    if (!store.getSnapshot().records[song.id]) store.setStatus(song.id, 'search_more')
    store.setNotes(song.id, text)
  }

  const requestSearch = (group: InterpretationGroup) => {
    const hint = `可能是 ${group.letter}：《${group.title ?? ''}》${group.artist ?? ''}`
    const previousNotes = store.getSnapshot().records[song.id]?.notes ?? null
    store.setStatus(song.id, 'search_more')
    if (!previousNotes?.includes(hint)) store.setNotes(song.id, previousNotes ? `${hint}\n${previousNotes}` : hint)
    showToast(`✓ 已记下：请帮您找 ${group.letter}`)
  }

  const hasVersions = song.candidates.length > 0

  return (
    <div className="screen screen--review">
      <SongCover song={song} total={catalog.songs.length} percent={stats.percent} />

      <main className="page page--review">
        <StorageWarning />

        {song.groups.length > 0 ? (
          <section className="versions" aria-labelledby="versions-title">
            <h2 id="versions-title" className="section-title">
              {groupMode === 'choice' && song.groups.length > 1
                ? '先确定是哪一首歌，再选一个或多个版本'
                : '请听一听，可以选择一个或多个版本'}
            </h2>
            {song.groups.map((group, groupIndex) => (
              <GroupSection
                key={group.ref}
                group={group}
                mode={groupMode}
                onRequestSearch={groupMode === 'choice' ? () => requestSearch(group) : undefined}
              >
                {group.candidates.map((candidate, index) => {
                  const number = (firstNumber[groupIndex] ?? 1) + index
                  return (
                    <CandidateCard
                      key={candidate.video_id}
                      candidate={candidate}
                      number={number}
                      selected={selectedIds.includes(candidate.video_id)}
                      playing={playingId === candidate.video_id}
                      onPlay={() => setPlayingId(candidate.video_id)}
                      onStop={() => setPlayingId(null)}
                      onChoose={() => choose(candidate, number)}
                    />
                  )
                })}
              </GroupSection>
            ))}
          </section>
        ) : (
          <section className="empty-state">
            <p className="empty-state__text">YouTube 上还没有找到这首歌的视频。</p>
            {song.searchUrl && (
              <a className="btn btn--secondary" href={song.searchUrl} target="_blank" rel="noopener noreferrer">
                🔎 在 YouTube 上搜索
              </a>
            )}
          </section>
        )}

        <StatusActions current={record?.status} hasVersions={hasVersions} onChoose={mark} />

        {record?.status === 'search_more' && hasVersions && song.searchUrl && (
          <p className="search-link">
            <a href={song.searchUrl} target="_blank" rel="noopener noreferrer">
              也可以自己在 YouTube 上搜索这首歌
            </a>
          </p>
        )}

        <NoteEditor
          status={record?.status}
          notes={record?.notes ?? null}
          open={noteOpen}
          onOpenChange={setNoteOpen}
          onSave={saveNote}
        />

        {stats.pending === 0 && (
          <p className="all-done">
            🎉 全部选完了！ <Link to={{ name: 'done' }}>看总结</Link>
          </p>
        )}
      </main>

      <BottomNav
        hasPrev={prev !== null}
        isLast={next === null}
        answered={record !== undefined}
        onPrev={() => {
          if (prev !== null) goTo(prev)
        }}
        onNext={() => goTo(next)}
      />
    </div>
  )
}
