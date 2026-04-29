const BASE = '/api'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...(init?.headers as Record<string, string> | undefined) }
  if (init?.body !== undefined && headers['Content-Type'] === undefined) {
    headers['Content-Type'] = 'application/json'
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...init,
    headers,
  })

  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Não autenticado')
  }

  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `Erro ${res.status}`)
  }

  return res.json() as Promise<T>
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),

  cmv: {
    list: () => request<{ items: CmvProduct[]; total: number }>('/cmv'),
    create: (data: { codigo: string; produtoId?: string | null; descricao?: string | null; preco: string }) =>
      request<CmvProduct>('/cmv', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: number, data: Partial<{ codigo: string; produtoId: string | null; descricao: string | null; preco: string }>) =>
      request<CmvProduct>(`/cmv/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id: number) => request<{ ok: boolean }>(`/cmv/${id}`, { method: 'DELETE' }),
  },
}

// ── Types ─────────────────────────────────────────────────────────────────────
export interface User {
  id: number
  email: string
  name: string
}

export interface Order {
  id: number
  source: string
  externalId: string
  orderNumber: string | null
  status: string
  marketplace: string | null
  customerName: string | null
  totalAmount: string
  marketplaceFee: string | null
  shippingFee: string | null
  netAmount: string | null
  orderedAt: string
  syncedAt: string
}

export interface ReconciliationSession {
  id: number
  marketplace: string
  periodStart: string
  periodEnd: string
  status: string
  totalMagazordOrders: number | null
  totalMarketplaceOrders: number | null
  matchedCount: number | null
  amountMismatchCount: number | null
  magazordOnlyCount: number | null
  marketplaceOnlyCount: number | null
  totalAmountDiff: string | null
  createdAt: string
  completedAt: string | null
}

export interface ReconciliationItem {
  id: number
  status: string
  magazordAmount: string | null
  marketplaceAmount: string | null
  amountDiff: string | null
  magazordFee: string | null
  marketplaceFee: string | null
  feeDiff: string | null
  notes: string | null
  resolvedAt: string | null
  magazordOrderId: number | null
  marketplaceOrderId: number | null
}

export interface SummaryRow {
  source: string
  marketplace: string | null
  totalOrders: number
  totalAmount: string | null
  totalFees: string | null
  totalShipping: string | null
  totalNet: string | null
}

export interface GmvDaily {
  day: string
  source: string
  marketplace: string | null
  totalOrders: number
  totalAmount: string | null
}

export interface CmvProduct {
  id: number
  codigo: string
  produtoId: string | null
  descricao: string | null
  preco: string
  updatedAt: string
}

export type FeeType = 'FIXED' | 'PERCENTUAL'
export type FeeAttribution = 'PER_ORDER' | 'PER_ITEM'

export interface Fee {
  id: number
  description: string
  feeType: FeeType
  value: string
  attributionType: FeeAttribution
  isActive: boolean
  createdAt: string
  updatedAt: string
}
