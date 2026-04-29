import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { fmt } from '../lib/utils.ts'
import type { TikTokItem, SkuItem } from '../lib/types.ts'

interface ResolvedSku extends SkuItem {
  prefix: string
  preco: number | null
}

interface FeeBreakdown {
  description: string
  amount: number
}

interface Reembolso {
  orderId: string | null
  ajusteId: string | null
  dataLiquidacao: string | null
  valor: number
  tipoTransacao: string
}

interface EnrichedItem extends TikTokItem {
  receitaMagazord: number | null
  receitaTiktok: number | null
  cmvTotal: number | null
  lucro: number | null
  margem: number | null
  missingCmv: boolean
  itemsResolved: ResolvedSku[]
  taxasAplicadas: number
  taxasBreakdown: FeeBreakdown[]
  tarifaTiktokNum: number | null
  comissaoCreatorNum: number | null
}

interface LucratividadeTotals {
  totalReceitaMagazord: number
  totalReceitaLiquida: number
  totalCmv: number
  totalTaxas: number
  taxasBreakdownSummary: FeeBreakdown[]
  investimentoAds: number
  totalReembolsos: number
  lucroLiquido: number
  pedidosSemCmv: number
  pedidosComCmv: number
  totalTarifaTiktok: number
  totalComissaoCreator: number
}

interface LucratividadePayload {
  entrada: {
    id: number
    feitoriaId: number
    investimentoAds: string
    createdAt: string
  }
  feitoria: {
    id: number
    title: string
    itemCount: number
    activeItemCount: number
    ignoradosCount: number
    totalDiff: string
    createdAt: string
  }
  totals: LucratividadeTotals
  items: EnrichedItem[]
  reembolsos: Reembolso[] | null
  cmvSize: number
  feesCount: number
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

export default function LucratividadeDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [data, setData] = useState<LucratividadePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [onlyTransacionado, setOnlyTransacionado] = useState(true)
  const adsInputRef = useRef<HTMLInputElement>(null)
  const [adsLoading, setAdsLoading] = useState(false)
  const [adsMsg, setAdsMsg] = useState<string | null>(null)
  const [totals, setTotals] = useState<LucratividadeTotals | null>(null)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    api
      .get<LucratividadePayload>(`/lucratividade/${id}`)
      .then((d) => {
        setData(d)
        setTotals(d.totals)
        if (adsInputRef.current) adsInputRef.current.value = d.entrada.investimentoAds
      })
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

  async function handleSaveAds() {
    if (!id || !data) return
    const raw = adsInputRef.current?.value ?? ''
    const val = parseFloat(raw.replace(/\./g, '').replace(',', '.'))
    if (!Number.isFinite(val) || val < 0) {
      setAdsMsg('Valor inválido')
      return
    }
    setAdsLoading(true)
    setAdsMsg(null)
    try {
      await api.patch(`/lucratividade/${id}`, { investimentoAds: val })
      if (totals) {
        setTotals({
          ...totals,
          investimentoAds: val,
          lucroLiquido: +(totals.totalReceitaLiquida - totals.totalCmv - totals.totalTaxas - val + totals.totalReembolsos).toFixed(2),
        })
      }
      setAdsMsg('Salvo')
    } catch (err) {
      setAdsMsg(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setAdsLoading(false)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Excluir esta entrada da lucratividade? Esta ação é irreversível.')) return
    setDeleting(true)
    try {
      await api.delete(`/lucratividade/${id}`)
      navigate('/lucratividade')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir')
      setDeleting(false)
    }
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
  if (error) return <p className="text-sm" style={{ color: 'var(--status-error)' }}>{error}</p>
  if (!data || !totals) return null

  const { feitoria, feesCount, cmvSize } = data

  const cardStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to="/lucratividade" className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}>
            ← Lucratividade
          </Link>
          <h1 className="text-xl font-semibold mt-1" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
            {feitoria.title}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {feitoria.activeItemCount} pedidos · {feesCount} taxa(s) aplicada(s) · CMV: {cmvSize} SKU(s)
            {feitoria.ignoradosCount > 0 && (
              <span className="ml-2" style={{ color: 'var(--text-muted)' }}>({feitoria.ignoradosCount} ignorados)</span>
            )}
          </p>
        </div>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs transition-colors disabled:opacity-40"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--status-error)')}
          onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
        >
          {deleting ? 'Excluindo…' : 'Excluir entrada'}
        </button>
      </div>

      {cmvSize === 0 && (
        <div className="rounded-lg px-4 py-3 text-sm" style={{ backgroundColor: 'rgba(201,124,42,0.12)', border: '1px solid rgba(201,124,42,0.3)', color: 'var(--status-warn)' }}>
          Nenhum SKU cadastrado na tabela CMV. Faça o upload em{' '}
          <Link to="/cmv" className="underline font-medium">Conciliar CMV</Link>{' '}
          para calcular lucro.
        </div>
      )}

      {/* 4 cards principais */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Receita Magazord</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmt(totals.totalReceitaMagazord)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>valor total Magazord</p>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Receita Líquida TikTok</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmt(totals.totalReceitaLiquida)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>a receber do TikTok</p>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>CMV</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{fmt(totals.totalCmv)}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{totals.pedidosComCmv} com custo cadastrado</p>
        </div>
        <div className="rounded-xl p-5" style={cardStyle}>
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Taxas Aplicadas</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: 'var(--status-error)', letterSpacing: '-0.02em' }}>{fmt(totals.totalTaxas)}</p>
          {totals.taxasBreakdownSummary.length > 0 && (
            <div className="mt-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--border)' }}>
              {totals.taxasBreakdownSummary.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{b.description}</span>
                  <span className="text-xs font-medium tabular-nums whitespace-nowrap" style={{ color: 'var(--status-error)' }}>− {fmt(b.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Custos TikTok — informativo */}
      <div className="rounded-xl p-5" style={{ backgroundColor: 'rgba(75,142,232,0.08)', border: '1px solid rgba(75,142,232,0.2)' }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#4B8EE8' }}>Custos TikTok</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: '#4B8EE8', letterSpacing: '-0.02em' }}>
              {fmt(totals.totalTarifaTiktok + totals.totalComissaoCreator)}
            </p>
            <div className="mt-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(75,142,232,0.2)' }}>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: '#4B8EE8' }}>Tarifa TikTok</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: '#4B8EE8' }}>{fmt(totals.totalTarifaTiktok)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs" style={{ color: '#4B8EE8' }}>Comissão Creator</span>
                <span className="text-xs font-medium tabular-nums" style={{ color: '#4B8EE8' }}>{fmt(totals.totalComissaoCreator)}</span>
              </div>
            </div>
          </div>
          <div className="rounded-lg px-4 py-3 max-w-sm" style={{ backgroundColor: 'rgba(201,124,42,0.12)', border: '1px solid rgba(201,124,42,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--status-warn)' }}>⚠ Não impacta a lucratividade</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
              Tarifa TikTok e Comissão Creator <strong>não são deduzidos</strong> do Lucro Líquido.
            </p>
          </div>
        </div>
      </div>

      {/* Reembolsos */}
      <ReembolsosCard reembolsos={data.reembolsos ?? null} />

      {/* Investimento em Ads */}
      <div className="rounded-xl p-5 flex items-center gap-6" style={cardStyle}>
        <div className="flex-1">
          <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Investimento em Ads</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>R$</span>
            <input
              ref={adsInputRef}
              type="text"
              inputMode="decimal"
              defaultValue=""
              className="w-48 rounded-lg px-2 py-1 text-2xl font-semibold tabular-nums outline-none"
              style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            />
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleSaveAds}
            disabled={adsLoading}
            className="btn-primary text-sm rounded-lg px-4 py-2 disabled:opacity-40"
          >
            {adsLoading ? 'Salvando…' : 'Salvar'}
          </button>
          {adsMsg && (
            <span className="text-sm" style={{ color: adsMsg === 'Salvo' ? 'var(--arm)' : 'var(--status-error)' }}>
              {adsMsg}
            </span>
          )}
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>deduzido do lucro líquido</p>
      </div>

      {/* Lucro Líquido */}
      <div
        className="rounded-xl p-6"
        style={{
          backgroundColor: totals.lucroLiquido >= 0 ? 'rgba(124,194,58,0.08)' : 'rgba(229,83,75,0.08)',
          border: `1px solid ${totals.lucroLiquido >= 0 ? 'rgba(124,194,58,0.25)' : 'rgba(229,83,75,0.25)'}`,
        }}
      >
        <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Lucro Líquido</p>
        <p
          className="mt-1 text-4xl font-bold tabular-nums"
          style={{ color: totals.lucroLiquido >= 0 ? 'var(--arm)' : 'var(--status-error)', letterSpacing: '-0.03em' }}
        >
          {fmt(totals.lucroLiquido)}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          receita líquida tiktok − cmv − taxas − investimento em ads + reembolsos
        </p>
      </div>

      {/* Filters */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={onlyTransacionado}
            onChange={(e) => setOnlyTransacionado(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--arm)' }}
          />
          Apenas pedidos transacionados
        </label>
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
          </svg>
          <input
            type="text"
            placeholder="Pesquisar SKU, Order ID ou Cód. Magazord..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
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
                {['Order ID', 'Status', 'SKUs', 'R. Magazord', 'Taxas', 'CMV', 'Tarifa TT', 'Comissão CR', 'Lucro', 'Margem', 'Financeiro'].map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i >= 3 && i <= 9 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Nenhum pedido nesta busca
                  </td>
                </tr>
              ) : (
                visible.map((item, idx) => (
                  <tr key={idx} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {item.tiktokOrderId ?? item.magazordCodSec ?? '—'}
                    </td>
                    <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                      {item.tiktokStatus ?? item.magazordSituacao ?? '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      {item.itemsResolved.length === 0 ? (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      ) : (
                        <div className="flex flex-wrap gap-1 max-w-[240px]">
                          {item.itemsResolved.map((it, i) => (
                            <span key={i} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]"
                              style={{ backgroundColor: 'var(--bg-elevated)', color: it.preco === null ? 'var(--text-muted)' : 'var(--text-secondary)', border: '1px solid var(--border)' }}
                              title={it.preco === null ? 'Sem custo cadastrado' : `Custo: ${fmt(it.preco)}`}
                            >
                              {it.sku}
                              {it.quantity > 1 && <span style={{ color: 'var(--text-muted)' }}>×{it.quantity}</span>}
                              {it.preco === null && <span style={{ color: 'var(--status-warn)' }}>⚠</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                      {item.foiTransacionado && item.receitaMagazord !== null ? fmt(item.receitaMagazord) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.foiTransacionado && item.taxasAplicadas > 0 ? (
                        <div className="relative inline-block group">
                          <span className="cursor-default underline decoration-dotted underline-offset-2" style={{ color: 'var(--status-error)' }}>
                            {fmt(item.taxasAplicadas)}
                          </span>
                          <div className="absolute right-0 bottom-full mb-2 z-10 hidden group-hover:block">
                            <div className="rounded-lg shadow-lg p-3 min-w-[220px] text-left" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                              <p className="text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Taxas aplicadas</p>
                              <div className="space-y-1.5">
                                {item.taxasBreakdown.map((b, i) => (
                                  <div key={i} className="flex items-center justify-between gap-4">
                                    <span className="text-xs truncate max-w-[140px]" style={{ color: 'var(--text-secondary)' }}>{b.description}</span>
                                    <span className="text-xs font-medium tabular-nums whitespace-nowrap" style={{ color: 'var(--status-error)' }}>− {fmt(b.amount)}</span>
                                  </div>
                                ))}
                              </div>
                              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border)' }}>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Total</span>
                                <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--status-error)' }}>− {fmt(item.taxasAplicadas)}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {!item.foiTransacionado ? <span style={{ color: 'var(--text-muted)' }}>—</span>
                        : item.cmvTotal !== null ? <span style={{ color: 'var(--text-primary)' }}>{fmt(item.cmvTotal)}</span>
                        : item.items.length > 0 ? <span className="text-xs" style={{ color: 'var(--status-warn)' }}>sem custo</span>
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.tarifaTiktokNum !== null ? <span style={{ color: '#4B8EE8' }}>{fmt(item.tarifaTiktokNum)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.comissaoCreatorNum !== null ? <span style={{ color: '#4B8EE8' }}>{fmt(item.comissaoCreatorNum)}</span> : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.lucro !== null ? (
                        <span className="font-medium" style={{ color: item.lucro >= 0 ? 'var(--arm)' : 'var(--status-error)' }}>{fmt(item.lucro)}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {item.margem !== null ? (
                        <span style={{ color: item.margem >= 0 ? 'var(--arm)' : 'var(--status-error)' }}>{pct(item.margem)}</span>
                      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      {STATUS_FINANCEIRO_STYLE[item.statusFinanceiro] ? (
                        <span
                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                          style={{
                            backgroundColor: STATUS_FINANCEIRO_STYLE[item.statusFinanceiro]?.bg,
                            color: STATUS_FINANCEIRO_STYLE[item.statusFinanceiro]?.color,
                          }}
                        >
                          {item.statusFinanceiro}
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ReembolsosCard({ reembolsos }: { reembolsos: Reembolso[] | null }) {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const filtered = useMemo(() => {
    if (!reembolsos) return []
    const hasFilter = Boolean(from || to)
    return reembolsos.filter((r) => {
      if (!r.dataLiquidacao) return !hasFilter
      if (from && r.dataLiquidacao < from) return false
      if (to && r.dataLiquidacao > to) return false
      return true
    })
  }, [reembolsos, from, to])

  const total = useMemo(() => filtered.reduce((s, r) => s + r.valor, 0), [filtered])

  const breakdown = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>()
    for (const r of filtered) {
      const cur = map.get(r.tipoTransacao) ?? { count: 0, total: 0 }
      map.set(r.tipoTransacao, { count: cur.count + 1, total: cur.total + r.valor })
    }
    return [...map.entries()]
      .map(([tipo, v]) => ({ tipo, count: v.count, total: v.total }))
      .sort((a, b) => Math.abs(b.total) - Math.abs(a.total))
  }, [filtered])

  if (reembolsos === null) {
    return (
      <div className="rounded-xl p-5" style={{ backgroundColor: 'rgba(201,124,42,0.08)', border: '1px solid rgba(201,124,42,0.25)' }}>
        <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: 'var(--status-warn)' }}>Reembolsos</p>
        <p className="mt-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <strong>Reupload necessário.</strong> Esta feitoria foi criada antes da feature de reembolsos. Refaça o upload do arquivo de Liquidados para popular os dados.
        </p>
      </div>
    )
  }

  const hasFilter = Boolean(from || to)
  const inputStyle = { backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }

  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'rgba(75,142,232,0.08)', border: '1px solid rgba(75,142,232,0.2)' }}>
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#4B8EE8' }}>Reembolsos</p>
          <p className="mt-2 text-2xl font-semibold tabular-nums" style={{ color: '#4B8EE8', letterSpacing: '-0.02em' }}>
            {fmt(total)}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {filtered.length} reembolso(s){hasFilter ? ' no período' : ''} · soma ao lucro líquido
          </p>

          {breakdown.length > 0 && (
            <div className="mt-3 space-y-1.5 pt-3" style={{ borderTop: '1px solid rgba(75,142,232,0.2)' }}>
              {breakdown.map((b) => (
                <div key={b.tipo} className="flex items-center justify-between gap-2">
                  <span className="text-xs truncate" style={{ color: '#4B8EE8' }}>
                    {b.tipo} <span style={{ opacity: 0.7 }}>({b.count})</span>
                  </span>
                  <span className="text-xs font-medium tabular-nums whitespace-nowrap" style={{ color: '#4B8EE8' }}>
                    {fmt(b.total)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div>
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="mt-1 block rounded-lg px-2 py-1 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="mt-1 block rounded-lg px-2 py-1 text-sm outline-none"
              style={inputStyle}
            />
          </div>
          {hasFilter && (
            <button
              onClick={() => { setFrom(''); setTo('') }}
              className="text-xs underline pb-1"
              style={{ color: 'var(--text-muted)' }}
            >
              Limpar
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
