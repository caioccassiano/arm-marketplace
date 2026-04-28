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

export default function StatCard({ label, value, sub, color = 'default' }: Props) {
  return (
    <div
      className="rounded-xl px-5 py-4"
      style={{
        backgroundColor: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColors[color]}`,
      }}
    >
      <p
        className="text-[10px] font-medium uppercase tracking-widest"
        style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}
      >
        {label}
      </p>
      <p
        className="mt-1.5 text-2xl font-semibold tabular-nums"
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
