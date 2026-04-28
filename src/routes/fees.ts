import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { and, desc, eq } from 'drizzle-orm'
import { fees } from '../db/schema.js'

const feeBody = z.object({
  description: z.string().trim().min(1).max(255),
  feeType: z.enum(['FIXED', 'PERCENTUAL']),
  value: z.number().positive(),
  attributionType: z.enum(['PER_ORDER', 'PER_ITEM']),
})

const updateBody = feeBody.partial().extend({
  isActive: z.boolean().optional(),
})

const listQuery = z.object({
  includeInactive: z.enum(['true', 'false']).optional(),
})

const feesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/fees', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = listQuery.safeParse(request.query)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const includeInactive = parsed.data.includeInactive === 'true'

    const rows = await fastify.db
      .select()
      .from(fees)
      .where(includeInactive ? undefined : eq(fees.isActive, true))
      .orderBy(desc(fees.createdAt))

    return reply.send(rows)
  })

  fastify.post('/fees', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = feeBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const [row] = await fastify.db
      .insert(fees)
      .values({
        description: parsed.data.description,
        feeType: parsed.data.feeType,
        value: parsed.data.value.toString(),
        attributionType: parsed.data.attributionType,
      })
      .returning()

    return reply.code(201).send(row)
  })

  fastify.patch('/fees/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const feeId = parseInt(id, 10)
    if (!Number.isFinite(feeId)) return reply.code(400).send({ error: 'ID inválido' })

    const parsed = updateBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const data = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.description !== undefined) updates.description = data.description
    if (data.feeType !== undefined) updates.feeType = data.feeType
    if (data.value !== undefined) updates.value = data.value.toString()
    if (data.attributionType !== undefined) updates.attributionType = data.attributionType
    if (data.isActive !== undefined) updates.isActive = data.isActive

    const [row] = await fastify.db
      .update(fees)
      .set(updates)
      .where(eq(fees.id, feeId))
      .returning()

    if (!row) return reply.code(404).send({ error: 'Taxa não encontrada' })
    return reply.send(row)
  })

  fastify.delete('/fees/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const feeId = parseInt(id, 10)
    if (!Number.isFinite(feeId)) return reply.code(400).send({ error: 'ID inválido' })

    const [row] = await fastify.db
      .update(fees)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(fees.id, feeId), eq(fees.isActive, true)))
      .returning()

    if (!row) return reply.code(404).send({ error: 'Taxa não encontrada' })
    return reply.send({ ok: true })
  })
}

export default feesRoutes
