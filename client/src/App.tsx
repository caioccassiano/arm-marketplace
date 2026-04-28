import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import Layout from './components/Layout.tsx'

const FAKE_USER = { id: 0, email: 'admin@arm.com', name: 'Admin' }

function Shell({ children }: { children: React.ReactNode }) {
  return <Layout user={FAKE_USER}>{children}</Layout>
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Shell><Dashboard /></Shell>} />
        <Route path="/reconciliation" element={<Shell><Reconciliation /></Shell>} />
        <Route path="/reconciliation/:id" element={<Shell><ReconciliationDetail /></Shell>} />
        <Route path="/upload" element={<Shell><ManualUpload /></Shell>} />
        <Route path="/lucratividade" element={<Shell><Lucratividade /></Shell>} />
        <Route path="/lucratividade/:id" element={<Shell><LucratividadeDetail /></Shell>} />
        <Route path="/tiktok" element={<Shell><TikTokReconciliation /></Shell>} />
        <Route path="/cmv" element={<Shell><CmvReconciliation /></Shell>} />
        <Route path="/cmv/tabela" element={<Shell><CmvTable /></Shell>} />
        <Route path="/cmv/feitoria/:id" element={<Shell><FeitoriaDetail /></Shell>} />
        <Route path="/taxas" element={<Shell><Taxas /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
