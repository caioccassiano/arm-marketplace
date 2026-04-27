import { env } from '../../config/env.js'

export interface MercadoLivreOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  buyerName: string
  shippingCost: number
  marketplaceFee: number
  dateCreated: string
  raw: unknown
}

interface MLOrdersResponse {
  results: Array<{
    id: number
    status: string
    date_created: string
    total_amount: number
    buyer: { nickname: string; first_name: string; last_name: string }
    shipping?: { cost: number }
    marketplace_fee?: number
    order_items: Array<{ item: { id: string; title: string }; quantity: number; unit_price: number }>
  }>
  paging: { total: number; offset: number; limit: number }
}

export class MercadoLivreClient {
  private readonly baseUrl = 'https://api.mercadolibre.com'

  private get accessToken() {
    return env.ML_ACCESS_TOKEN
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Mercado Livre API ${res.status}: ${body}`)
    }

    return res.json() as Promise<T>
  }

  async getOrders(dateFrom: Date, dateTo: Date): Promise<MercadoLivreOrder[]> {
    const sellerId = env.ML_SELLER_ID
    const allOrders: MercadoLivreOrder[] = []
    let offset = 0
    const limit = 50

    while (true) {
      const data = await this.request<MLOrdersResponse>(`/orders/search`, {
        seller: sellerId,
        'order.date_created.from': dateFrom.toISOString(),
        'order.date_created.to': dateTo.toISOString(),
        sort: 'date_asc',
        offset: String(offset),
        limit: String(limit),
      })

      for (const o of data.results) {
        allOrders.push({
          id: String(o.id),
          orderNumber: String(o.id),
          status: o.status,
          totalAmount: o.total_amount,
          buyerName: o.buyer.nickname || `${o.buyer.first_name} ${o.buyer.last_name}`,
          shippingCost: o.shipping?.cost ?? 0,
          marketplaceFee: o.marketplace_fee ?? 0,
          dateCreated: o.date_created,
          raw: o,
        })
      }

      if (offset + limit >= data.paging.total) break
      offset += limit
    }

    return allOrders
  }

  getOAuthUrl(redirectUri: string): string {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.ML_APP_ID,
      redirect_uri: redirectUri,
    })
    return `https://auth.mercadolivre.com.br/authorization?${params}`
  }

  async exchangeCode(code: string, redirectUri: string) {
    const res = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: env.ML_APP_ID,
        client_secret: env.ML_APP_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
    })
    if (!res.ok) throw new Error(`ML OAuth error: ${await res.text()}`)
    return res.json() as Promise<{ access_token: string; refresh_token: string; user_id: number }>
  }
}
