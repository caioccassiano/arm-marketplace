import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, type ReconciliationItem, type ReconciliationSession } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel, statusLabel, statusColor } from '../lib/utils.ts'
import StatCard from '../components/StatCard.tsx'
import { PieChart, Pie, Cell, Tooltip, Legend } from 'recharts'

const PIE_COLORS = ['#7CC23A', '#E5534B', '#C97C2A', '#4B8EE8', '#8A8A94']
const PAGE_SIZE = 20

interface StatusSummaryRow {
  status: string
  count: number
  totalDiff: string | null
}

interface DetailResponse {
  session: ReconciliationSession
  summary: StatusSummaryRow[]
  unresolvedCount: number
}

interface ItemsResponse {
  items: ReconciliationItem[]
  total: number
  page: number
  limit: number
}

export default function ReconciliationDetail() {
  const { id } = useParams<{ id: string }>()
  const qc = useQueryClient()
  const [filter, setFilter] = useState<string>('all')
  const [page, setPage] = useState(1)
  const [resolveId, setResolveId] = useState<number | null>(null)
  const [notes, setNotes] = useState('')

  // Reset page on filter change
  useEffect(() => { setPage(1) }, [filter])

  const { data } = useQuery({
    queryKey: ['reconciliation', id],
    queryFn: () => api.get<DetailResponse>(`/reconciliation/${id}`),
  })

  const { data: itemsData, isFetching: itemsFetching } = useQuery({
    queryKey: ['reconciliation', id, 'items', page, filter],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), status: filter })
      return api.get<ItemsResponse>(`/reconciliation/${id}/items?${params}`)
    },
    enabled: !!id,
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
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" style={{ borderColor: 'var(--arm)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  const { session, summary, unresolvedCount } = data

  const statusCounts = Object.fromEntries(summary.map((r) => [r.status, r.count]))
  const pieData = summary.map((r) => ({ name: statusLabel(r.status), value: r.count }))

  const totalFiltered = itemsData?.total ?? 0
  const totalPages = Math.ceil(totalFiltered / PAGE_SIZE)
  const fromItem = totalFiltered > 0 ? (page - 1) * PAGE_SIZE + 1 : 0
  const toItem = Math.min(page * PAGE_SIZE, totalFiltered)

  const cardStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }
  const inputStyle = {
    backgroundColor: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
    borderRadius: '0.375rem',
    padding: '0.25rem 0.5rem',
    fontSize: '0.75rem',
    width: '10rem',
    outline: 'none',
  }

  return (
    <div>
      <div className="mb-6 flex items-center gap-3">
        <Link to="/reconciliation" className="text-sm transition-colors" style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--text-secondary)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}>
          ← Conciliações
        </Link>
        <span style={{ color: 'var(--border-strong)' }}>/</span>
        <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
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
        <StatCard label="Diff Total" value={fmt(session.totalAmountDiff)} color="yellow" sub={`${unresolvedCount} pendentes`} />
      </div>

      <div className="grid grid-cols-3 gap-6 mb-8">
        {/* Gráfico pizza */}
        <div className="rounded-xl p-6 flex flex-col items-center" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4 self-start" style={{ color: 'var(--text-primary)' }}>Distribuição</h3>
          <PieChart width={220} height={200}>
            <Pie data={pieData} cx={110} cy={100} innerRadius={50} outerRadius={80} dataKey="value">
              {pieData.map((_, i) => (
                <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(v: unknown, name: unknown) => [String(v), String(name)]}
              contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: '0.5rem', color: 'var(--text-primary)' }}
            />
            <Legend wrapperStyle={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }} />
          </PieChart>
        </div>

        {/* Resumo por status */}
        <div className="col-span-2 rounded-xl p-6" style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Resumo Financeiro</h3>
          <div className="space-y-3">
            {[
              { label: 'Conciliados', key: 'matched' },
              { label: 'Divergência de valor', key: 'amount_mismatch' },
              { label: 'Divergência de taxa', key: 'fee_mismatch' },
              { label: 'Só no Magazord', key: 'magazord_only' },
              { label: 'Só no Marketplace', key: 'marketplace_only' },
            ].map(({ label, key }) => {
              const row = summary.find((r) => r.status === key)
              const cnt = row?.count ?? 0
              const totalDiff = parseFloat(row?.totalDiff ?? '0')
              return (
                <div key={key} className="flex items-center justify-between py-1.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(key)}`}>
                      {label}
                    </span>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <span style={{ color: 'var(--text-muted)' }}>{cnt} itens</span>
                    {totalDiff > 0 && (
                      <span className="font-medium tabular-nums" style={{ color: 'var(--status-error)' }}>{fmt(totalDiff)}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Tabela de itens */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <div className="px-6 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Itens da Conciliação</h3>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              backgroundColor: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-primary)',
              borderRadius: '0.5rem',
              padding: '0.25rem 0.75rem',
              fontSize: '0.875rem',
              outline: 'none',
            }}
          >
            <option value="all">Todos</option>
            {summary.map((r) => (
              <option key={r.status} value={r.status}>
                {statusLabel(r.status)} ({r.count})
              </option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Status', 'Valor Magazord', 'Valor Marketplace', 'Diferença', 'Taxa Magazord', 'Taxa Marketplace', 'Notas', ''].map((h, i) => (
                  <th key={i} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i >= 1 && i <= 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itemsFetching ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Carregando…
                  </td>
                </tr>
              ) : (itemsData?.items ?? []).map((item) => (
                <tr key={item.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)', opacity: item.resolvedAt ? 0.4 : 1 }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(item.status)}`}>
                      {statusLabel(item.status)}
                    </span>
                    {item.resolvedAt && (
                      <span className="ml-2 text-xs" style={{ color: 'var(--text-muted)' }}>✓ resolvido</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.magazordAmount ? fmt(item.magazordAmount) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.marketplaceAmount ? fmt(item.marketplaceAmount) : '—'}</td>
                  <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: parseFloat(item.amountDiff ?? '0') > 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
                    {item.amountDiff ? fmt(item.amountDiff) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.magazordFee ? fmt(item.magazordFee) : '—'}</td>
                  <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{item.marketplaceFee ? fmt(item.marketplaceFee) : '—'}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate" style={{ color: 'var(--text-muted)' }}>{item.notes ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {!item.resolvedAt && item.status !== 'matched' && (
                      resolveId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Observação..."
                            style={inputStyle}
                          />
                          <button
                            onClick={() => resolve.mutate({ itemId: item.id, notes })}
                            disabled={resolve.isPending}
                            className="text-xs font-medium transition-colors"
                            style={{ color: 'var(--arm-text)' }}
                          >
                            Salvar
                          </button>
                          <button onClick={() => setResolveId(null)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setResolveId(item.id)}
                          className="text-xs font-medium transition-colors"
                          style={{ color: 'var(--arm-text)' }}
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

        {/* Pagination */}
        {totalFiltered > 0 && (
          <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Mostrando {fromItem}–{toItem} de {totalFiltered} itens
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => p - 1)}
                disabled={page === 1 || itemsFetching}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                ← Anterior
              </button>
              <span className="px-3 text-xs tabular-nums" style={{ color: 'var(--text-muted)' }}>
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= totalPages || itemsFetching}
                className="rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-40"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
              >
                Próxima →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
