import { useSelections } from '../app/contexts'

interface BottomNavProps {
  hasPrev: boolean
  isLast: boolean
  /** La canción actual ya tiene respuesta: "下一首" pasa a ser el botón principal */
  answered: boolean
  onPrev: () => void
  onNext: () => void
}

export function BottomNav({ hasPrev, isLast, answered, onPrev, onNext }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="换歌">
      <div className="bottom-nav__inner">
        <button type="button" className="btn btn--nav btn--secondary" onClick={onPrev} disabled={!hasPrev}>
          <span>← 上一首</span>
          <span className="btn__es">Anterior</span>
        </button>
        <SyncBadge />
        <button
          type="button"
          className={answered ? 'btn btn--nav btn--primary' : 'btn btn--nav btn--secondary'}
          onClick={onNext}
        >
          <span>{isLast ? '看总结' : '下一首 →'}</span>
          <span className="btn__es">{isLast ? 'Resumen' : 'Siguiente'}</span>
        </button>
      </div>
    </nav>
  )
}

/** Solo aparece si hay cambios que todavía no se han podido subir. */
function SyncBadge() {
  const { mode, phase, pendingCount } = useSelections()
  if (mode !== 'supabase' || pendingCount === 0 || phase !== 'error') return null
  return (
    <span className="sync-badge" title="已保存在这台手机上，有网络时会自动上传">
      ⏳ 待上传 {pendingCount}
    </span>
  )
}
