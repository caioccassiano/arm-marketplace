import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, count, desc, eq, isNull, ne, sum } from 'drizzle-orm'
import { reconciliationSessions, reconciliationItems, orders } from '../db/schema.js'
import { runReconciliation } from '../reconciliation/engine.js'

const createBody = z.object({
  marketplace: z.enum(['mercado_livre', 'tiktok_shop']),
  periodStart: z.string().date(),
  periodEnd: z.string().date(),
})

const reconciliationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/reconciliation',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const body = createBody.safeParse(request.body)
      if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

      const [session] = await fastify.db
        .insert(reconciliationSessions)
        .values({
          marketplace: body.data.marketplace,
          periodStart: body.data.periodStart,
          periodEnd: body.data.periodEnd,
          createdBy: request.session.userId,
          status: 'pending',
        })
        .returning()

      if (!session) return reply.code(500).send({ error: 'Falha ao criar sessão' })

      // Roda assíncrono para não bloquear a resposta
      const periodStart = new Date(`${body.data.periodStart}T00:00:00Z`)
      const periodEnd = new Date(`${body.data.periodEnd}T23:59:59Z`)

      runReconciliation(fastify.db, session.id, body.data.marketplace, periodStart, periodEnd).catch(
        (err) => fastify.log.error({ err, sessionId: session.id }, 'Erro na conciliação'),
      )

      return reply.code(202).send(session)
    },
  )

  fastify.get(
    '/reconciliation',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const sessions = await fastify.db
        .select()
        .from(reconciliationSessions)
        .orderBy(desc(reconciliationSessions.createdAt))
        .limit(20)

      return reply.send(sessions)
    },
  )

  fastify.get(
    '/reconciliation/:id',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const sessionId = parseInt(id, 10)

      const [session] = await fastify.db
        .select()
        .from(reconciliationSessions)
        .where(eq(reconciliationSessions.id, sessionId))
        .limit(1)

      if (!session) return reply.code(404).send({ error: 'Sessão não encontrada' })

      const [summary, [{ unresolvedCount }]] = await Promise.all([
        fastify.db
          .select({
            status: reconciliationItems.status,
            count: count(),
            totalDiff: sum(reconciliationItems.amountDiff),
          })
          .from(reconciliationItems)
          .where(eq(reconciliationItems.sessionId, sessionId))
          .groupBy(reconciliationItems.status),
        fastify.db
          .select({ unresolvedCount: count() })
          .from(reconciliationItems)
          .where(
            and(
              eq(reconciliationItems.sessionId, sessionId),
              isNull(reconciliationItems.resolvedAt),
              ne(reconciliationItems.status, 'matched'),
            ),
          ),
      ])

      return reply.send({ session, summary, unresolvedCount })
    },
  )

  fastify.get(
    '/reconciliation/:id/items',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const sessionId = parseInt(id, 10)
      const query = request.query as Record<string, string>
      const pageNum = Math.max(1, parseInt(query.page ?? '1', 10))
      const limitNum = Math.min(100, Math.max(1, parseInt(query.limit ?? '20', 10)))
      const statusFilter = query.status && query.status !== 'all' ? query.status : null

      const where = statusFilter
        ? and(eq(reconciliationItems.sessionId, sessionId), eq(reconciliationItems.status, statusFilter))
        : eq(reconciliationItems.sessionId, sessionId)

      const [items, [{ total }]] = await Promise.all([
        fastify.db
          .select({
            id: reconciliationItems.id,
            status: reconciliationItems.status,
            magazordAmount: reconciliationItems.magazordAmount,
            marketplaceAmount: reconciliationItems.marketplaceAmount,
            amountDiff: reconciliationItems.amountDiff,
            magazordFee: reconciliationItems.magazordFee,
            marketplaceFee: reconciliationItems.marketplaceFee,
            feeDiff: reconciliationItems.feeDiff,
            notes: reconciliationItems.notes,
            resolvedAt: reconciliationItems.resolvedAt,
            magazordOrderId: reconciliationItems.magazordOrderId,
            marketplaceOrderId: reconciliationItems.marketplaceOrderId,
          })
          .from(reconciliationItems)
          .where(where)
          .orderBy(reconciliationItems.status)
          .limit(limitNum)
          .offset((pageNum - 1) * limitNum),
        fastify.db
          .select({ total: count() })
          .from(reconciliationItems)
          .where(where),
      ])

      return reply.send({ items, total, page: pageNum, limit: limitNum })
    },
  )

  fastify.patch(
    '/reconciliation/items/:id/resolve',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const { notes } = request.body as { notes?: string }

      await fastify.db
        .update(reconciliationItems)
        .set({
          resolvedAt: new Date(),
          resolvedBy: request.session.userId,
          notes: notes ?? null,
        })
        .where(eq(reconciliationItems.id, parseInt(id, 10)))

      return reply.send({ ok: true })
    },
  )
}

export default reconciliationRoutes
