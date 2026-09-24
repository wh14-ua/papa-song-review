interface ProgressBarProps {
  percent: number
  tone?: 'on-red' | 'on-paper'
}

export function ProgressBar({ percent, tone = 'on-paper' }: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, percent))
  return (
    <div className={`progress progress--${tone}`}>
      <progress className="progress__track" value={clamped} max={100} aria-label="已完成" />
      <span className="progress__text" aria-hidden="true">
        已完成 {clamped}%
      </span>
    </div>
  )
}
