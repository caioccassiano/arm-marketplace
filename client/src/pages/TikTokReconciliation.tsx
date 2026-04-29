import { useState, useRef, useEffect, DragEvent } from 'react'
import type { TikTokItem, TikTokReconcileResult } from '../lib/types.ts'

const STORAGE_KEY = 'tiktok-reconciliation:state:v1'

interface PersistedState {
  result: TikTokReconcileResult
  activeTab: Tab
  search: string
}

function loadPersisted(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedState
    // Migra snapshots antigos que não tinham SKUs ou receita líquida por item
    if (parsed?.result?.items) {
      parsed.result.items = parsed.result.items.map((it) => ({
        ...it,
        items: Array.isArray(it.items) ? it.items : [],
        receitaLiquida: it.receitaLiquida ?? null,
      }))
    }
    return parsed
  } catch {
    return null
  }
}

function savePersisted(state: PersistedState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    // storage cheio ou bloqueado — ignora silenciosamente
  }
}

function clearPersisted(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignora
  }
}

type Tab =
  | 'todos'
  | 'ok'
  | 'divergente'
  | 'resolvidos'
  | 'somente_tiktok'
  | 'somente_erp'
  | 'cancelados'
  | 'pagos'
  | 'em_espera'

const TABS: { id: Tab; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'ok', label: 'OK' },
  { id: 'divergente', label: 'Divergente' },
  { id: 'resolvidos', label: 'Resolvidos' },
  { id: 'somente_tiktok', label: 'Cancelados TikTok' },
  { id: 'somente_erp', label: 'Brindes' },
  { id: 'cancelados', label: 'Cancelados' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'em_espera', label: 'Em Espera' },
]

const CANCELED_TIKTOK = new Set(['Cancelado', 'Não pago'])
const CANCELED_MAGAZORD = new Set(['pagamento-cancelado', 'cancelado'])

function isCanceled(i: TikTokItem): boolean {
  if (i.tiktokStatus && CANCELED_TIKTOK.has(i.tiktokStatus)) return true
  if (i.magazordSituacao && CANCELED_MAGAZORD.has(i.magazordSituacao)) return true
  return false
}

function filterItems(items: TikTokItem[], tab: Tab): TikTokItem[] {
  if (tab === 'todos') return items
  if (tab === 'ok') return items.filter((i) => i.statusFinanceiro === 'OK')
  if (tab === 'divergente')
    return items.filter(
      (i) => i.statusFinanceiro === 'DIVERGENTE' && i.motivoDivergencia === 'NAO_IDENTIFICADO',
    )
  if (tab === 'resolvidos')
    return items.filter(
      (i) =>
        i.statusFinanceiro === 'DIVERGENTE' &&
        i.motivoDivergencia !== null &&
        i.motivoDivergencia !== 'NAO_IDENTIFICADO',
    )
  if (tab === 'somente_tiktok') return items.filter((i) => i.statusMatch === 'SOMENTE_TIKTOK')
  if (tab === 'somente_erp') return items.filter((i) => i.statusMatch === 'SOMENTE_ERP')
  if (tab === 'cancelados') return items.filter(isCanceled)
  if (tab === 'pagos') return items.filter((i) => i.pago)
  if (tab === 'em_espera') return items.filter((i) => i.emEspera)
  return items
}

const STATUS_FINANCEIRO_STYLE: Record<string, string> = {
  OK: 'bg-[rgba(124,194,58,0.12)] text-[#3A7D0A]',
  DIVERGENTE: 'bg-[rgba(220,38,38,0.10)] text-[#B91C1C]',
  A_RECEBER: 'bg-[rgba(217,119,6,0.12)] text-[#92400E]',
  IGNORAR: 'bg-[rgba(107,114,128,0.12)] text-[#4B5563]',
}

const TIKTOK_PAGE_SIZE = 20

const BRL = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
function fmt(v: string | null): string {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : BRL.format(n)
}

function DropZone({
  label,
  accept,
  file,
  accent,
  onFile,
}: {
  label: string
  accept: string
  file: File | null
  accent: 'rose' | 'slate' | 'emerald' | 'amber'
  onFile: (f: File) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  const accentColors = {
    rose: '#E5534B',
    slate: '#8A8A94',
    emerald: '#7CC23A',
    amber: '#C97C2A',
  }[accent]

  return (
    <div
      className="relative flex flex-col items-center justify-center gap-2 rounded-xl p-6 cursor-pointer transition-all"
      style={{
        border: `2px dashed ${dragging ? accentColors : 'var(--border-strong)'}`,
        backgroundColor: dragging ? `${accentColors}10` : 'var(--bg-elevated)',
      }}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      {file ? (
        <>
          <svg className="h-5 w-5" style={{ color: accentColors }} viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-center truncate max-w-full" style={{ color: accentColors }}>{file.name}</span>
          <button
            type="button"
            className="text-xs transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onClick={(e) => { e.stopPropagation(); onFile(null as unknown as File) }}
          >
            remover
          </button>
        </>
      ) : (
        <>
          <svg className="h-8 w-8" style={{ color: accentColors }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <p className="text-sm font-medium" style={{ color: accentColors }}>{label}</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>clique ou arraste</p>
        </>
      )}
    </div>
  )
}

export default function TikTokReconciliation() {
  const persisted = loadPersisted()
  const [tiktokFile, setTiktokFile] = useState<File | null>(null)
  const [magazordFile, setMagazordFile] = useState<File | null>(null)
  const [liquidadosFile, setLiquidadosFile] = useState<File | null>(null)
  const [emEsperaFile, setEmEsperaFile] = useState<File | null>(null)
  const [result, setResult] = useState<TikTokReconcileResult | null>(persisted?.result ?? null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>(persisted?.activeTab ?? 'todos')
  const [search, setSearch] = useState(persisted?.search ?? '')
  const [page, setPage] = useState(1)

  useEffect(() => {
    if (result) {
      savePersisted({ result, activeTab, search })
    }
  }, [result, activeTab, search])

  useEffect(() => { setPage(1) }, [activeTab, search])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!tiktokFile || !magazordFile) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const fd = new FormData()
      fd.append('tiktok', tiktokFile)
      fd.append('magazord', magazordFile)
      if (liquidadosFile) fd.append('liquidados', liquidadosFile)
      if (emEsperaFile) fd.append('em_espera', emEsperaFile)
      const res = await fetch('/api/upload/tiktok-reconcile', { method: 'POST', body: fd, credentials: 'include' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(body.error ?? `Erro ${res.status}`)
      }
      const data = await res.json() as TikTokReconcileResult
      setResult(data)
      setActiveTab('todos')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido')
    } finally {
      setLoading(false)
    }
  }

  const tabItems = result ? filterItems(result.items, activeTab) : []
  const searchTerm = search.trim().toLowerCase()
  const visible = searchTerm
    ? tabItems.filter(
        (i) =>
          i.tiktokOrderId?.toLowerCase().includes(searchTerm) ||
          i.magazordCodSec?.toLowerCase().includes(searchTerm) ||
          (i.items ?? []).some((it) => it.sku.toLowerCase().includes(searchTerm)),
      )
    : tabItems
  const pagedVisible = visible.slice((page - 1) * TIKTOK_PAGE_SIZE, page * TIKTOK_PAGE_SIZE)
  const totalPages = Math.ceil(visible.length / TIKTOK_PAGE_SIZE)

  function handleClear() {
    clearPersisted()
    setResult(null)
    setTiktokFile(null)
    setMagazordFile(null)
    setLiquidadosFile(null)
    setEmEsperaFile(null)
    setActiveTab('todos')
    setSearch('')
    setError(null)
  }

  const [savingFeitoria, setSavingFeitoria] = useState(false)
  const [feitoriaMsg, setFeitoriaMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function handleSaveFeitoria() {
    if (!result) return
    setSavingFeitoria(true)
    setFeitoriaMsg(null)
    try {
      const res = await fetch('/api/feitorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ payload: result }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erro ${res.status}`)
      }
      const saved = (await res.json()) as { title: string }
      setFeitoriaMsg({ kind: 'ok', text: `Feitoria salva: ${saved.title}` })
      setTimeout(() => setFeitoriaMsg(null), 4000)
    } catch (err) {
      setFeitoriaMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Erro ao salvar feitoria',
      })
    } finally {
      setSavingFeitoria(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Conciliação TikTok × Magazord</h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>Upload do relatório TikTok (XLSX) e exportação do Magazord (CSV)</p>
        </div>
        {result && (
          <div className="flex items-center gap-3">
            {feitoriaMsg && (
              <span className="text-xs" style={{ color: feitoriaMsg.kind === 'ok' ? 'var(--arm)' : 'var(--status-error)' }}>
                {feitoriaMsg.text}
              </span>
            )}
            <button
              onClick={handleSaveFeitoria}
              disabled={savingFeitoria}
              className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm disabled:opacity-40"
            >
              {savingFeitoria && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {savingFeitoria ? 'Salvando…' : 'Salvar Feitoria'}
            </button>
            <button
              onClick={handleClear}
              className="text-xs transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--status-error)')}
              onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
            >
              Limpar dados
            </button>
          </div>
        )}
      </div>

      {/* Upload form */}
      <form onSubmit={handleSubmit} className="rounded-xl p-6 space-y-4" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        <div className="grid grid-cols-4 gap-4">
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>TikTok Shop</p>
            <DropZone
              label="Relatório de Pedidos (.xlsx ou .csv)"
              accept=".xlsx,.csv,.xls"
              file={tiktokFile}
              accent="rose"
              onFile={(f) => setTiktokFile(f)}
            />
          </div>
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Magazord</p>
            <DropZone
              label="Exportar Consulta de Pedidos (.xlsx ou .csv)"
              accept=".xlsx,.csv,.xls"
              file={magazordFile}
              accent="slate"
              onFile={(f) => setMagazordFile(f)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Pedidos Liquidados</p>
              <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>opcional</span>
            </div>
            <DropZone
              label="Demonstrativo de Liquidação (.xlsx ou .csv)"
              accept=".xlsx,.csv,.xls"
              file={liquidadosFile}
              accent="emerald"
              onFile={(f) => setLiquidadosFile(f)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Em Espera</p>
              <span className="text-[10px] font-medium uppercase" style={{ color: 'var(--text-muted)' }}>opcional</span>
            </div>
            <DropZone
              label="Pedidos não liquidados (.xlsx ou .csv)"
              accept=".xlsx,.csv,.xls"
              file={emEsperaFile}
              accent="amber"
              onFile={(f) => setEmEsperaFile(f)}
            />
          </div>
        </div>

        {error && (
          <p className="text-sm rounded-lg px-4 py-2" style={{ backgroundColor: 'rgba(229,83,75,0.12)', color: 'var(--status-error)', border: '1px solid rgba(229,83,75,0.3)' }}>{error}</p>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={!tiktokFile || !magazordFile || loading}
            className="btn-primary flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {loading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
            {loading ? 'Processando…' : 'Conciliar'}
          </button>
        </div>
      </form>

      {/* Results */}
      {result && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-10 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            {(() => {
              const ignorarPagos = result.items.filter((i) => i.pago && i.statusFinanceiro === 'IGNORAR').length
              return [
                { label: 'TikTok', value: result.summary.tiktokTotal },
                { label: 'Magazord', value: result.summary.magazordTotal },
                { label: 'Match OK', value: result.summary.matchOk, color: '#7CC23A' },
                { label: 'Divergentes', value: result.summary.matchDivergente, color: result.summary.matchDivergente > 0 ? '#E5534B' : undefined },
                { label: 'Cancelados TikTok', value: result.summary.somenteTiktok },
                { label: 'Brindes', value: result.summary.somenteErp },
                { label: 'Pagos', value: result.summary.liquidadosPagos, color: result.summary.liquidadosPagos > 0 ? '#7CC23A' : undefined },
                { label: 'Em Espera', value: result.summary.emEsperaTotal, color: result.summary.emEsperaTotal > 0 ? '#C97C2A' : undefined },
                { label: 'Ignorar Pagos', value: ignorarPagos, color: ignorarPagos > 0 ? '#E5534B' : undefined },
                { label: 'Dif. Total', value: fmt(result.summary.totalDiff) },
              ]
            })().map((m, idx, arr) => (
              <div key={m.label} className="flex flex-col items-center py-4 px-2"
                style={{ borderRight: idx < arr.length - 1 ? '1px solid var(--border)' : undefined }}>
                <p className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{m.label}</p>
                <p className="mt-1 text-lg font-semibold tabular-nums" style={{ color: m.color ?? 'var(--text-primary)' }}>
                  {m.value}
                </p>
              </div>
            ))}
          </div>

          {/* Tab filter + search */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex gap-1 rounded-lg p-1 w-fit" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              {TABS.map((t) => {
                const count = t.id === 'todos' ? result.items.length : filterItems(result.items, t.id).length
                const isActive = activeTab === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors"
                    style={isActive
                      ? { backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)', boxShadow: '0 1px 2px rgba(0,0,0,0.3)' }
                      : { color: 'var(--text-muted)' }
                    }
                  >
                    {t.label}
                    <span className="text-xs tabular-nums" style={{ color: isActive ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--text-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
              </svg>
              <input
                type="text"
                placeholder="Pesquisar Order ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 rounded-lg pl-9 pr-9 py-2 text-sm font-mono outline-none"
                style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  aria-label="Limpar"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Order ID (TikTok)', 'Status TikTok', 'SKUs', 'Receita TikTok', 'Cód. Secundário', 'Situação Magazord', 'Receita Magazord', 'Receita Líquida', 'Diferença', 'Motivo', 'Status'].map((h, i) => (
                      <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${[3,6,7,8].includes(i) ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="px-4 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                        Nenhum item nesta categoria
                      </td>
                    </tr>
                  ) : (
                    pagedVisible.map((item, idx) => (
                      <tr key={idx} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {item.tiktokOrderId ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {item.tiktokStatus ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          {(item.items ?? []).length === 0 ? (
                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[260px]">
                              {(item.items ?? []).map((it, i) => (
                                <span key={i} className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[11px]"
                                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                                  {it.sku}
                                  {it.quantity > 1 && <span style={{ color: 'var(--text-muted)' }}>×{it.quantity}</span>}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {fmt(item.tiktokAmount)}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {item.magazordCodSec ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5" style={{ color: 'var(--text-secondary)' }}>
                          {item.magazordSituacao ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>
                          {fmt(item.magazordAmount)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {item.receitaLiquida != null ? (
                            <span style={{ color: 'var(--text-primary)' }}>{fmt(item.receitaLiquida)}</span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          {item.diferencaValor != null ? (
                            <span className={parseFloat(item.diferencaValor) !== 0 ? 'font-medium' : ''}
                              style={{ color: parseFloat(item.diferencaValor) !== 0 ? 'var(--status-error)' : 'var(--text-muted)' }}>
                              {fmt(item.diferencaValor)}
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {item.motivoDivergencia
                            ? item.motivoDivergencia.replace('_', ' ').toLowerCase()
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_FINANCEIRO_STYLE[item.statusFinanceiro] ?? ''}`}>
                              {item.statusFinanceiro}
                            </span>
                            {item.pago && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: 'rgba(124,194,58,0.2)', color: '#7CC23A' }}>
                                PAGO
                              </span>
                            )}
                            {item.emEspera && (
                              <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold"
                                style={{ backgroundColor: 'rgba(201,124,42,0.2)', color: '#C97C2A' }}>
                                EM ESPERA
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {visible.length > TIKTOK_PAGE_SIZE && (
              <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Mostrando {(page - 1) * TIKTOK_PAGE_SIZE + 1}–{Math.min(page * TIKTOK_PAGE_SIZE, visible.length)} de {visible.length} itens
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => p - 1)}
                    disabled={page === 1}
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
                    disabled={page >= totalPages}
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
      )}
    </div>
  )
}
