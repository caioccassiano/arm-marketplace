import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api.ts'

interface LucratividadeRow {
  id: number
  feitoriaId: number
  feitoriaTitle: string
  feitoriaItemCount: number
  feitoriaCreatedAt: string
  investimentoAds: string
  feesCount: number
  createdAt: string
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

export default function Lucratividade() {
  const [entries, setEntries] = useState<LucratividadeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  async function refresh() {
    setLoading(true)
    try {
      const list = await api.get<LucratividadeRow[]>('/lucratividade')
      setEntries(list)
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro ao carregar' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  async function handleRemove(id: number) {
    if (!confirm('Remover esta entrada da lucratividade?')) return
    try {
      await api.delete(`/lucratividade/${id}`)
      setEntries((prev) => prev.filter((e) => e.id !== id))
    } catch (err) {
      setMsg({ kind: 'err', text: err instanceof Error ? err.message : 'Erro ao remover' })
    }
  }

  const cardStyle = { backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Lucratividade</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
          Feitorias confrontadas com as taxas cadastradas para calcular a lucratividade real
        </p>
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

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Entradas salvas</h2>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{entries.length} entrada(s)</span>
        </div>

        {loading ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : entries.length === 0 ? (
          <div className="rounded-xl p-10 text-center" style={{ border: '2px dashed var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              Nenhuma entrada ainda. Vá para{' '}
              <Link to="/cmv" className="underline" style={{ color: 'var(--arm)' }}>Conciliar CMV</Link>{' '}
              e clique em <span className="font-medium">+ Lucratividade</span> em uma feitoria.
            </p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={cardStyle}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Feitoria', 'Pedidos', 'Taxas', 'Adicionada em', 'Ações'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 1 || i === 2 || i === 4 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                    onMouseEnter={(ev) => (ev.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                    onMouseLeave={(ev) => (ev.currentTarget.style.backgroundColor = '')}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/lucratividade/${e.id}`} className="font-medium transition-colors" style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={(ev) => ((ev.target as HTMLElement).style.color = 'var(--arm)')}
                        onMouseLeave={(ev) => ((ev.target as HTMLElement).style.color = 'var(--text-primary)')}>
                        {e.feitoriaTitle}
                      </Link>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        Feitoria de {fmtDateTime(e.feitoriaCreatedAt)}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{e.feitoriaItemCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-secondary)' }}>{e.feesCount} ativa(s)</td>
                    <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{fmtDateTime(e.createdAt)}</td>
                    <td className="px-4 py-3 text-right space-x-3">
                      <Link to={`/lucratividade/${e.id}`} className="text-xs transition-colors" style={{ color: 'var(--arm)' }}>
                        Ver lucratividade
                      </Link>
                      <button onClick={() => handleRemove(e.id)} className="text-xs transition-colors" style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(ev) => ((ev.target as HTMLElement).style.color = 'var(--status-error)')}
                        onMouseLeave={(ev) => ((ev.target as HTMLElement).style.color = 'var(--text-muted)')}>
                        Remover
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
