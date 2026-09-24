/** Casete: el emblema de la portada (mismo dibujo que el favicon). */
export function CassetteMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 44" width="64" height="44" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="60" height="40" rx="5" fill="none" stroke="currentColor" strokeWidth="3" />
      <rect x="11" y="10" width="42" height="15" rx="7.5" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="20" cy="17.5" r="4" fill="currentColor" />
      <circle cx="44" cy="17.5" r="4" fill="currentColor" />
      <path d="M16 42 L20 32 H44 L48 42" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" />
    </svg>
  )
}
