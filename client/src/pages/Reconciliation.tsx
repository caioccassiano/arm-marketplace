import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api, type ReconciliationSession } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel, statusLabel, statusColor } from '../lib/utils.ts'
import { format, subDays } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const sevenDaysAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd')

const inputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: '0.5rem',
  padding: '0.375rem 0.75rem',
  fontSize: '0.875rem',
  width: '100%',
  outline: 'none',
}

const labelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--text-muted)',
  marginBottom: '0.25rem',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.05em',
}

const cardStyle = {
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: '0.75rem',
  padding: '1.5rem',
}

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
      <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
        Conciliação Financeira
      </h2>

      <div className="grid grid-cols-2 gap-6 mb-8">
        {/* Sincronizar dados */}
        <div style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>1. Sincronizar Pedidos</h3>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Fonte</label>
              <select value={syncSource} onChange={(e) => setSyncSource(e.target.value as typeof syncSource)} style={inputStyle}>
                <option value="all">Todas as fontes</option>
                <option value="magazord">Magazord</option>
                <option value="mercado_livre">Mercado Livre</option>
                <option value="tiktok_shop">TikTok Shop</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label style={labelStyle}>De</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
              </div>
              <div className="flex-1">
                <label style={labelStyle}>Até</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}
            >
              {syncing ? 'Sincronizando...' : 'Sincronizar'}
            </button>
          </div>
        </div>

        {/* Nova conciliação */}
        <div style={cardStyle}>
          <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>2. Nova Conciliação</h3>
          <div className="space-y-3">
            <div>
              <label style={labelStyle}>Marketplace</label>
              <select value={marketplace} onChange={(e) => setMarketplace(e.target.value as typeof marketplace)} style={inputStyle}>
                <option value="mercado_livre">Mercado Livre</option>
                <option value="tiktok_shop">TikTok Shop</option>
              </select>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label style={labelStyle}>De</label>
                <input type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} style={inputStyle} />
              </div>
              <div className="flex-1">
                <label style={labelStyle}>Até</label>
                <input type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} style={inputStyle} />
              </div>
            </div>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="btn-primary w-full rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-60 transition-colors"
            >
              {creating ? 'Criando...' : 'Iniciar Conciliação'}
            </button>
          </div>
        </div>
      </div>

      {/* Histórico de sessões */}
      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Histórico de Conciliações</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Marketplace', 'Período', 'Magazord', 'Marketplace', 'Conciliados', 'Divergências', 'Diff', 'Status', ''].map((h, i) => (
                <th key={i} className={`px-6 py-3 text-[10px] font-medium uppercase tracking-widest ${i >= 2 && i <= 6 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions?.map((s) => (
              <tr key={s.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <td className="px-6 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>{marketplaceLabel(s.marketplace)}</td>
                <td className="px-6 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {fmtDate(s.periodStart)} – {fmtDate(s.periodEnd)}
                </td>
                <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.totalMagazordOrders ?? '—'}</td>
                <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{s.totalMarketplaceOrders ?? '—'}</td>
                <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--arm)' }}>{s.matchedCount ?? '—'}</td>
                <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--status-error)' }}>
                  {s.status === 'completed'
                    ? (s.amountMismatchCount ?? 0) + (s.magazordOnlyCount ?? 0) + (s.marketplaceOnlyCount ?? 0)
                    : '—'}
                </td>
                <td className="px-6 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{s.totalAmountDiff ? fmt(s.totalAmountDiff) : '—'}</td>
                <td className="px-6 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(s.status)}`}>
                    {statusLabel(s.status)}
                  </span>
                </td>
                <td className="px-6 py-3 text-right">
                  {s.status === 'completed' && (
                    <Link to={`/reconciliation/${s.id}`} className="text-xs font-medium transition-colors" style={{ color: 'var(--arm)' }}>
                      Ver detalhes →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
            {!sessions?.length && (
              <tr>
                <td colSpan={9} className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
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
