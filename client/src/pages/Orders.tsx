import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, type Order } from '../lib/api.ts'
import { fmt, fmtDate, marketplaceLabel } from '../lib/utils.ts'
import { format, subDays } from 'date-fns'

const today = format(new Date(), 'yyyy-MM-dd')
const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd')

interface OrdersResponse {
  data: Order[]
  page: number
  limit: number
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

export default function Orders() {
  const [source, setSource] = useState('')
  const [dateFrom, setDateFrom] = useState(thirtyDaysAgo)
  const [dateTo, setDateTo] = useState(today)
  const [page, setPage] = useState(1)

  const params = new URLSearchParams({ page: String(page), limit: '50' })
  if (source) params.set('source', source)
  if (dateFrom) params.set('dateFrom', dateFrom)
  if (dateTo) params.set('dateTo', dateTo)

  const { data, isLoading } = useQuery({
    queryKey: ['orders', source, dateFrom, dateTo, page],
    queryFn: () => api.get<OrdersResponse>(`/orders?${params}`),
  })

  const statusColor = (status: string): React.CSSProperties => {
    const map: Record<string, React.CSSProperties> = {
      paid: { backgroundColor: 'rgba(124,194,58,0.15)', color: '#7CC23A' },
      delivered: { backgroundColor: 'rgba(75,142,232,0.15)', color: '#4B8EE8' },
      cancelled: { backgroundColor: 'rgba(229,83,75,0.15)', color: '#E5534B' },
      pending: { backgroundColor: 'rgba(201,124,42,0.15)', color: '#C97C2A' },
    }
    return map[status] ?? { backgroundColor: 'rgba(82,82,92,0.3)', color: '#8A8A94' }
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Pedidos</h2>

      <div className="mb-6 flex items-center gap-3">
        <select value={source} onChange={(e) => { setSource(e.target.value); setPage(1) }} style={inputStyle}>
          <option value="">Todas as fontes</option>
          <option value="magazord">Magazord</option>
          <option value="mercado_livre">Mercado Livre</option>
          <option value="tiktok_shop">TikTok Shop</option>
        </select>
        <input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setPage(1) }} style={inputStyle} />
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>até</span>
        <input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setPage(1) }} style={inputStyle} />
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Nº Pedido', 'Fonte', 'Cliente', 'Status', 'Total', 'Taxa', 'Frete', 'Líquido', 'Data'].map((h, i) => (
                <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i >= 4 && i <= 7 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Carregando...</td></tr>
            )}
            {data?.data.map((order) => (
              <tr key={order.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {order.orderNumber ?? order.externalId}
                </td>
                <td className="px-4 py-3 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                  {marketplaceLabel(order.marketplace ?? order.source)}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{order.customerName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={statusColor(order.status)}>{order.status}</span>
                </td>
                <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(order.totalAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--status-error)' }}>{fmt(order.marketplaceFee)}</td>
                <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{fmt(order.shippingFee)}</td>
                <td className="px-4 py-3 text-right font-medium tabular-nums" style={{ color: 'var(--arm)' }}>{fmt(order.netAmount)}</td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDate(order.orderedAt)}</td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: 'var(--text-muted)' }}>Nenhum pedido encontrado</td></tr>
            )}
          </tbody>
        </table>

        {data && data.data.length === 50 && (
          <div className="px-6 py-3 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border)' }}>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="text-sm disabled:opacity-40 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              ← Anterior
            </button>
            <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Página {page}</span>
            <button onClick={() => setPage((p) => p + 1)} className="text-sm transition-colors" style={{ color: 'var(--text-secondary)' }}>
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
