import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ReconciliationItem, type ReconciliationSession } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel, statusLabel, statusColor } from '../lib/utils.ts'
import StatCard from '../components/StatCard.tsx'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

const PIE_COLORS = ['#10b981', '#ef4444', '#f59e0b', '#f97316', '#a855f7']

interface DetailResponse {
  session: ReconciliationSession
  items: ReconciliationItem[]
}

export default function ReconciliationDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [resolveId, setResolveId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  const { data } = useQuery({
    queryKey: ['reconciliation', id],
    queryFn: () => api.get<DetailResponse>(`/reconciliation/${id}`),
  })

  const resolve = useMutation({
    mutationFn: ({ itemId, notes }: { itemId: number; notes: string }) =>
      api.patch(`/reconciliation/items/${itemId}/resolve`, { notes }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reconciliation', id] })
      setResolveId(null)
      setNotes('')
    },
  })

  if (!data) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  const { session, items } = data

  const statusCounts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1
      return acc
    },
    {} as Record<string, number>,
  )

  const pieData = Object.entries(statusCounts).map(([name, value]) => ({
    name: statusLabel(name),
    value,
  }))

  const filtered = filter === 'all' ? items : items.filter((i) => i.status === filter)
  const unresolved = items.filter((i) => i.resolvedAt === null && i.status !== 'matched').length

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/reconciliation" className="text-sm text-gray-400 hover:text-gray-600">
          ← Conciliações
        </Link>
        <span className="text-gray-300">/</span>
        <h2 className="text-xl font-bold text-gray-900">
          {marketplaceLabel(session.marketplace)} — {fmtDate(session.periodStart)} a {fmtDate(session.periodEnd)}
        </h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-4 mb-8">
        <StatCard label="Magazord" value={String(session.totalMagazordOrders ?? 0)} />
        <StatCard label="Marketplace" value={String(session.totalMarketplaceOrders ?? 0)} />
        <StatCard label="Conciliados" value={String(session.matchedCount ?? 0)} color="green" />
        <StatCard
          label="Divergências"
          value={String((session.amountMismatchCount ?? 0) + (session.magazordOnlyCount ?? 0) + (session.marketplaceOnlyCount ?? 0))}
          color="red"
        />
        <StatCard label="Diff Total" value={fmt(session.totalAmountDiff)} color="yellow" sub={`${unresolved} pendentes`} />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Gráfico pizza */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6 flex flex-col items-center">
          <h3 className="font-semibold text-gray-800 mb-4 self-start">Distribuição</h3>
          <PieChart width={220} height={200}>
            <Pie data={pieData} cx={110} cy={100} innerRadius={50} outerRadius={80} dataKey="value">
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(v: unknown, name: unknown) => [String(v), String(name)]} />
            <Legend />
          </PieChart>
        </div>

        {/* Resumo por status */}
        <div className="col-span-2 rounded-xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">Resumo Financeiro</h3>
          <div className="space-y-3">
            {[
              { label: 'Conciliados', key: 'matched' },
              { label: 'Divergência de valor', key: 'amount_mismatch' },
              { label: 'Divergência de taxa', key: 'fee_mismatch' },
              { label: 'Só no Magazord', key: 'magazord_only' },
              { label: 'Só no Marketplace', key: 'marketplace_only' },
            ].map(({ label, key }) => {
              const count = statusCounts[key] ?? 0
              const diffItems = items.filter((i) => i.status === key && i.amountDiff)
              const totalDiff = diffItems.reduce((s, i) => s + parseFloat(i.amountDiff ?? '0'), 0)
              return (
                <div key={key} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(key)}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span className="text-gray-500">{count} itens</span>
                    {totalDiff > 0 && (
                      <span className="text-red-600 font-medium">{fmt(totalDiff)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">Itens da Conciliação</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todos ({items.length})</option>
            {Object.entries(statusCounts).map(([status, count]) => (
              <option key={status} value={status}>
                {statusLabel(status)} ({count})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-right">Valor Magazord</th>
                <th className="px-4 py-3 text-right">Valor Marketplace</th>
                <th className="px-4 py-3 text-right">Diferença</th>
                <th className="px-4 py-3 text-right">Taxa Magazord</th>
                <th className="px-4 py-3 text-right">Taxa Marketplace</th>
                <th className="px-4 py-3 text-left">Notas</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((item) => (
                <tr key={item.id} className={`hover:bg-gray-50/50 ${item.resolvedAt ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                    {item.resolvedAt && (
                      <span className="ml-2 text-xs text-gray-400">✓ resolvido</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{item.magazordAmount ? fmt(item.magazordAmount) : '—'}</td>
                  <td className="px-4 py-3 text-right">{item.marketplaceAmount ? fmt(item.marketplaceAmount) : '—'}</td>
                  <td className={`px-4 py-3 text-right font-medium ${parseFloat(item.amountDiff ?? '0') > 0 ? 'text-red-600' : 'text-gray-400'}`}>
                    {item.amountDiff ? fmt(item.amountDiff) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">{item.magazordFee ? fmt(item.magazordFee) : '—'}</td>
                  <td className="px-4 py-3 text-right">{item.marketplaceFee ? fmt(item.marketplaceFee) : '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{item.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!item.resolvedAt && item.status !== 'matched' && (
                      resolveId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observação..."
                            className="rounded border border-gray-300 px-2 py-1 text-xs w-40 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          <button
                            onClick={() => resolve.mutate({ itemId: item.id, notes })}
                            disabled={resolve.isPending}
                            className="text-xs font-medium text-green-600 hover:text-green-800"
                          >
                            Salvar
                          </button>
                          <button onClick={() => setResolveId(null)} className="text-xs text-gray-400 hover:text-gray-600">
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolveId(item.id)}
                          className="text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          Resolver
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
