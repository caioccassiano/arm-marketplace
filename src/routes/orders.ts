import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import { orders } from '../db/schema.js'

const listQuery = z.object({
  source: z.enum(['magazord', 'mercado_livre', 'tiktok_shop']).optional(),
  marketplace: z.string().optional(),
  dateFrom: z.string().date().optional(),
  dateTo: z.string().date().optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(50),
})

const ordersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/orders', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const query = listQuery.safeParse(request.query)
    if (!query.success) return reply.code(400).send({ error: query.error.flatten() })

    const { source, marketplace, dateFrom, dateTo, page, limit } = query.data
    const offset = (page - 1) * limit

    const conditions = []
    if (source) conditions.push(eq(orders.source, source))
    if (marketplace) conditions.push(eq(orders.marketplace, marketplace))
    if (dateFrom) conditions.push(gte(orders.orderedAt, new Date(`${dateFrom}T00:00:00Z`)))
    if (dateTo) conditions.push(lte(orders.orderedAt, new Date(`${dateTo}T23:59:59Z`)))

    const rows = await fastify.db
      .select({
        id: orders.id,
        source: orders.source,
        externalId: orders.externalId,
        orderNumber: orders.orderNumber,
        status: orders.status,
        marketplace: orders.marketplace,
        customerName: orders.customerName,
        totalAmount: orders.totalAmount,
        marketplaceFee: orders.marketplaceFee,
        shippingFee: orders.shippingFee,
        netAmount: orders.netAmount,
        orderedAt: orders.orderedAt,
        syncedAt: orders.syncedAt,
      })
      .from(orders)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(orders.orderedAt))
      .limit(limit)
      .offset(offset)

    return reply.send({ data: rows, page, limit })
  })

  fastify.get(
    '/orders/:id',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const [order] = await fastify.db
        .select()
        .from(orders)
        .where(eq(orders.id, parseInt(id, 10)))
        .limit(1)

      if (!order) return reply.code(404).send({ error: 'Pedido não encontrado' })
      return reply.send(order)
    },
  )
}

export default ordersRoutes
