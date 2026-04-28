import { useState } from 'react'
import { fmt } from '../lib/utils.ts'

interface UploadItem {
  status: string
  magazordNum?: string | null
  magazordAmount?: string
  magazordFee?: string | null
  marketplaceNum?: string | null
  marketplaceAmount?: string
  marketplaceFee?: string | null
  amountDiff?: string
  feeDiff?: string
}

interface UploadResult {
  marketplace: string
  summary: {
    magazordTotal: number
    marketplaceTotal: number
    matched: number
    amountMismatch: number
    magazordOnly: number
    marketplaceOnly: number
    totalAmountDiff: string
  }
  items: UploadItem[]
}

const STATUS_LABEL: Record<string, string> = {
  matched: 'Conciliado',
  amount_mismatch: 'Div. Valor',
  fee_mismatch: 'Div. Taxa',
  magazord_only: 'Só Magazord',
  marketplace_only: 'Só Marketplace',
}

const STATUS_STYLE: Record<string, React.CSSProperties> = {
  matched: { backgroundColor: 'rgba(124,194,58,0.15)', color: '#7CC23A' },
  amount_mismatch: { backgroundColor: 'rgba(229,83,75,0.15)', color: '#E5534B' },
  fee_mismatch: { backgroundColor: 'rgba(201,124,42,0.15)', color: '#C97C2A' },
  magazord_only: { backgroundColor: 'rgba(75,142,232,0.15)', color: '#4B8EE8' },
  marketplace_only: { backgroundColor: 'rgba(138,138,148,0.2)', color: '#8A8A94' },
}

function IconUpload({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
    </svg>
  )
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

function IconFile({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  )
}

interface DropZoneProps {
  id: string
  label: string
  sub: string
  accent: 'primary' | 'secondary'
  file: File | null
  onChange: (f: File | null) => void
}

function DropZone({ id, label, sub, accent, file, onChange }: DropZoneProps) {
  const [dragging, setDragging] = useState(false)

  const accentColor = accent === 'primary' ? 'var(--arm)' : 'var(--status-info)'
  const accentBg = accent === 'primary' ? 'rgba(124,194,58,0.1)' : 'rgba(75,142,232,0.1)'

  return (
    <label
      htmlFor={id}
      className="relative flex flex-col items-center justify-center gap-3 rounded-xl cursor-pointer h-48 transition-all select-none"
      style={{
        border: `2px dashed ${file || dragging ? accentColor : 'var(--border-strong)'}`,
        backgroundColor: file || dragging ? accentBg : 'var(--bg-surface)',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        const f = e.dataTransfer.files[0]
        if (f) onChange(f)
      }}
    >
      <div className="rounded-full p-3 transition-colors" style={{ backgroundColor: file ? accentColor : 'var(--bg-elevated)', color: file ? '#0C0C0E' : accentColor }}>
        {file ? <IconCheck className="h-5 w-5" /> : <IconUpload className="h-5 w-5" />}
      </div>

      <div className="text-center px-4">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
        {file ? (
          <div className="mt-1 flex items-center gap-1.5 justify-center">
            <IconFile className="h-3.5 w-3.5" style={{ color: accentColor } as React.CSSProperties} />
            <p className="text-xs font-medium truncate max-w-[180px]" style={{ color: accentColor }}>{file.name}</p>
          </div>
        ) : (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{sub}</p>
        )}
      </div>

      {file && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onChange(null) }}
          className="absolute top-2 right-2 rounded-full p-1 transition-colors"
          style={{ color: 'var(--text-muted)', backgroundColor: 'var(--bg-elevated)' }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-primary)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'var(--text-muted)')}
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}

      <input
        id={id}
        type="file"
        accept=".csv,.txt"
        className="sr-only"
        onChange={(e) => onChange(e.target.files?.[0] ?? null)}
      />
    </label>
  )
}

type FilterKey = 'all' | 'matched' | 'amount_mismatch' | 'fee_mismatch' | 'magazord_only' | 'marketplace_only'

export default function ManualUpload() {
  const [marketplace, setMarketplace] = useState('')
  const [magazordFile, setMagazordFile] = useState<File | null>(null)
  const [marketplaceFile, setMarketplaceFile] = useState<File | null>(null)
  const [result, setResult] = useState<UploadResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterKey>('all')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!magazordFile || !marketplaceFile) {
      setError('Selecione os dois arquivos para continuar.')
      return
    }

    const form = new FormData()
    form.append('magazord', magazordFile)
    form.append('marketplace_file', marketplaceFile)
    form.append('marketplace', marketplace || marketplaceFile.name.replace(/\.[^.]+$/, ''))

    setLoading(true)
    try {
      const res = await fetch('/api/upload/reconcile', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (!res.ok) {
        const data = await res.json() as { error?: string }
        throw new Error(data.error ?? 'Erro ao processar')
      }
      const data = await res.json() as UploadResult
      setResult(data)
      setFilter('all')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar arquivos.')
    } finally {
      setLoading(false)
    }
  }

  const filtered = result?.items.filter((i) => filter === 'all' || i.status === filter) ?? []

  const tabs: Array<{ id: FilterKey; label: string; count: number }> = result
    ? [
        { id: 'all', label: 'Todos', count: result.items.length },
        { id: 'matched', label: 'Conciliados', count: result.summary.matched },
        { id: 'amount_mismatch', label: 'Div. Valor', count: result.summary.amountMismatch },
        { id: 'magazord_only', label: 'Só Magazord', count: result.summary.magazordOnly },
        { id: 'marketplace_only', label: `Só ${result.marketplace}`, count: result.summary.marketplaceOnly },
      ]
    : []

  const totalDiff = result ? parseFloat(result.summary.totalAmountDiff) : 0

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Conciliação Manual</h1>
        <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
          Faça upload das planilhas Magazord e do marketplace para comparar os pedidos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <DropZone
            id="magazord-file"
            label="Planilha Magazord"
            sub="Clique ou arraste um CSV"
            accent="primary"
            file={magazordFile}
            onChange={setMagazordFile}
          />
          <DropZone
            id="marketplace-file"
            label="Planilha Marketplace"
            sub="Clique ou arraste um CSV"
            accent="secondary"
            file={marketplaceFile}
            onChange={setMarketplaceFile}
          />
        </div>

        <div className="flex items-end gap-4">
          <div className="flex-1 max-w-xs">
            <label className="block text-xs font-medium mb-1.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Nome do marketplace <span className="font-normal normal-case" style={{ color: 'var(--text-muted)' }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={marketplace}
              onChange={(e) => setMarketplace(e.target.value)}
              placeholder="Ex: Shopee, Shein, Magalu…"
              style={{
                width: '100%',
                backgroundColor: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
                borderRadius: '0.5rem',
                padding: '0.5rem 0.75rem',
                fontSize: '0.875rem',
                outline: 'none',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !magazordFile || !marketplaceFile}
            className="btn-primary rounded-lg px-5 py-2 text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processando
              </span>
            ) : 'Conciliar'}
          </button>
        </div>

        {error && (
          <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--status-error)' }}>
            <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </p>
        )}
      </form>

      {result && (
        <div className="space-y-4">
          {/* Summary strip */}
          <div className="grid grid-cols-7 rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            {[
              { label: 'Magazord', value: result.summary.magazordTotal, color: 'var(--text-primary)' },
              { label: result.marketplace, value: result.summary.marketplaceTotal, color: 'var(--text-primary)' },
              { label: 'Conciliados', value: result.summary.matched, color: 'var(--arm)' },
              { label: 'Div. Valor', value: result.summary.amountMismatch, color: result.summary.amountMismatch > 0 ? 'var(--status-error)' : 'var(--text-muted)' },
              { label: 'Div. Taxa', value: result.summary.amountMismatch, color: 'var(--text-muted)' },
              { label: 'Só Magazord', value: result.summary.magazordOnly, color: result.summary.magazordOnly > 0 ? 'var(--status-warn)' : 'var(--text-muted)' },
              {
                label: 'Diferença total',
                value: fmt(totalDiff),
                color: totalDiff > 0 ? 'var(--status-error)' : 'var(--arm)',
              },
            ].map((card, i) => (
              <div key={card.label} className="px-4 py-4 text-center" style={{ borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
                <p className="text-xs mb-1 truncate" style={{ color: 'var(--text-muted)' }}>{card.label}</p>
                <p className="text-lg font-semibold tabular-nums" style={{ color: card.color }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
            <div className="flex items-center px-1" style={{ borderBottom: '1px solid var(--border)' }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id)}
                  className="flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors -mb-px"
                  style={{
                    borderBottom: filter === tab.id ? '2px solid var(--arm)' : '2px solid transparent',
                    color: filter === tab.id ? 'var(--arm)' : 'var(--text-muted)',
                  }}
                >
                  {tab.label}
                  <span className="text-xs tabular-nums" style={{ color: filter === tab.id ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                    {tab.count}
                  </span>
                </button>
              ))}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Status', 'Pedido Magazord', 'Valor', `Pedido ${result.marketplace}`, 'Valor', 'Diferença'].map((h, i) => (
                      <th key={i} className={`px-5 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 2 || i === 4 || i === 5 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((item, i) => (
                    <tr key={i} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                    >
                      <td className="px-5 py-3">
                        <span className="inline-flex rounded-md px-2 py-0.5 text-xs font-medium" style={STATUS_STYLE[item.status] ?? { backgroundColor: 'rgba(82,82,92,0.2)', color: '#8A8A94' }}>
                          {STATUS_LABEL[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {item.magazordNum ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {item.magazordAmount ? fmt(parseFloat(item.magazordAmount)) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                        {item.marketplaceNum ?? <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {item.marketplaceAmount ? fmt(parseFloat(item.marketplaceAmount)) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {item.amountDiff && parseFloat(item.amountDiff) > 0 ? (
                          <span className="font-medium" style={{ color: 'var(--status-error)' }}>{fmt(parseFloat(item.amountDiff))}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)' }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-5 py-16 text-center">
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Nenhum item neste filtro</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
