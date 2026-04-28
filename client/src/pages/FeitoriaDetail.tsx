import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { fmt } from '../lib/utils.ts'
import type { TikTokItem, SkuItem } from '../lib/types.ts'

interface ResolvedSku extends SkuItem {
  prefix: string
  preco: number | null
}

interface EnrichedItem extends TikTokItem {
  receitaMagazord: number | null
  receitaTiktok: number | null
  cmvTotal: number | null
  lucro: number | null
  margem: number | null
  missingCmv: boolean
  itemsResolved: ResolvedSku[]
}

interface FeitoriaPayload {
  feitoria: {
    id: number
    title: string
    itemCount: number
    activeItemCount: number
    ignoradosCount: number
    totalDiff: string
    createdAt: string
  }
  summary: {
    tiktokTotal: number
    magazordTotal: number
    matchOk: number
    matchDivergente: number
    somenteTiktok: number
    somenteErp: number
    totalDiff: string
    liquidadosPagos: number
    emEsperaTotal: number
    receitaLiquidaTotal?: string
  }
  totals: {
    totalReceitaMagazord: number
    totalReceitaTiktok: number
    totalReceitaLiquida: number
    totalCmv: number
    lucro: number
    margem: number | null
    pedidosSemCmv: number
    pedidosComCmv: number
    pedidosSemLiquida: number
  }
  items: EnrichedItem[]
  cmvSize: number
}

const STATUS_FINANCEIRO_STYLE: Record<string, { bg: string; color: string }> = {
  OK: { bg: 'rgba(124,194,58,0.15)', color: '#7CC23A' },
  DIVERGENTE: { bg: 'rgba(229,83,75,0.15)', color: '#E5534B' },
  A_RECEBER: { bg: 'rgba(201,124,42,0.15)', color: '#C97C2A' },
  IGNORAR: { bg: 'rgba(82,82,92,0.3)', color: '#8A8A94' },
}

function pct(value: number | null): string {
  if (value === null) return '—'
  return `${(value * 100).toFixed(1)}%`
}

export default function FeitoriaDetail() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<FeitoriaPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyTransacionado, setOnlyTransacionado] = useState(true)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<FeitoriaPayload>(`/feitorias/${id}`)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [id])

  const visible = useMemo(() => {
    if (!data) return []
    let out = data.items
    if (onlyTransacionado) out = out.filter((i) => i.foiTransacionado)
    const term = search.trim().toLowerCase()
    if (term) {
      out = out.filter(
        (i) =>
          i.tiktokOrderId?.toLowerCase().includes(term) ||
          i.magazordCodSec?.toLowerCase().includes(term) ||
          i.items.some((it) => it.sku.toLowerCase().includes(term)),
      )
    }
    return out
  }, [data, search, onlyTransacionado])

  if (loading) {
    return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
  }
  if (error) {
    return <p className="text-sm" style={{ color: 'var(--status-error)' }}>{error}</p>
  }
  if (!data) return null

  const { feitoria, totals, cmvSize } = data
  const semCmvWarning = cmvSize === 0

  const cardStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/cmv" className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>← Conciliar CMV</Link>
          <h1 className="text-xl font-semibold mt-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{feitoria.title}</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {feitoria.activeItemCount} pedidos · CMV ativa: {cmvSize} SKU(s)
            {feitoria.ignoradosCount > 0 && <span className="ml-2" style={{ color: 'var(--text-muted)' }}>({feitoria.ignoradosCount} ignorados)</span>}
          </p>
        </div>
      </div>

      {semCmvWarning && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(201,124,42,0.12)', border: '1px solid rgba(201,124,42,0.3)', color: 'var(--status-warn)' }}>
          Nenhum SKU cadastrado na tabela CMV. Faça o upload em{' '}
          <Link to="/cmv" className="underline font-medium">Conciliar CMV</Link>{' '}
          para calcular lucro.
        </div>
      )}

      {/* Receita cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Receita Magazord', value: totals.totalReceitaMagazord, sub: 'valor total Magazord' },
          { label: 'Receita TikTok', value: totals.totalReceitaTiktok, sub: 'valor TikTok bruto' },
          { label: 'Receita Líquida', value: totals.totalReceitaLiquida, sub: 'a receber do TikTok' },
        ].map((c) => (
          <div key={c.label} className="rounded-xl p-5" style={cardStyle}>
            <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmt(c.value)}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{c.sub}</p>
          </div>
        ))}
      </div>

      {/* CMV / Lucro / Margem */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>CMV</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmt(totals.totalCmv)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{totals.pedidosComCmv} com custo cadastrado</p>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Lucro</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: totals.lucro >= 0 ? 'var(--arm)' : 'var(--status-error)', letterSpacing: '-0.02em' }}>{fmt(totals.lucro)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>receita líquida − cmv</p>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Margem</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: (totals.margem ?? 0) >= 0 ? 'var(--arm)' : 'var(--status-error)', letterSpacing: '-0.02em' }}>{pct(totals.margem)}</p>
          {(totals.pedidosSemCmv > 0 || totals.pedidosSemLiquida > 0) && (
            <p className="text-xs mt-1" style={{ color: 'var(--status-warn)' }}>
              {totals.pedidosSemCmv > 0 && `${totals.pedidosSemCmv} sem custo`}
              {totals.pedidosSemCmv > 0 && totals.pedidosSemLiquida > 0 && ' · '}
              {totals.pedidosSemLiquida > 0 && `${totals.pedidosSemLiquida} sem líquida`}
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={onlyTransacionado} onChange={(e) => setOnlyTransacionado(e.target.checked)} className="rounded" style={{ accentColor: 'var(--arm)' }} />
          Apenas pedidos transacionados
        </label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input type="text" placeholder="Pesquisar SKU, Order ID ou Cód. Magazord..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-96 rounded-lg pl-9 pr-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-xl overflow-hidden" style={cardStyle}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                {['Order ID', 'Status', 'SKUs', 'R. Magazord', 'R. TikTok', 'R. Líquida', 'CMV', 'Lucro', 'Margem', 'Financeiro'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i >= 3 && i <= 8 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum pedido nesta busca</td></tr>
              ) : visible.map((item, idx) => (
                <tr key={idx} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                >
                  <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>{item.tiktokOrderId ?? item.magazordCodSec ?? '—'}</td>
                  <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>{item.tiktokStatus ?? item.magazordSituacao ?? '—'}</td>
                  <td className="px-4 py-2.5">
                    {item.itemsResolved.length === 0 ? <span style={{ color: 'var(--text-muted)' }}>—</span> : (
                      <div className="flex flex-wrap gap-1 max-w-[280px]">
                        {item.itemsResolved.map((it, i) => (
                          <span key={i} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]"
                            style={{ backgroundColor: 'var(--bg-elevated)', color: it.preco === null ? 'var(--text-muted)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
                            title={it.preco === null ? 'Sem custo cadastrado' : `Custo: ${fmt(it.preco)}`}
                          >
                            {it.sku}{it.quantity > 1 && <span style={{ color: 'var(--text-muted)' }}>×{it.quantity}</span>}
                            {it.preco === null && <span style={{ color: 'var(--status-warn)' }}>⚠</span>}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.foiTransacionado && item.receitaMagazord !== null ? fmt(item.receitaMagazord) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.foiTransacionado && item.receitaTiktok !== null ? fmt(item.receitaTiktok) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{item.foiTransacionado && item.receitaLiquida != null ? fmt(item.receitaLiquida) : <span style={{ color: 'var(--text-muted)' }}>—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {!item.foiTransacionado ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                      : item.cmvTotal !== null ? <span style={{ color: 'var(--text-primary)' }}>{fmt(item.cmvTotal)}</span>
                      : item.items.length > 0 ? <span className="text-xs" style={{ color: 'var(--status-warn)' }}>sem custo</span>
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {item.lucro !== null ? <span className="font-medium" style={{ color: item.lucro >= 0 ? 'var(--arm)' : 'var(--status-error)' }}>{fmt(item.lucro)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {item.margem !== null ? <span style={{ color: item.margem >= 0 ? 'var(--arm)' : 'var(--status-error)' }}>{pct(item.margem)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td className="px-4 py-2.5">
                    {STATUS_FINANCEIRO_STYLE[item.statusFinanceiro] && (
                      <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                        style={{ backgroundColor: STATUS_FINANCEIRO_STYLE[item.statusFinanceiro]?.bg, color: STATUS_FINANCEIRO_STYLE[item.statusFinanceiro]?.color }}
                      >
                        {item.statusFinanceiro}
                      </span>
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
