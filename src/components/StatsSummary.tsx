import type { ProgressStats } from '../data/progress'

/** Resumen para papá: ✅ ❌ ❓ 🔎 ⏭️ */
export function StatsSummary({ stats }: { stats: ProgressStats }) {
  const items = [
    { icon: '✅', label: '已选好', es: 'elegidas', value: stats.selected },
    { icon: '❌', label: '都不是', es: 'ninguna', value: stats.none },
    { icon: '❓', label: '不是这首歌', es: 'incorrectas', value: stats.wrong_song },
    { icon: '🔎', label: '再找找', es: 'buscar más', value: stats.search_more },
    { icon: '⏭️', label: '还没选', es: 'pendientes', value: stats.pending },
  ]
  return (
    <ul className="stats">
      {items.map((item) => (
        <li key={item.label} className="stats__item">
          <span className="stats__icon" aria-hidden="true">
            {item.icon}
          </span>
          <span className="stats__label">
            {item.label}
            <span className="stats__es" lang="es">
              {item.es}
            </span>
          </span>
          <span className="stats__value">{item.value}</span>
        </li>
      ))}
    </ul>
  )
}
