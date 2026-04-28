import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api.ts'

export default function Login() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await api.post('/auth/login', { email, password })
      await qc.invalidateQueries({ queryKey: ['me'] })
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div
            className="flex items-center justify-center w-12 h-12 rounded-xl"
            style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <line x1="6" y1="18" x2="10" y2="6" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="11" y1="18" x2="15" y2="6" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="10.5" cy="13" r="2.5" fill="var(--arm)" />
            </svg>
          </div>
          <div className="text-center">
            <h1
              className="text-lg font-semibold"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
            >
              arm Market Placer
            </h1>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
              uso interno
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-7 space-y-5"
          style={{
            backgroundColor: 'var(--bg-surface)',
            border: '1px solid var(--border)',
          }}
        >
          {error && (
            <div
              className="rounded-lg px-4 py-3 text-sm"
              style={{
                backgroundColor: 'rgba(229,83,75,0.12)',
                border: '1px solid rgba(229,83,75,0.3)',
                color: 'var(--status-error)',
              }}
            >
              {error}
            </div>
          )}

          <div>
            <label
              className="block text-xs font-medium uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="input-dark block w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label
              className="block text-xs font-medium uppercase tracking-widest mb-1.5"
              style={{ color: 'var(--text-muted)' }}
            >
              Senha
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-dark block w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full rounded-lg px-4 py-2.5 text-sm transition-colors"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  )
}
