import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'
import { fmt } from '../lib/utils.ts'

interface FeitoriaRow {
  id: number
  title: string
  itemCount: number
  totalDiff: string
  createdAt: string
}

interface CmvStats {
  total: number
  lastUpdated: string | null
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

interface LucratividadeRow {
  id: number
  feitoriaId: number
}

export default function CmvReconciliation() {
  const [feitorias, setFeitorias] = useState<FeitoriaRow[]>([])
  const [stats, setStats] = useState<CmvStats>({ total: 0, lastUpdated: null })
  const [lucratividadeIds, setLucratividadeIds] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function refresh() {
    setLoading(true)
    try {
      const [list, s, lucList] = await Promise.all([
        api.get<FeitoriaRow[]>('/feitorias'),
        api.get<CmvStats>('/cmv/stats'),
        api.get<LucratividadeRow[]>('/lucratividade'),
      ])
      setFeitorias(list)
      setStats(s)
      setLucratividadeIds(new Set(lucList.map((l) => l.feitoriaId)))
    } catch (err) {
      setMsg({
        kind: 'err',
        text: err instanceof Error ? err.message : 'Erro ao carregar dados',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleAddToLucratividade(feitoriaId: number) {
    try {
      await api.post('/lucratividade', { feitoriaId })
      setLucratividadeIds((prev) => new Set([...prev, feitoriaId]))
      setMsg({ kind: 'ok', text: 'Feitoria adicionada à Lucratividade.' })
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro ao adicionar' })
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleUpload(file: File) {
    setUploading(true)
    setMsg(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/cmv/upload', {
        method: 'POST',
        body: fd,
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(body.error ?? `Erro ${res.status}`)
      }
      const data = (await res.json()) as { upserted: number; total: number }
      setMsg({ kind: 'ok', text: `${data.upserted} SKU(s) atualizados. Total: ${data.total}.` })
      await refresh()
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro no upload' })
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function handleDelete(id: number) {
    if (!confirm('Deletar esta feitoria? Esta ação é irreversível.')) return
    try {
      await api.delete(`/feitorias/${id}`)
      setFeitorias((prev) => prev.filter((f) => f.id !== id))
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro ao deletar' })
    }
  }

  function startEditing(f: FeitoriaRow) {
    setEditingId(f.id)
    setEditingTitle(f.title)
  }

  async function saveTitle(id: number) {
    const title = editingTitle.trim()
    if (!title) { setEditingId(null); return }
    try {
      await api.patch(`/feitorias/${id}`, { title })
      setFeitorias((prev) => prev.map((f) => (f.id === id ? { ...f, title } : f)))
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro ao renomear' })
    } finally {
      setEditingId(null)
    }
  }

  const cardStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Conciliar CMV</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Cruze suas Feitorias salvas com a tabela de custos (CMV) por SKU
        </p>
      </div>

      {/* CMV table panel */}
      <div className="rounded-xl p-6 space-y-4" style={cardStyle}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Tabela CMV ativa</h2>
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              {stats.total > 0
                ? `${stats.total} SKU(s) cadastrados — última atualização: ${fmtDateTime(stats.lastUpdated)}`
                : 'Nenhum SKU cadastrado ainda. Faça o upload da tabela de derivações.'}
            </p>
          </div>
          <div>
            <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f) }}
            />
            <button onClick={() => inputRef.current?.click()} disabled={uploading}
              className="btn-primary flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium disabled:opacity-40">
              {uploading && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
              {uploading ? 'Enviando…' : stats.total > 0 ? 'Atualizar tabela CMV' : 'Enviar tabela CMV'}
            </button>
          </div>
        </div>

        {msg && (
          <div className="text-sm rounded-lg px-4 py-2" style={
            msg.kind === 'ok'
              ? { backgroundColor: 'rgba(124,194,58,0.12)', color: 'var(--arm)', border: '1px solid rgba(124,194,58,0.25)' }
              : { backgroundColor: 'rgba(229,83,75,0.12)', color: 'var(--status-error)', border: '1px solid rgba(229,83,75,0.25)' }
          }>
            {msg.text}
          </div>
        )}

        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Formato esperado: CSV exportado do Magazord (Código; Id Produto; Produto - Derivação; preço). Upload faz upsert por Código (SKU pai).
        </p>
      </div>

      {/* Feitorias list */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Feitorias salvas</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{feitorias.length} salva(s)</span>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : feitorias.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ border: '2px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Nenhuma feitoria salva ainda. Vá para{' '}
              <Link to="/tiktok" className="underline" style={{ color: 'var(--arm)' }}>TikTok × Magazord</Link>{' '}
              e clique em <span className="font-medium">Salvar Feitoria</span> para criar uma.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Título', 'Pedidos', 'Dif. Total', 'Salva em', 'Ações'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 1 || i === 2 || i === 4 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feitorias.map((f) => (
                  <tr key={f.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-3">
                      {editingId === f.id ? (
                        <input autoFocus value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onBlur={() => saveTitle(f.id)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveTitle(f.id); if (e.key === 'Escape') setEditingId(null) }}
                          className="w-full rounded px-2 py-0.5 text-sm font-medium outline-none"
                          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--arm)', color: 'var(--text-primary)' }}
                        />
                      ) : (
                        <div className="flex items-center gap-2 group">
                          <Link to={`/cmv/feitoria/${f.id}`} className="font-medium transition-colors" style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--arm)')}
                            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-primary)')}>
                            {f.title}
                          </Link>
                          <button onClick={() => startEditing(f)} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-muted)' }} title="Renomear">
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 11l6.586-6.586a2 2 0 112.828 2.828L11.828 13.828A2 2 0 0111 14H9v-2a2 2 0 01.586-1.414z" />
                            </svg>
                          </button>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{f.itemCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{fmt(f.totalDiff)}</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDateTime(f.createdAt)}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      {lucratividadeIds.has(f.id) ? (
                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Já adicionada</span>
                      ) : (
                        <button onClick={() => handleAddToLucratividade(f.id)} className="text-xs transition-colors" style={{ color: 'var(--arm)' }}>
                          + Lucratividade
                        </button>
                      )}
                      <button onClick={() => handleDelete(f.id)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--status-error)')}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}>
                        Deletar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
