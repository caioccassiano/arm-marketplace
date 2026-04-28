import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, type Fee, type FeeAttribution, type FeeType } from '../lib/api.ts'
import { fmt } from '../lib/utils.ts'

interface FormState {
  description: string
  feeType: FeeType
  value: string
  attributionType: FeeAttribution
}

const EMPTY_FORM: FormState = {
  description: '',
  feeType: 'PERCENTUAL',
  value: '',
  attributionType: 'PER_ORDER',
}

function formatValue(fee: Fee): string {
  if (fee.feeType === 'FIXED') return fmt(fee.value)
  const n = parseFloat(fee.value)
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 4 })}%`
}

function attributionLabel(a: FeeAttribution): string {
  return a === 'PER_ORDER' ? 'Por pedido' : 'Por peça'
}

function feeTypeLabel(t: FeeType): string {
  return t === 'FIXED' ? 'Fixo (R$)' : 'Percentual (%)'
}

const inputCls = 'w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-colors'
const inputStyle = {
  backgroundColor: 'var(--bg-elevated)',
  border: '1px solid var(--border)',
  color: 'var(--text-primary)',
}

export default function Taxas() {
  const qc = useQueryClient()
  const [includeInactive, setIncludeInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Fee | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: list, isLoading } = useQuery({
    queryKey: ['fees', includeInactive],
    queryFn: () =>
      api.get<Fee[]>(`/fees${includeInactive ? '?includeInactive=true' : ''}`),
  })

  const invalidate = () => qc.invalidateQueries({ queryKey: ['fees'] })

  const createMutation = useMutation({
    mutationFn: (body: { description: string; feeType: FeeType; value: number; attributionType: FeeAttribution }) =>
      api.post<Fee>('/fees', body),
    onSuccess: () => { invalidate(); closeModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const updateMutation = useMutation({
    mutationFn: (input: { id: number; body: Record<string, unknown> }) =>
      api.patch<Fee>(`/fees/${input.id}`, input.body),
    onSuccess: () => { invalidate(); closeModal() },
    onError: (err: Error) => setFormError(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.delete<{ ok: true }>(`/fees/${id}`),
    onSuccess: () => invalidate(),
  })

  const reactivateMutation = useMutation({
    mutationFn: (id: number) => api.patch<Fee>(`/fees/${id}`, { isActive: true }),
    onSuccess: () => invalidate(),
  })

  function openCreate() {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEdit(fee: Fee) {
    setEditing(fee)
    setForm({
      description: fee.description,
      feeType: fee.feeType,
      value: parseFloat(fee.value).toString().replace('.', ','),
      attributionType: fee.attributionType,
    })
    setFormError(null)
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function submit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const description = form.description.trim()
    if (!description) { setFormError('Descrição é obrigatória.'); return }
    const numericValue = parseFloat(form.value.replace(',', '.'))
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      setFormError('Valor deve ser maior que zero.')
      return
    }
    const body = { description, feeType: form.feeType, value: numericValue, attributionType: form.attributionType }
    if (editing) {
      updateMutation.mutate({ id: editing.id, body })
    } else {
      createMutation.mutate(body)
    }
  }

  function confirmDelete(fee: Fee) {
    if (!window.confirm(`Desativar a taxa "${fee.description}"?`)) return
    deleteMutation.mutate(fee.id)
  }

  const submitting = createMutation.isPending || updateMutation.isPending

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h2
          className="text-xl font-semibold"
          style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
        >
          Taxas
        </h2>
        <button
          onClick={openCreate}
          className="btn-primary rounded-lg px-4 py-2 text-sm"
        >
          + Nova taxa
        </button>
      </div>

      <div className="mb-6">
        <label className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
            className="rounded"
            style={{ accentColor: 'var(--arm)' }}
          />
          Mostrar inativas
        </label>
      </div>

      <div
        className="rounded-xl overflow-hidden"
        style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              {['Descrição', 'Tipo', 'Valor', 'Atribuição', 'Status', 'Ações'].map((h, i) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-[10px] font-medium uppercase tracking-widest ${i < 4 ? 'text-left' : i === 5 ? 'text-right' : 'text-left'}`}
                  style={{ color: 'var(--text-muted)' }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Carregando...
                </td>
              </tr>
            )}
            {list?.map((fee) => (
              <tr
                key={fee.id}
                className="transition-colors"
                style={{ borderBottom: '1px solid var(--border)' }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-elevated)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '')}
              >
                <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                  {fee.description}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      fee.feeType === 'PERCENTUAL'
                        ? { backgroundColor: 'rgba(75,142,232,0.15)', color: '#4B8EE8' }
                        : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }
                    }
                  >
                    {feeTypeLabel(fee.feeType)}
                  </span>
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-medium" style={{ color: 'var(--text-primary)' }}>
                  {formatValue(fee)}
                </td>
                <td className="px-4 py-3" style={{ color: 'var(--text-secondary)' }}>
                  {attributionLabel(fee.attributionType)}
                </td>
                <td className="px-4 py-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-xs font-medium"
                    style={
                      fee.isActive
                        ? { backgroundColor: 'rgba(124,194,58,0.15)', color: 'var(--arm)' }
                        : { backgroundColor: 'rgba(229,83,75,0.15)', color: 'var(--status-error)' }
                    }
                  >
                    {fee.isActive ? 'Ativa' : 'Inativa'}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => openEdit(fee)}
                      className="text-sm transition-colors"
                      style={{ color: 'var(--text-muted)' }}
                      onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--arm)')}
                      onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                      title="Editar"
                    >
                      ✎
                    </button>
                    {fee.isActive ? (
                      <button
                        onClick={() => confirmDelete(fee)}
                        className="text-sm transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--status-error)')}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                        title="Desativar"
                      >
                        ✕
                      </button>
                    ) : (
                      <button
                        onClick={() => reactivateMutation.mutate(fee.id)}
                        className="text-sm transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => ((e.target as HTMLElement).style.color = 'var(--arm)')}
                        onMouseLeave={(e) => ((e.target as HTMLElement).style.color = 'var(--text-muted)')}
                        title="Reativar"
                      >
                        ↺
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {!isLoading && list?.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  Nenhuma taxa cadastrada
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-24"
          style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
          onClick={closeModal}
        >
          <div
            className="w-[480px] rounded-xl p-6"
            style={{
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              boxShadow: '0 25px 60px rgba(0,0,0,0.6)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className="mb-5 text-base font-semibold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              {editing ? 'Editar taxa' : 'Nova taxa'}
            </h3>

            {formError && (
              <div
                className="mb-4 rounded-lg px-3 py-2 text-sm"
                style={{
                  backgroundColor: 'rgba(229,83,75,0.12)',
                  border: '1px solid rgba(229,83,75,0.3)',
                  color: 'var(--status-error)',
                }}
              >
                {formError}
              </div>
            )}

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label
                  className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Descrição
                </label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className={inputCls}
                  style={inputStyle}
                  placeholder="Ex.: Comissão Mercado Livre Premium"
                  autoFocus
                />
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Tipo
                </label>
                <div className="flex gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="feeType"
                      checked={form.feeType === 'FIXED'}
                      onChange={() => setForm((f) => ({ ...f, feeType: 'FIXED' }))}
                      style={{ accentColor: 'var(--arm)' }}
                    />
                    Valor fixo (R$)
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="feeType"
                      checked={form.feeType === 'PERCENTUAL'}
                      onChange={() => setForm((f) => ({ ...f, feeType: 'PERCENTUAL' }))}
                      style={{ accentColor: 'var(--arm)' }}
                    />
                    Percentual (%)
                  </label>
                </div>
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Valor
                </label>
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={form.value}
                    onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                    className={`${inputCls} pr-12`}
                    style={inputStyle}
                    placeholder={form.feeType === 'FIXED' ? '9,90' : '5,5'}
                  />
                  <span
                    className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {form.feeType === 'FIXED' ? 'R$' : '%'}
                  </span>
                </div>
                {form.feeType === 'PERCENTUAL' && (
                  <p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                    Use o número humano: 5,5 = 5,5%.
                  </p>
                )}
              </div>

              <div>
                <label
                  className="mb-1.5 block text-[10px] font-medium uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Atribuição
                </label>
                <div className="flex gap-4 text-sm" style={{ color: 'var(--text-secondary)' }}>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="attributionType"
                      checked={form.attributionType === 'PER_ORDER'}
                      onChange={() => setForm((f) => ({ ...f, attributionType: 'PER_ORDER' }))}
                      style={{ accentColor: 'var(--arm)' }}
                    />
                    Por pedido
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="attributionType"
                      checked={form.attributionType === 'PER_ITEM'}
                      onChange={() => setForm((f) => ({ ...f, attributionType: 'PER_ITEM' }))}
                      style={{ accentColor: 'var(--arm)' }}
                    />
                    Por peça
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg px-4 py-2 text-sm transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  disabled={submitting}
                  onMouseEnter={(e) => ((e.target as HTMLElement).style.backgroundColor = 'var(--bg-elevated)')}
                  onMouseLeave={(e) => ((e.target as HTMLElement).style.backgroundColor = '')}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="btn-primary rounded-lg px-4 py-2 text-sm"
                  disabled={submitting}
                >
                  {submitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
