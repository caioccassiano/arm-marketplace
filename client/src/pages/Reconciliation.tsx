import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type ReconciliationSession } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel, statusLabel, statusColor } from '../lib/utils.ts'
import { format, subDays } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

export default function Reconciliation() {
  const [marketplace, setMarketplace] = useState<'mercado_livre' | 'tiktok_shop'>('mercado_livre')
  const [periodStart, setPeriodStart] = useState(sevenDaysAgo)
  const [periodEnd, setPeriodEnd] = useState(today)
  const [creating, setCreating] = useState(false)
  const [syncSource, setSyncSource] = useState<'all' | 'magazord' | 'mercado_livre' | 'tiktok_shop'>('all')
  const [syncing, setSyncing] = useState(false)

  const { data: sessions, refetch } = useQuery({
    queryKey: ['reconciliation'],
    queryFn: () => api.get<ReconciliationSession[]>('/reconciliation'),
    refetchInterval: 5000,
  })

  async function handleCreate() {
    setCreating(true)
    try {
      await api.post('/reconciliation', { marketplace, periodStart, periodEnd })
      await refetch()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro ao criar conciliação')
    } finally {
      setCreating(false)
    }
  }

  async function handleSync() {
    setSyncing(true)
    try {
      const res = await api.post<{ synced: Record<string, number> }>('/sync', {
        source: syncSource,
        dateFrom: periodStart,
        dateTo: periodEnd,
      })
      const msg = Object.entries(res.synced)
        .map(([k, v]) => `${k}: ${v} pedidos`)
        .join('\n')
      alert(`Sincronização concluída!\n${msg}`)
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erro na sincronização')
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Conciliação Financeira</h2>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Sincronizar dados */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">1. Sincronizar Pedidos</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Fonte</label>
              <select
                value={syncSource}
                onChange={(e) => setSyncSource(e.target.value as typeof syncSource)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">Todas as fontes</option>
                <option value="magazord">Magazord</option>
                <option value="mercado_livre">Mercado Livre</option>
                <option value="tiktok_shop">TikTok Shop</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full rounded-lg bg-gray-800 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-60 transition-colors"
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        </div>

        {/* Nova conciliação */}
        <div className="rounded-xl bg-white shadow-sm border border-gray-100 p-6">
          <h3 className="font-semibold text-gray-800 mb-4">2. Nova Conciliação</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Marketplace</label>
              <select
                value={marketplace}
                onChange={(e) => setMarketplace(e.target.value as typeof marketplace)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="mercado_livre">Mercado Livre</option>
                <option value="tiktok_shop">TikTok Shop</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">De</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-500 mb-1">Até</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {creating ? 'Criando...' : 'Iniciar Conciliação'}
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de sessões */}
      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Histórico de Conciliações</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-6 py-3 text-left">Marketplace</th>
              <th className="px-6 py-3 text-left">Período</th>
              <th className="px-6 py-3 text-right">Magazord</th>
              <th className="px-6 py-3 text-right">Marketplace</th>
              <th className="px-6 py-3 text-right">Conciliados</th>
              <th className="px-6 py-3 text-right">Divergências</th>
              <th className="px-6 py-3 text-right">Diff</th>
              <th className="px-6 py-3 text-left">Status</th>
              <th className="px-6 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {sessions?.map((s) => (
              <tr key={s.id} className="hover:bg-gray-50/50">
                <td className="px-6 py-3 font-medium">{marketplaceLabel(s.marketplace)}</td>
                <td className="px-6 py-3 text-gray-500">
                  {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                </td>
                <td className="px-6 py-3 text-right">{s.totalMagazordOrders ?? '—'}</td>
                <td className="px-6 py-3 text-right">{s.totalMarketplaceOrders ?? '—'}</td>
                <td className="px-6 py-3 text-right text-green-700">{s.matchedCount ?? '—'}</td>
                <td className="px-6 py-3 text-right text-red-600">
                  {s.status === 'completed'
                    ? (s.amountMismatchCount ?? 0) + (s.magazordOnlyCount ?? 0) + (s.marketplaceOnlyCount ?? 0)
                    : '—'}
                </td>
                <td className="px-6 py-3 text-right">{s.totalAmountDiff ? fmt(s.totalAmountDiff) : '—'}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  {s.status === 'completed' && (
                    <Link
                      to={`/reconciliation/${s.id}`}
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Ver detalhes →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!sessions?.length && (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-sm text-gray-400">
                  Nenhuma conciliação criada ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
