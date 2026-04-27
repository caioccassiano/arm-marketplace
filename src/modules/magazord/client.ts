import { env } from '../../config/env.js'

export interface MagazordOrder {
  id: string
  numero: string
  status: string
  marketplace: string | null
  valorTotal: number
  valorFrete: number
  comissaoMarketplace: number
  nomeCliente: string
  dataPedido: string
  raw: unknown
}

export class MagazordClient {
  private readonly baseUrl: string
  private readonly apiKey: string
  private readonly storeId: string

  constructor() {
    this.baseUrl = env.MAGAZORD_API_URL
    this.apiKey = env.MAGAZORD_API_KEY
    this.storeId = env.MAGAZORD_STORE_ID
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'X-Store-Id': this.storeId,
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Magazord API ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  async getOrders(dateFrom: Date, dateTo: Date): Promise<MagazordOrder[]> {
    interface RawResponse {
      data: Array<{
        id: string
        numero: string
        status: string
        origem?: string
        totais: { total: number; frete: number; comissao: number }
        cliente: { nome: string }
        dataCriacao: string
      }>
    }

    const raw = await this.request<RawResponse>('/v1/pedidos', {
      dataInicio: dateFrom.toISOString().split('T')[0]!,
      dataFim: dateTo.toISOString().split('T')[0]!,
      limite: '500',
    })

    return raw.data.map((o) => ({
      id: o.id,
      numero: o.numero,
      status: o.status,
      marketplace: o.origem ?? null,
      valorTotal: o.totais.total,
      valorFrete: o.totais.frete,
      comissaoMarketplace: o.totais.comissao,
      nomeCliente: o.cliente.nome,
      dataPedido: o.dataCriacao,
      raw: o,
    }))
  }
}
