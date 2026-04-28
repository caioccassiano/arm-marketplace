import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { api, type SummaryRow, type GmvDaily, type ReconciliationSession } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel, statusLabel, statusColor } from '../lib/utils.ts'
import StatCard from '../components/StatCard.tsx'
import { format, subDays } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

interface SummaryResponse {
  bySource: SummaryRow[]
  recentSessions: ReconciliationSession[]
}

const inputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: '0.5rem',
  padding: '0.375rem 0.75rem',
  fontSize: '0.875rem',
  outline: 'none',
}

export default function Dashboard() {
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)

  const { data: summary } = useQuery({
    queryKey: ['reports/summary', dateFrom, dateTo],
    queryFn: () =>
      api.get<SummaryResponse>(`/reports/summary?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  })

  const { data: gmv } = useQuery({
    queryKey: ['reports/gmv-daily', dateFrom, dateTo],
    queryFn: () =>
      api.get<GmvDaily[]>(`/reports/gmv-daily?dateFrom=${dateFrom}&dateTo=${dateTo}`),
  })

  const totalGmv = summary?.bySource.reduce((s, r) => s + parseFloat(r.totalAmount ?? '0'), 0) ?? 0
  const totalFees = summary?.bySource.reduce((s, r) => s + parseFloat(r.totalFees ?? '0'), 0) ?? 0
  const totalNet = summary?.bySource.reduce((s, r) => s + parseFloat(r.totalNet ?? '0'), 0) ?? 0
  const totalOrders = summary?.bySource.reduce((s, r) => s + r.totalOrders, 0) ?? 0

  const gmvByDay = Object.values(
    (gmv ?? []).reduce(
      (acc, row) => {
        const key = row.day
        if (!acc[key]) acc[key] = { day: row.day }
        const mp = row.source === 'magazord' ? 'magazord' : (row.marketplace ?? row.source)
        acc[key][mp] = (parseFloat(acc[key][mp] ?? '0') + parseFloat(row.totalAmount ?? '0')).toFixed(2)
        return acc
      },
      {} as Record<string, Record<string, string>>,
    ),
  ).sort((a, b) => a['day']!.localeCompare(b['day']!))

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Dashboard
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            style={inputStyle}
          />
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            style={inputStyle}
          />
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <StatCard label="GMV Total" value={fmt(totalGmv)} sub={`${totalOrders} pedidos`} />
        <StatCard label="Taxas Marketplace" value={fmt(totalFees)} color="red" />
        <StatCard label="Receita Líquida" value={fmt(totalNet)} color="green" />
        <StatCard
          label="% Taxas / GMV"
          value={totalGmv > 0 ? `${((totalFees / totalGmv) * 100).toFixed(1)}%` : '—'}
          color="yellow"
        />
      </div>

      {/* Tabela por marketplace */}
      {summary && summary.bySource.length > 0 && (
        <div
          className="mb-8 rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3
              className="font-semibold text-sm"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
            >
              Por Marketplace
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Fonte', 'Pedidos', 'GMV', 'Taxas', 'Frete', 'Líquido'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 0 ? 'text-left' : 'text-right'}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.bySource.map((row, i) => (
                <tr
                  key={i}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-6 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {marketplaceLabel(row.marketplace ?? row.source)}
                    <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>
                      ({row.source})
                    </span>
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {row.totalOrders}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(row.totalAmount)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--status-error)' }}>
                    {fmt(row.totalFees)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                    {fmt(row.totalShipping)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums font-medium" style={{ color: 'var(--arm)' }}>
                    {fmt(row.totalNet)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico GMV diário */}
      {gmvByDay.length > 0 && (
        <div
          className="mb-8 rounded-xl p-6"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <h3
            className="mb-4 font-semibold text-sm"
            style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
          >
            GMV Diário por Marketplace
          </h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gmvByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  fontSize: '12px',
                  color: 'var(--text-primary)',
                }}
                formatter={(v: unknown) => fmt(String(v))}
              />
              <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--text-secondary)' }} />
              <Line type="monotone" dataKey="mercado_livre" name="Mercado Livre" stroke="#C97C2A" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tiktok_shop" name="TikTok Shop" stroke="#4B8EE8" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="magazord" name="Magazord" stroke="#7CC23A" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conciliações recentes */}
      {summary && summary.recentSessions.length > 0 && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <h3
              className="font-semibold text-sm"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
            >
              Conciliações Recentes
            </h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Marketplace', 'Período', 'Conciliados', 'Divergências', 'Diff Total', 'Status'].map((h, i) => (
                  <th
                    key={h}
                    className={`px-6 py-3 text-[10px] font-medium uppercase tracking-widest ${i < 2 || i === 5 ? 'text-left' : 'text-right'}`}
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summary.recentSessions.map((s) => (
                <tr
                  key={s.id}
                  className="transition-colors"
                  style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-6 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                    {marketplaceLabel(s.marketplace)}
                  </td>
                  <td className="px-6 py-3" style={{ color: 'var(--text-secondary)' }}>
                    {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--arm)' }}>
                    {s.matchedCount ?? 0}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--status-error)' }}>
                    {(s.amountMismatchCount ?? 0) + (s.magazordOnlyCount ?? 0) + (s.marketplaceOnlyCount ?? 0)}
                  </td>
                  <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    {fmt(s.totalAmountDiff)}
                  </td>
                  <td className="px-6 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(s.status)}`}>
                      {statusLabel(s.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
