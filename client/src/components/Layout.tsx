import { NavLink } from 'react-router-dom'
import { type User } from '../lib/api.ts'

const NAV = [
  { to: '/taxas', label: 'Taxas', icon: <IconTaxas /> },
  { to: '/tiktok', label: 'TikTok × Magazord', icon: <IconTikTok /> },
  { to: '/cmv', label: 'Conciliar CMV', icon: <IconCmv /> },
  { to: '/cmv/tabela', label: 'Tabela CMV', icon: <IconTable /> },
  { to: '/lucratividade', label: 'Lucratividade', icon: <IconChart /> },
]

export default function Layout({ children, user }: { children: React.ReactNode; user: User }) {
  return (
    <div className="flex h-screen" style={{ backgroundColor: 'var(--bg-base)' }}>
      {/* Sidebar */}
      <aside
        className="flex w-56 flex-col"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRight: '1px solid var(--border)',
        }}
      >
        {/* Logo */}
        <div className="px-5 py-5" style={{ borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2.5">
            <ArmIcon />
            <div>
              <p className="text-sm font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                arm
              </p>
              <p
                className="text-[10px] font-medium uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', letterSpacing: '0.12em' }}
              >
                Market Placer
              </p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  isActive ? 'active-nav' : 'inactive-nav'
                }`
              }
              style={({ isActive }) =>
                isActive
                  ? {
                      backgroundColor: 'var(--arm-dim)',
                      color: 'var(--arm)',
                      boxShadow: 'inset 2px 0 0 var(--arm)',
                    }
                  : {
                      color: 'var(--text-secondary)',
                    }
              }
            >
              <span className="flex-shrink-0 w-4 h-4">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div
          className="px-4 py-4"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p
            className="text-xs font-medium truncate"
            style={{ color: 'var(--text-secondary)' }}
          >
            {user.name}
          </p>
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {user.email}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  )
}

function ArmIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect width="28" height="28" rx="6" fill="var(--bg-elevated)" />
      <line x1="8" y1="20" x2="13" y2="8" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="13" y1="20" x2="18" y2="8" stroke="var(--text-primary)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="13" cy="15" r="2.5" fill="var(--arm)" />
    </svg>
  )
}

function IconTaxas() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 11L5 5m9 6L11 5M5 5l3 6 3-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function IconTikTok() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="5" height="12" rx="1" />
      <rect x="9" y="2" width="5" height="12" rx="1" />
    </svg>
  )
}

function IconCmv() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 8h12M8 2v12" strokeLinecap="round" />
      <circle cx="8" cy="8" r="5.5" />
    </svg>
  )
}

function IconTable() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="2" y="2" width="12" height="12" rx="2" />
      <path d="M2 6h12M6 6v8" strokeLinecap="round" />
    </svg>
  )
}

function IconChart() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M2 12L5 8l3 2 3-4 3 2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
