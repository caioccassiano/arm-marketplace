export function fmt(value: string | number | null | undefined): string {
  const n = parseFloat(String(value ?? 0))
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n)
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(
    new Date(iso),
  )
}

export function marketplaceLabel(key: string | null | undefined): string {
  const map: Record<string, string> = {
    mercado_livre: 'Mercado Livre',
    tiktok_shop: 'TikTok Shop',
    magazord: 'Magazord',
  }
  return map[key ?? ''] ?? key ?? '—'
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    matched: 'Conciliado',
    amount_mismatch: 'Divergência de valor',
    fee_mismatch: 'Divergência de taxa',
    magazord_only: 'Só no Magazord',
    marketplace_only: 'Só no Marketplace',
    pending: 'Pendente',
    running: 'Processando',
    completed: 'Concluído',
    failed: 'Falhou',
  }
  return map[status] ?? status
}

export function statusColor(status: string): string {
  const map: Record<string, string> = {
    matched: 'bg-green-100 text-green-800',
    amount_mismatch: 'bg-red-100 text-red-800',
    fee_mismatch: 'bg-yellow-100 text-yellow-800',
    magazord_only: 'bg-orange-100 text-orange-800',
    marketplace_only: 'bg-purple-100 text-purple-800',
    pending: 'bg-gray-100 text-gray-700',
    running: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }
  return map[status] ?? 'bg-gray-100 text-gray-700'
}
