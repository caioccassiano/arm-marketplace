import { useEffect, useState } from 'react'
import { api, type CmvProduct } from '../lib/api.ts'

interface EditForm {
  codigo: string
  produtoId: string
  descricao: string
  preco: string
}

const EMPTY_FORM: EditForm = { codigo: '', produtoId: '', descricao: '', preco: '' }

function formatBRL(preco: string): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(preco))
}

const inputStyle = {
  backgroundColor: 'var(--bg-base)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
  borderRadius: '0.375rem',
  padding: '0.25rem 0.5rem',
  fontSize: '0.875rem',
  width: '100%',
  outline: 'none',
}

function EditRow({
  form,
  saving,
  saveError,
  onChange,
  onSave,
  onCancel,
}: {
  form: EditForm
  saving: boolean
  saveError: string | null
  onChange: (f: EditForm) => void
  onSave: () => void
  onCancel: () => void
}) {
  return (
    <tr style={{ backgroundColor: 'rgba(124,194,58,0.06)', borderBottom: '1px solid var(--border)' }}>
      <td className="px-4 py-2">
        <input style={inputStyle} placeholder="Código" value={form.codigo} onChange={(e) => onChange({ ...form, codigo: e.target.value })} autoFocus />
      </td>
      <td className="px-4 py-2">
        <input style={inputStyle} placeholder="ID" value={form.produtoId} onChange={(e) => onChange({ ...form, produtoId: e.target.value })} />
      </td>
      <td className="px-4 py-2">
        <input style={inputStyle} placeholder="Descrição" value={form.descricao} onChange={(e) => onChange({ ...form, descricao: e.target.value })} />
      </td>
      <td className="px-4 py-2">
        <input style={{ ...inputStyle, textAlign: 'right' }} placeholder="0.00" type="number" step="0.01" min="0" value={form.preco} onChange={(e) => onChange({ ...form, preco: e.target.value })} />
      </td>
      <td className="px-4 py-2 text-right whitespace-nowrap">
        {saveError && <span className="mr-3 text-xs" style={{ color: 'var(--status-error)' }}>{saveError}</span>}
        <button onClick={onSave} disabled={saving} className="btn-primary mr-2 rounded px-3 py-1 text-xs font-medium disabled:opacity-50">
          {saving ? '…' : 'Salvar'}
        </button>
        <button onClick={onCancel} className="rounded px-3 py-1 text-xs font-medium transition-colors"
          style={{ border: '1px solid var(--border)', color: 'var(--text-secondary)', backgroundColor: 'transparent' }}>
          Cancelar
        </button>
      </td>
    </tr>
  )
}

export default function CmvTable() {
  const [products, setProducts] = useState<CmvProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<number | 'new' | null>(null)
  const [form, setForm] = useState<EditForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const CMV_PAGE_SIZE = 50

  useEffect(() => {
    api.cmv
      .list()
      .then((data) => setProducts(data.items))
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : 'Erro ao carregar'))
      .finally(() => setLoading(false))
  }, [])

  const filtered = products.filter((p) => {
    if (!search) return true
    const s = search.toLowerCase()
    return p.codigo.toLowerCase().includes(s) || (p.descricao?.toLowerCase().includes(s) ?? false)
  })
  const pagedFiltered = filtered.slice((page - 1) * CMV_PAGE_SIZE, page * CMV_PAGE_SIZE)
  const totalPages = Math.ceil(filtered.length / CMV_PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search])

  useEffect(() => {
    if (editingId && editingId !== 'new') {
      const idx = filtered.findIndex((p) => p.id === editingId)
      if (idx !== -1) setPage(Math.floor(idx / CMV_PAGE_SIZE) + 1)
    }
  }, [editingId]) // eslint-disable-line react-hooks/exhaustive-deps

  function startEdit(p: CmvProduct) {
    setEditingId(p.id)
    setForm({ codigo: p.codigo, produtoId: p.produtoId ?? '', descricao: p.descricao ?? '', preco: p.preco })
    setSaveError(null)
  }

  function startNew() {
    setEditingId('new')
    setForm(EMPTY_FORM)
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setSaveError(null)
  }

  async function save() {
    setSaving(true)
    setSaveError(null)
    try {
      if (editingId === 'new') {
        const created = await api.cmv.create({
          codigo: form.codigo,
          produtoId: form.produtoId || null,
          descricao: form.descricao || null,
          preco: form.preco,
        })
        setProducts((prev) => [created, ...prev])
      } else {
        const updated = await api.cmv.update(editingId as number, {
          codigo: form.codigo,
          produtoId: form.produtoId || null,
          descricao: form.descricao || null,
          preco: form.preco,
        })
        setProducts((prev) => prev.map((p) => (p.id === editingId ? updated : p)))
      }
      setEditingId(null)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number, codigo: string) {
    if (!window.confirm(`Excluir SKU "${codigo}"?`)) return
    try {
      await api.cmv.remove(id)
      setProducts((prev) => prev.filter((p) => p.id !== id))
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erro ao excluir')
    }
  }

  return (
    <div>
      <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>Tabela CMV</h1>
      <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>
        Gerencie os custos por SKU — fonte de verdade para cálculos de CMV
      </p>

      <div className="mt-6 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-6 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <input
            type="search"
            placeholder="Buscar por código ou descrição…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 rounded-lg px-3 py-2 text-sm outline-none"
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-primary)' }}
          />
          <span className="text-sm whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
            {filtered.length !== products.length
              ? `${filtered.length} de ${products.length} SKUs`
              : `${products.length} SKUs`}
          </span>
          <button
            onClick={startNew}
            disabled={editingId !== null}
            className="btn-primary rounded-lg px-4 py-2 text-sm disabled:opacity-40"
          >
            + Adicionar
          </button>
        </div>

        {loading ? (
          <p className="px-6 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>Carregando…</p>
        ) : loadError ? (
          <p className="px-6 py-8 text-center text-sm" style={{ color: 'var(--status-error)' }}>{loadError}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Código', 'ID Produto', 'Descrição', 'Preço', 'Ações'].map((h, i) => (
                    <th key={h} className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i === 3 || i === 4 ? 'text-right' : 'text-left'}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {editingId === 'new' && (
                  <EditRow form={form} saving={saving} saveError={saveError} onChange={setForm} onSave={save} onCancel={cancelEdit} />
                )}
                {filtered.length === 0 && editingId !== 'new' ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                      {search ? 'Nenhum SKU encontrado para esta busca.' : 'Nenhum SKU cadastrado.'}
                    </td>
                  </tr>
                ) : (
                  pagedFiltered.map((p) =>
                    editingId === p.id ? (
                      <EditRow key={p.id} form={form} saving={saving} saveError={saveError} onChange={setForm} onSave={save} onCancel={cancelEdit} />
                    ) : (
                      <tr key={p.id} className="transition-colors" style={{ borderBottom: '1px solid var(--border)' }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
                      >
                        <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{p.codigo}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.produtoId ?? '—'}</td>
                        <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>{p.descricao ?? '—'}</td>
                        <td className="px-4 py-3 text-right tabular-nums" style={{ color: 'var(--text-primary)' }}>{formatBRL(p.preco)}</td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button onClick={() => startEdit(p)} disabled={editingId !== null} className="mr-3 text-xs transition-colors disabled:opacity-30"
                            style={{ color: 'var(--arm-text)' }}>
                            Editar
                          </button>
                          <button onClick={() => remove(p.id, p.codigo)} disabled={editingId !== null} className="text-xs transition-colors disabled:opacity-30"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--status-error)')}
                            onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}>
                            Excluir
                          </button>
                        </td>
                      </tr>
                    ),
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && !loadError && filtered.length > CMV_PAGE_SIZE && (
          <div className="flex items-center justify-between px-6 py-3" style={{ borderTop: '1px solid var(--border)' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Mostrando {(page - 1) * CMV_PAGE_SIZE + 1}–{Math.min(page * CMV_PAGE_SIZE, filtered.length)} de {filtered.length} SKUs
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
  )
}
