import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, type User } from './lib/api.ts'
import Login from './pages/Login.tsx'
import Dashboard from './pages/Dashboard.tsx'
import Reconciliation from './pages/Reconciliation.tsx'
import ReconciliationDetail from './pages/ReconciliationDetail.tsx'
import Orders from './pages/Orders.tsx'
import Layout from './components/Layout.tsx'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<User>('/auth/me'),
    retry: false,
  })

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
      </div>
    )
  }

  if (isError || !data) return <Navigate to="/login" replace />

  return <Layout user={data}>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reconciliation"
          element={
            <ProtectedRoute>
              <Reconciliation />
            </ProtectedRoute>
          }
        />
        <Route
          path="/reconciliation/:id"
          element={
            <ProtectedRoute>
              <ReconciliationDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/orders"
          element={
            <ProtectedRoute>
              <Orders />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
