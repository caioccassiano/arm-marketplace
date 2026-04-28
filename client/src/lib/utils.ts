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
    matched: 'bg-[rgba(124,194,58,0.15)] text-[#7CC23A]',
    amount_mismatch: 'bg-[rgba(229,83,75,0.15)] text-[#E5534B]',
    fee_mismatch: 'bg-[rgba(201,124,42,0.15)] text-[#C97C2A]',
    magazord_only: 'bg-[rgba(201,124,42,0.15)] text-[#C97C2A]',
    marketplace_only: 'bg-[rgba(75,142,232,0.15)] text-[#4B8EE8]',
    pending: 'bg-[rgba(82,82,92,0.3)] text-[#8A8A94]',
    running: 'bg-[rgba(75,142,232,0.15)] text-[#4B8EE8]',
    completed: 'bg-[rgba(124,194,58,0.15)] text-[#7CC23A]',
    failed: 'bg-[rgba(229,83,75,0.15)] text-[#E5534B]',
  }
  return map[status] ?? 'bg-[rgba(82,82,92,0.3)] text-[#8A8A94]'
}
