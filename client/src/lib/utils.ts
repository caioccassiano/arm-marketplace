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
    matched: 'bg-[rgba(124,194,58,0.12)] text-[#3A7D0A]',
    amount_mismatch: 'bg-[rgba(220,38,38,0.10)] text-[#B91C1C]',
    fee_mismatch: 'bg-[rgba(217,119,6,0.12)] text-[#92400E]',
    magazord_only: 'bg-[rgba(217,119,6,0.12)] text-[#92400E]',
    marketplace_only: 'bg-[rgba(37,99,235,0.10)] text-[#1D4ED8]',
    pending: 'bg-[rgba(107,114,128,0.12)] text-[#4B5563]',
    running: 'bg-[rgba(37,99,235,0.10)] text-[#1D4ED8]',
    completed: 'bg-[rgba(124,194,58,0.12)] text-[#3A7D0A]',
    failed: 'bg-[rgba(220,38,38,0.10)] text-[#B91C1C]',
  }
  return map[status] ?? 'bg-[rgba(107,114,128,0.12)] text-[#4B5563]'
}
