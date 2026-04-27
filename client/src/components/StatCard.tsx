interface Props {
  label: string
  value: string
  sub?: string
  color?: 'default' | 'green' | 'red' | 'yellow'
}

const colors = {
  default: 'border-gray-200',
  green: 'border-green-400',
  red: 'border-red-400',
  yellow: 'border-yellow-400',
}

export default function StatCard({ label, value, sub, color = 'default' }: Props) {
  return (
    <div className={`rounded-xl border-l-4 bg-white px-5 py-4 shadow-sm ${colors[color]}`}>
      <p className="text-xs font-medium uppercase tracking-wide text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-800">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
