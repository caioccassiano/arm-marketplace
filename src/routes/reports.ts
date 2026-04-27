import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, eq, gte, lte, sql, sum, count } from 'drizzle-orm'
import { orders, reconciliationSessions, reconciliationItems } from '../db/schema.js'

const periodQuery = z.object({
  dateFrom: z.string().date(),
  dateTo: z.string().date(),
})

const reportsRoutes: FastifyPluginAsync = async (fastify) => {
  // Resumo financeiro geral por período
  fastify.get('/reports/summary', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const q = periodQuery.safeParse(request.query)
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() })

    const from = new Date(`${q.data.dateFrom}T00:00:00Z`)
    const to = new Date(`${q.data.dateTo}T23:59:59Z`)

    const bySource = await fastify.db
      .select({
        source: orders.source,
        marketplace: orders.marketplace,
        totalOrders: count(),
        totalAmount: sum(orders.totalAmount),
        totalFees: sum(orders.marketplaceFee),
        totalShipping: sum(orders.shippingFee),
        totalNet: sum(orders.netAmount),
      })
      .from(orders)
      .where(and(gte(orders.orderedAt, from), lte(orders.orderedAt, to)))
      .groupBy(orders.source, orders.marketplace)

    const recentSessions = await fastify.db
      .select({
        id: reconciliationSessions.id,
        marketplace: reconciliationSessions.marketplace,
        periodStart: reconciliationSessions.periodStart,
        periodEnd: reconciliationSessions.periodEnd,
        status: reconciliationSessions.status,
        matchedCount: reconciliationSessions.matchedCount,
        amountMismatchCount: reconciliationSessions.amountMismatchCount,
        magazordOnlyCount: reconciliationSessions.magazordOnlyCount,
        marketplaceOnlyCount: reconciliationSessions.marketplaceOnlyCount,
        totalAmountDiff: reconciliationSessions.totalAmountDiff,
        createdAt: reconciliationSessions.createdAt,
      })
      .from(reconciliationSessions)
      .where(eq(reconciliationSessions.status, 'completed'))
      .orderBy(sql`${reconciliationSessions.createdAt} DESC`)
      .limit(5)

    return reply.send({ bySource, recentSessions })
  })

  // GMV diário agrupado por marketplace (para o gráfico de linha)
  fastify.get('/reports/gmv-daily', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const q = periodQuery.safeParse(request.query)
    if (!q.success) return reply.code(400).send({ error: q.error.flatten() })

    const from = new Date(`${q.data.dateFrom}T00:00:00Z`)
    const to = new Date(`${q.data.dateTo}T23:59:59Z`)

    const rows = await fastify.db
      .select({
        day: sql<string>`DATE(${orders.orderedAt})`.as('day'),
        source: orders.source,
        marketplace: orders.marketplace,
        totalOrders: count(),
        totalAmount: sum(orders.totalAmount),
      })
      .from(orders)
      .where(and(gte(orders.orderedAt, from), lte(orders.orderedAt, to)))
      .groupBy(sql`DATE(${orders.orderedAt})`, orders.source, orders.marketplace)
      .orderBy(sql`DATE(${orders.orderedAt})`)

    return reply.send(rows)
  })

  // Análise de divergências de uma sessão de conciliação
  fastify.get(
    '/reports/reconciliation/:sessionId/divergences',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string }
      const id = parseInt(sessionId, 10)

      const byStatus = await fastify.db
        .select({
          status: reconciliationItems.status,
          count: count(),
          totalAmountDiff: sum(reconciliationItems.amountDiff),
          totalFeeDiff: sum(reconciliationItems.feeDiff),
        })
        .from(reconciliationItems)
        .where(eq(reconciliationItems.sessionId, id))
        .groupBy(reconciliationItems.status)

      const unresolved = await fastify.db
        .select({
          status: reconciliationItems.status,
          count: count(),
        })
        .from(reconciliationItems)
        .where(
          and(
            eq(reconciliationItems.sessionId, id),
            sql`${reconciliationItems.resolvedAt} IS NULL`,
          ),
        )
        .groupBy(reconciliationItems.status)

      return reply.send({ byStatus, unresolved })
    },
  )
}

export default reportsRoutes
