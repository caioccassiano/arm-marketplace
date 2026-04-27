import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { sql } from 'drizzle-orm'
import { orders } from '../db/schema.js'
import { MagazordClient } from '../modules/magazord/client.js'
import { MercadoLivreClient } from '../modules/mercado-livre/client.js'
import { TikTokShopClient } from '../modules/tiktok-shop/client.js'

const syncBody = z.object({
  source: z.enum(['magazord', 'mercado_livre', 'tiktok_shop', 'all']),
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
})

const syncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/sync',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const body = syncBody.safeParse(request.body)
      if (!body.success) {
        return reply.code(400).send({ error: body.error.flatten() })
      }

      const dateFrom = new Date(`${body.data.dateFrom}T00:00:00.000Z`)
      const dateTo = new Date(`${body.data.dateTo}T23:59:59.999Z`)
      const { source } = body.data

      const results: Record<string, number> = {}

      if (source === 'magazord' || source === 'all') {
        const client = new MagazordClient()
        const mzOrders = await client.getOrders(dateFrom, dateTo)

        for (const o of mzOrders) {
          await fastify.db
            .insert(orders)
            .values({
              source: 'magazord',
              externalId: o.id,
              orderNumber: o.numero,
              status: o.status,
              marketplace: o.marketplace,
              customerName: o.nomeCliente,
              totalAmount: String(o.valorTotal),
              marketplaceFee: String(o.comissaoMarketplace),
              shippingFee: String(o.valorFrete),
              netAmount: String(o.valorTotal - o.comissaoMarketplace - o.valorFrete),
              orderedAt: new Date(o.dataPedido),
              rawData: o.raw,
            })
            .onConflictDoUpdate({
              target: [orders.source, orders.externalId],
              set: {
                status: sql`excluded.status`,
                totalAmount: sql`excluded.total_amount`,
                marketplaceFee: sql`excluded.marketplace_fee`,
                shippingFee: sql`excluded.shipping_fee`,
                netAmount: sql`excluded.net_amount`,
                rawData: sql`excluded.raw_data`,
                syncedAt: new Date(),
              },
            })
        }
        results['magazord'] = mzOrders.length
      }

      if (source === 'mercado_livre' || source === 'all') {
        const client = new MercadoLivreClient()
        const mlOrders = await client.getOrders(dateFrom, dateTo)

        for (const o of mlOrders) {
          await fastify.db
            .insert(orders)
            .values({
              source: 'mercado_livre',
              externalId: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              marketplace: 'mercado_livre',
              customerName: o.buyerName,
              totalAmount: String(o.totalAmount),
              marketplaceFee: String(o.marketplaceFee),
              shippingFee: String(o.shippingCost),
              netAmount: String(o.totalAmount - o.marketplaceFee - o.shippingCost),
              orderedAt: new Date(o.dateCreated),
              rawData: o.raw,
            })
            .onConflictDoUpdate({
              target: [orders.source, orders.externalId],
              set: {
                status: sql`excluded.status`,
                totalAmount: sql`excluded.total_amount`,
                syncedAt: new Date(),
              },
            })
        }
        results['mercado_livre'] = mlOrders.length
      }

      if (source === 'tiktok_shop' || source === 'all') {
        const client = new TikTokShopClient()
        const tkOrders = await client.getOrders(dateFrom, dateTo)

        for (const o of tkOrders) {
          await fastify.db
            .insert(orders)
            .values({
              source: 'tiktok_shop',
              externalId: o.id,
              orderNumber: o.orderNumber,
              status: o.status,
              marketplace: 'tiktok_shop',
              customerName: o.buyerName,
              totalAmount: String(o.totalAmount),
              marketplaceFee: String(o.platformFee),
              shippingFee: String(o.sellerShippingFee),
              netAmount: String(o.totalAmount - o.platformFee - o.sellerShippingFee),
              orderedAt: new Date(o.createTime),
              rawData: o.raw,
            })
            .onConflictDoUpdate({
              target: [orders.source, orders.externalId],
              set: {
                status: sql`excluded.status`,
                totalAmount: sql`excluded.total_amount`,
                syncedAt: new Date(),
              },
            })
        }
        results['tiktok_shop'] = tkOrders.length
      }

      return reply.send({ synced: results })
    },
  )
}

export default syncRoutes
