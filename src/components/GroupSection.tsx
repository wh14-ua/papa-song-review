import type { ReactNode } from 'react'
import { yearLabel } from '../labels'
import type { InterpretationGroup } from '../types'

export type GroupMode =
  /** manual_review: "可能是 A / B / C…" */
  | 'choice'
  /** Canción identificada con alternativas: "最可能是" / "也可能是" */
  | 'likely'
  /** Un único grupo: sin cabecera */
  | 'single'

interface GroupSectionProps {
  group: InterpretationGroup
  mode: GroupMode
  children: ReactNode
  /** Para opciones sin vídeo: "就是这首，请帮我找" */
  onRequestSearch?: () => void
}

/** Luego, dentro de cada posible canción, QUÉ grabación. */
export function GroupSection({ group, mode, children, onRequestSearch }: GroupSectionProps) {
  const year = yearLabel(group.year)
  const headingId = `group-${group.letter}`
  const kicker = mode === 'choice' ? '可能是' : group.isMain ? '最可能是这首' : '也可能是这首'

  return (
    <section className="group" aria-labelledby={mode === 'single' ? undefined : headingId}>
      {mode !== 'single' && (
        <header className="group__header">
          {mode === 'choice' && (
            <span className="group__letter" aria-hidden="true">
              {group.letter}
            </span>
          )}
          <div className="group__heading">
            <p className="group__kicker">
              {kicker}
              {mode === 'choice' && <span className="sr-only"> {group.letter}</span>}
            </p>
            <h3 className="group__title" id={headingId}>
              {group.title ? `《${group.title}》` : '（歌名不详）'}
            </h3>
            {(group.artist || year) && (
              <p className="group__artist">
                {group.artist && <span>{group.artist}</span>}
                {year && <span className="group__year">{year}</span>}
              </p>
            )}
          </div>
        </header>
      )}

      {group.candidates.length > 0 ? (
        <div className="group__cards">{children}</div>
      ) : (
        <div className="group__empty">
          <p>YouTube 上没有找到这一首的视频。</p>
          {onRequestSearch && (
            <button type="button" className="btn btn--secondary" onClick={onRequestSearch}>
              🔎 就是这首，请帮我找
            </button>
          )}
        </div>
      )}
    </section>
  )
}
