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

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      paid: 'bg-green-100 text-green-700',
      delivered: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700',
      pending: 'bg-yellow-100 text-yellow-700',
    }
    return colors[status] ?? 'bg-gray-100 text-gray-700'
  }

  return (
    <div>
      <h2 className="mb-6 text-xl font-bold text-gray-900">Pedidos</h2>

      {/* Filtros */}
      <div className="mb-6 flex items-center gap-4">
        <select
          value={source}
          onChange={(e) => { setSource(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Todas as fontes</option>
          <option value="magazord">Magazord</option>
          <option value="mercado_livre">Mercado Livre</option>
          <option value="tiktok_shop">TikTok Shop</option>
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => { setDateFrom(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm text-gray-400">até</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => { setDateTo(e.target.value); setPage(1) }}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="rounded-xl bg-white shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left">Nº Pedido</th>
              <th className="px-4 py-3 text-left">Fonte</th>
              <th className="px-4 py-3 text-left">Cliente</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
              <th className="px-4 py-3 text-right">Taxa</th>
              <th className="px-4 py-3 text-right">Frete</th>
              <th className="px-4 py-3 text-right">Líquido</th>
              <th className="px-4 py-3 text-left">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Carregando...
                </td>
              </tr>
            )}
            {data?.data.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50/50">
                <td className="px-4 py-3 font-mono text-xs text-gray-600">
                  {order.orderNumber ?? order.externalId}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs font-medium">
                    {marketplaceLabel(order.marketplace ?? order.source)}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">{order.customerName ?? '—'}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge(order.status)}`}>
                    {order.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-medium">{fmt(order.totalAmount)}</td>
                <td className="px-4 py-3 text-right text-red-500">{fmt(order.marketplaceFee)}</td>
                <td className="px-4 py-3 text-right">{fmt(order.shippingFee)}</td>
                <td className="px-4 py-3 text-right text-green-700 font-medium">{fmt(order.netAmount)}</td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(order.orderedAt)}</td>
              </tr>
            ))}
            {!isLoading && data?.data.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-400">
                  Nenhum pedido encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {data && data.data.length === 50 && (
          <div className="border-t border-gray-100 px-6 py-3 flex justify-end gap-3">
            <button
              disabled={page === 1}
              onClick={() => setPage((p) => p - 1)}
              className="text-sm text-gray-500 hover:text-gray-700 disabled:opacity-40"
            >
              ← Anterior
            </button>
            <span className="text-sm text-gray-500">Página {page}</span>
            <button
              onClick={() => setPage((p) => p + 1)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Próxima →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
