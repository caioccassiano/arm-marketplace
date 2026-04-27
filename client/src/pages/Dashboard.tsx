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

  // Agrupar GMV diário por marketplace para o gráfico
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
        <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <span className="text-sm text-gray-400">até</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Cards */}
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
        <div className="mb-8 rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Por Marketplace</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Fonte</th>
                <th className="px-6 py-3 text-right">Pedidos</th>
                <th className="px-6 py-3 text-right">GMV</th>
                <th className="px-6 py-3 text-right">Taxas</th>
                <th className="px-6 py-3 text-right">Frete</th>
                <th className="px-6 py-3 text-right">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary.bySource.map((row, i) => (
                <tr key={i} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium">
                    {marketplaceLabel(row.marketplace ?? row.source)}
                    <span className="ml-2 text-xs text-gray-400">({row.source})</span>
                  </td>
                  <td className="px-6 py-3 text-right">{row.totalOrders}</td>
                  <td className="px-6 py-3 text-right">{fmt(row.totalAmount)}</td>
                  <td className="px-6 py-3 text-right text-red-600">{fmt(row.totalFees)}</td>
                  <td className="px-6 py-3 text-right">{fmt(row.totalShipping)}</td>
                  <td className="px-6 py-3 text-right text-green-700 font-medium">{fmt(row.totalNet)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Gráfico GMV diário */}
      {gmvByDay.length > 0 && (
        <div className="mb-8 rounded-xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="mb-4 font-semibold text-gray-800">GMV Diário por Marketplace</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={gmvByDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} />
              <YAxis
                tick={{ fontSize: 11 }}
                tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip formatter={(v: unknown) => fmt(String(v))} />
              <Legend />
              <Line type="monotone" dataKey="mercado_livre" name="Mercado Livre" stroke="#f59e0b" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="tiktok_shop" name="TikTok Shop" stroke="#3b82f6" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="magazord" name="Magazord" stroke="#10b981" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Conciliações recentes */}
      {summary && summary.recentSessions.length > 0 && (
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-semibold text-gray-800">Conciliações Recentes</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-6 py-3 text-left">Marketplace</th>
                <th className="px-6 py-3 text-left">Período</th>
                <th className="px-6 py-3 text-right">Conciliados</th>
                <th className="px-6 py-3 text-right">Divergências</th>
                <th className="px-6 py-3 text-right">Diff Total</th>
                <th className="px-6 py-3 text-left">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {summary.recentSessions.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-6 py-3 font-medium">{marketplaceLabel(s.marketplace)}</td>
                  <td className="px-6 py-3 text-gray-500">
                    {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                  </td>
                  <td className="px-6 py-3 text-right text-green-700">{s.matchedCount ?? 0}</td>
                  <td className="px-6 py-3 text-right text-red-600">
                    {(s.amountMismatchCount ?? 0) + (s.magazordOnlyCount ?? 0) + (s.marketplaceOnlyCount ?? 0)}
                  </td>
                  <td className="px-6 py-3 text-right">{fmt(s.totalAmountDiff)}</td>
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
