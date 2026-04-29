interface Props {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'green' | 'red' | 'yellow'
}

const borderColors = {
  default: 'var(--border-strong)',
  green: 'var(--arm)',
  red: 'var(--status-error)',
  yellow: 'var(--status-warn)',
}

const bgColors = {
  default: 'var(--bg-surface)',
  green: 'rgba(124, 194, 58, 0.06)',
  red: 'rgba(220, 38, 38, 0.05)',
  yellow: 'rgba(217, 119, 6, 0.05)',
}

export default function StatCard({ label, value, sub, color = 'default' }: Props) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        backgroundColor: bgColors[color],
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColors[color]}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 text-3xl font-bold tabular-nums"
        style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
      >
        {value}
      </p>
      {sub && (
        <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>
          {sub}
        </p>
      )}
    </div>
  )
}
