import { OTHER_STATUSES, STATUS_LABELS } from '../labels'
import type { SelectionStatus } from '../types'

interface StatusActionsProps {
  current: SelectionStatus | undefined
  hasVersions: boolean
  onChoose: (status: (typeof OTHER_STATUSES)[number]) => void
}

export function StatusActions({ current, hasVersions, onChoose }: StatusActionsProps) {
  return (
    <section className="status-actions" aria-labelledby="status-actions-title">
      <h2 id="status-actions-title" className="section-title">
        {hasVersions ? '如果都不合适' : '请选一项'}
      </h2>
      <div className="status-grid">
        {OTHER_STATUSES.map((status) => {
          const label = STATUS_LABELS[status]
          const active = current === status
          return (
            <button
              key={status}
              type="button"
              className={active ? 'status-btn status-btn--active' : 'status-btn'}
              aria-pressed={active}
              onClick={() => onChoose(status)}
            >
              <span className="status-btn__zh">
                <span aria-hidden="true">{label.icon}</span> {label.zh}
              </span>
              <span className="status-btn__es" lang="es">
                {label.es}
              </span>
            </button>
          )
        })}
      </div>
    </section>
  )
}
