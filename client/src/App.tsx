import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { type User } from './lib/api.ts'
import Dashboard from './pages/Dashboard.tsx'
import Reconciliation from './pages/Reconciliation.tsx'
import ReconciliationDetail from './pages/ReconciliationDetail.tsx'
import ManualUpload from './pages/ManualUpload.tsx'
import Lucratividade from './pages/Lucratividade.tsx'
import LucratividadeDetail from './pages/LucratividadeDetail.tsx'
import TikTokReconciliation from './pages/TikTokReconciliation.tsx'
import CmvReconciliation from './pages/CmvReconciliation.tsx'
import CmvTable from './pages/CmvTable.tsx'
import FeitoriaDetail from './pages/FeitoriaDetail.tsx'
import Taxas from './pages/Taxas.tsx'
import Login from './pages/Login.tsx'
import Layout from './components/Layout.tsx'

function Shell({ user, children }: { user: User | null | undefined; children: React.ReactNode }) {
  if (!user) return <Navigate to="/login" replace />
  return <Layout user={user}>{children}</Layout>
}

export default function App() {
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (!res.ok) return null
      return res.json() as Promise<User>
    },
    retry: false,
    staleTime: Infinity,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ backgroundColor: 'var(--bg-base)' }}>
        <div
          className="h-5 w-5 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--border-strong)', borderTopColor: 'var(--arm)' }}
        />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
        <Route path="/" element={<Shell user={user}><Dashboard /></Shell>} />
        <Route path="/reconciliation" element={<Shell user={user}><Reconciliation /></Shell>} />
        <Route path="/reconciliation/:id" element={<Shell user={user}><ReconciliationDetail /></Shell>} />
        <Route path="/upload" element={<Shell user={user}><ManualUpload /></Shell>} />
        <Route path="/lucratividade" element={<Shell user={user}><Lucratividade /></Shell>} />
        <Route path="/lucratividade/:id" element={<Shell user={user}><LucratividadeDetail /></Shell>} />
        <Route path="/tiktok" element={<Shell user={user}><TikTokReconciliation /></Shell>} />
        <Route path="/cmv" element={<Shell user={user}><CmvReconciliation /></Shell>} />
        <Route path="/cmv/tabela" element={<Shell user={user}><CmvTable /></Shell>} />
        <Route path="/cmv/feitoria/:id" element={<Shell user={user}><FeitoriaDetail /></Shell>} />
        <Route path="/taxas" element={<Shell user={user}><Taxas /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
