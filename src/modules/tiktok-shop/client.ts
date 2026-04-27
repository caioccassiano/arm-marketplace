import { createHmac } from 'node:crypto'
import { env } from '../../config/env.js'

export interface TikTokOrder {
  id: string
  orderNumber: string
  status: string
  totalAmount: number
  buyerName: string
  platformFee: number
  sellerShippingFee: number
  createTime: string
  raw: unknown
}

interface TikTokResponse<T> {
  code: number
  message: string
  data: T
  request_id: string
}

interface TikTokOrderList {
  orders: Array<{
    order_id: string
    order_status: string
    create_time: number
    payment_info: {
      total_amount: string
      platform_discount: string
      seller_discount: string
      shipping_fee: string
      original_total_product_price: string
    }
    buyer_info: { buyer_uid: string }
    line_items: Array<{ sku_id: string; quantity: number; sku_original_price: string }>
  }>
  next_page_token: string
  total_count: number
}

export class TikTokShopClient {
  private readonly baseUrl = 'https://open-api.tiktokglobalshop.com'

  private sign(path: string, params: Record<string, string>, timestamp: number): string {
    const sorted = Object.keys(params)
      .filter((k) => k !== 'sign' && k !== 'access_token')
      .sort()
      .map((k) => `${k}${params[k]}`)
      .join('')

    const str = `${env.TIKTOK_APP_SECRET}${path}${sorted}${timestamp}${env.TIKTOK_APP_SECRET}`
    return createHmac('sha256', env.TIKTOK_APP_SECRET).update(str).digest('hex')
  }

  private async request<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    const timestamp = Math.floor(Date.now() / 1000)
    const baseParams: Record<string, string> = {
      app_key: env.TIKTOK_APP_KEY,
      shop_cipher: env.TIKTOK_SHOP_CIPHER,
      timestamp: String(timestamp),
      version: '202309',
      ...params,
    }

    baseParams['sign'] = this.sign(path, baseParams, timestamp)

    const url = new URL(`${this.baseUrl}${path}`)
    url.searchParams.set('access_token', env.TIKTOK_ACCESS_TOKEN)
    for (const [k, v] of Object.entries(baseParams)) url.searchParams.set(k, v)

    const res = await fetch(url.toString(), {
      headers: { 'Content-Type': 'application/json' },
    })

    if (!res.ok) throw new Error(`TikTok Shop API ${res.status}: ${await res.text()}`)

    const json = (await res.json()) as TikTokResponse<T>
    if (json.code !== 0) throw new Error(`TikTok Shop error ${json.code}: ${json.message}`)

    return json.data
  }

  async getOrders(dateFrom: Date, dateTo: Date): Promise<TikTokOrder[]> {
    const allOrders: TikTokOrder[] = []
    let pageToken = ''

    while (true) {
      const params: Record<string, string> = {
        create_time_ge: String(Math.floor(dateFrom.getTime() / 1000)),
        create_time_lt: String(Math.floor(dateTo.getTime() / 1000)),
        page_size: '50',
      }
      if (pageToken) params['page_token'] = pageToken

      const data = await this.request<TikTokOrderList>('/order/202309/orders/search', params)

      for (const o of data.orders) {
        allOrders.push({
          id: o.order_id,
          orderNumber: o.order_id,
          status: o.order_status,
          totalAmount: parseFloat(o.payment_info.total_amount),
          buyerName: o.buyer_info.buyer_uid,
          platformFee: 0,
          sellerShippingFee: parseFloat(o.payment_info.shipping_fee ?? '0'),
          createTime: new Date(o.create_time * 1000).toISOString(),
          raw: o,
        })
      }

      if (!data.next_page_token) break
      pageToken = data.next_page_token
    }

    return allOrders
  }
}
