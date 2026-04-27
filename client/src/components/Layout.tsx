import { NavLink, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { api, type User } from '../lib/api.ts'

const NAV = [
  { to: '/', label: 'Dashboard', icon: '▦' },
  { to: '/reconciliation', label: 'Conciliação', icon: '⇄' },
  { to: '/orders', label: 'Pedidos', icon: '≡' },
]

export default function Layout({ children, user }: { children: React.ReactNode; user: User }) {
  const navigate = useNavigate()
  const qc = useQueryClient()

  async function logout() {
    await api.post('/auth/logout', {})
    qc.clear()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="flex w-56 flex-col bg-white shadow-sm">
        <div className="px-6 py-5 border-b border-gray-100">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">ARM</p>
          <h1 className="text-base font-bold text-gray-800 mt-0.5">Conciliação</h1>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                }`
              }
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-gray-100 px-4 py-4">
          <p className="text-xs font-medium text-gray-700 truncate">{user.name}</p>
          <p className="text-xs text-gray-400 truncate">{user.email}</p>
          <button
            onClick={logout}
            className="mt-2 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}
