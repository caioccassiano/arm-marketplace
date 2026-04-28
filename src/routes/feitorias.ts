import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { feitorias, cmvProducts } from '../db/schema.js'
import type { TikTokItem, TikTokReconcileResult, SkuItem } from './upload.js'

const skuItemSchema = z.object({
  sku: z.string(),
  quantity: z.number().int().min(1),
})

const tiktokItemSchema = z.object({
  statusMatch: z.enum(['MATCH_OK', 'MATCH_COM_DIVERGENCIA', 'SOMENTE_TIKTOK', 'SOMENTE_ERP']),
  statusFinanceiro: z.enum(['OK', 'DIVERGENTE', 'A_RECEBER', 'IGNORAR']),
  motivoDivergencia: z.string().nullable(),
  foiTransacionado: z.boolean(),
  pago: z.boolean(),
  emEspera: z.boolean(),
  tiktokOrderId: z.string().nullable(),
  tiktokStatus: z.string().nullable(),
  tiktokAmount: z.string().nullable(),
  magazordCodSec: z.string().nullable(),
  magazordSituacao: z.string().nullable(),
  magazordAmount: z.string().nullable(),
  diferencaValor: z.string().nullable(),
  receitaLiquida: z.string().nullable().default(null),
  tarifaTiktok: z.string().nullable().default(null),
  comissaoCreator: z.string().nullable().default(null),
  items: z.array(skuItemSchema).default([]),
})

const payloadSchema = z.object({
  summary: z.object({
    tiktokTotal: z.number(),
    magazordTotal: z.number(),
    matchOk: z.number(),
    matchDivergente: z.number(),
    somenteTiktok: z.number(),
    somenteErp: z.number(),
    totalDiff: z.string(),
    liquidadosPagos: z.number(),
    emEsperaTotal: z.number(),
    receitaLiquidaTotal: z.string().default('0.00'),
    totalTarifaTiktok: z.number().default(0),
    totalComissaoCreator: z.number().default(0),
  }),
  items: z.array(tiktokItemSchema),
})

const createBody = z.object({
  title: z.string().max(200).optional(),
  payload: payloadSchema,
})

function defaultTitle(): string {
  // Brasília: UTC-3 (sem DST desde 2019)
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000)
  const dd = String(now.getUTCDate()).padStart(2, '0')
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0')
  const yyyy = now.getUTCFullYear()
  const hh = String(now.getUTCHours()).padStart(2, '0')
  const mi = String(now.getUTCMinutes()).padStart(2, '0')
  return `Feitoria ${dd}/${mm}/${yyyy} ${hh}:${mi}`
}

function skuPrefix(sku: string): string {
  const idx = sku.indexOf('-')
  return idx > 0 ? sku.slice(0, idx) : sku
}

interface EnrichedItem extends TikTokItem {
  receitaMagazord: number | null
  receitaTiktok: number | null
  cmvTotal: number | null
  lucro: number | null
  margem: number | null
  missingCmv: boolean
  itemsResolved: Array<SkuItem & { prefix: string; preco: number | null }>
}

interface FeitoriaTotals {
  totalReceitaMagazord: number
  totalReceitaTiktok: number
  totalReceitaLiquida: number
  totalCmv: number
  lucro: number
  margem: number | null
  pedidosSemCmv: number
  pedidosComCmv: number
  pedidosSemLiquida: number
}

function enrichWithCmv(
  payload: TikTokReconcileResult,
  cmvByCodigo: Map<string, number>,
): { items: EnrichedItem[]; totals: FeitoriaTotals } {
  const enriched: EnrichedItem[] = []
  let totalReceitaMagazord = 0
  let totalReceitaTiktok = 0
  let totalReceitaLiquida = 0
  let totalCmv = 0
  let pedidosSemCmv = 0
  let pedidosComCmv = 0
  let pedidosSemLiquida = 0

  for (const item of payload.items) {
    const itemsResolved = item.items.map((it) => {
      const prefix = skuPrefix(it.sku)
      const preco = cmvByCodigo.get(prefix) ?? null
      return { ...it, prefix, preco }
    })

    let cmvTotal: number | null = null
    let missingCmv = false
    if (itemsResolved.length === 0) {
      missingCmv = true
    } else {
      let sum = 0
      for (const it of itemsResolved) {
        if (it.preco === null) {
          missingCmv = true
          break
        }
        sum += it.preco * it.quantity
      }
      if (!missingCmv) cmvTotal = +sum.toFixed(2)
    }

    const receitaMagazord = item.magazordAmount !== null ? parseFloat(item.magazordAmount) : null
    const receitaTiktok = item.tiktokAmount !== null ? parseFloat(item.tiktokAmount) : null
    const receitaLiquida = item.receitaLiquida !== null ? parseFloat(item.receitaLiquida) : null

    let lucro: number | null = null
    let margem: number | null = null
    if (receitaLiquida !== null && cmvTotal !== null) {
      lucro = +(receitaLiquida - cmvTotal).toFixed(2)
      margem = receitaLiquida > 0 ? +(lucro / receitaLiquida).toFixed(4) : null
    }

    // Apenas pedidos transacionados entram nos totais
    if (item.foiTransacionado) {
      if (receitaMagazord !== null) totalReceitaMagazord += receitaMagazord
      if (receitaTiktok !== null) totalReceitaTiktok += receitaTiktok
      if (receitaLiquida !== null) totalReceitaLiquida += receitaLiquida
      else pedidosSemLiquida++

      if (cmvTotal !== null) {
        totalCmv += cmvTotal
        pedidosComCmv++
      } else {
        pedidosSemCmv++
      }
    }

    enriched.push({
      ...item,
      receitaMagazord,
      receitaTiktok,
      cmvTotal,
      lucro,
      margem,
      missingCmv,
      itemsResolved,
    })
  }

  const lucro = +(totalReceitaLiquida - totalCmv).toFixed(2)
  const margem = totalReceitaLiquida > 0 ? +(lucro / totalReceitaLiquida).toFixed(4) : null

  return {
    items: enriched,
    totals: {
      totalReceitaMagazord: +totalReceitaMagazord.toFixed(2),
      totalReceitaTiktok: +totalReceitaTiktok.toFixed(2),
      totalReceitaLiquida: +totalReceitaLiquida.toFixed(2),
      totalCmv: +totalCmv.toFixed(2),
      lucro,
      margem,
      pedidosSemCmv,
      pedidosComCmv,
      pedidosSemLiquida,
    },
  }
}

const feitoriasRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/feitorias', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const title = parsed.data.title?.trim() || defaultTitle()
    const payload = parsed.data.payload

    const [row] = await fastify.db
      .insert(feitorias)
      .values({
        title,
        createdBy: request.session.userId ?? null,
        payload,
        itemCount: payload.items.length,
        totalDiff: payload.summary.totalDiff,
      })
      .returning()

    return reply.code(201).send(row)
  })

  fastify.get('/feitorias', { preHandler: [fastify.requireAuth] }, async (_request, reply) => {
    const rows = await fastify.db
      .select({
        id: feitorias.id,
        title: feitorias.title,
        itemCount: feitorias.itemCount,
        totalDiff: feitorias.totalDiff,
        createdAt: feitorias.createdAt,
      })
      .from(feitorias)
      .orderBy(desc(feitorias.createdAt))
      .limit(100)

    return reply.send(rows)
  })

  fastify.get('/feitorias/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const feitoriaId = parseInt(id, 10)
    if (!Number.isFinite(feitoriaId)) return reply.code(400).send({ error: 'ID inválido' })

    const [row] = await fastify.db
      .select()
      .from(feitorias)
      .where(eq(feitorias.id, feitoriaId))
      .limit(1)

    if (!row) return reply.code(404).send({ error: 'Feitoria não encontrada' })

    const cmvRows = await fastify.db
      .select({ codigo: cmvProducts.codigo, preco: cmvProducts.preco })
      .from(cmvProducts)

    const cmvMap = new Map<string, number>()
    for (const c of cmvRows) cmvMap.set(c.codigo, parseFloat(c.preco))

    const payload = row.payload as TikTokReconcileResult
    const ignoradosCount = payload.items.filter((i) => i.statusFinanceiro === 'IGNORAR').length
    const filteredPayload = {
      ...payload,
      items: payload.items.filter((i) => i.statusFinanceiro !== 'IGNORAR'),
    }
    const { items, totals } = enrichWithCmv(filteredPayload, cmvMap)

    return reply.send({
      feitoria: {
        id: row.id,
        title: row.title,
        itemCount: row.itemCount,
        activeItemCount: filteredPayload.items.length,
        ignoradosCount,
        totalDiff: row.totalDiff,
        createdAt: row.createdAt,
      },
      summary: payload.summary,
      totals,
      items,
      cmvSize: cmvMap.size,
    })
  })

  fastify.patch('/feitorias/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const feitoriaId = parseInt(id, 10)
    if (!Number.isFinite(feitoriaId)) return reply.code(400).send({ error: 'ID inválido' })

    const body = z.object({ title: z.string().min(1).max(200) }).safeParse(request.body)
    if (!body.success) return reply.code(400).send({ error: body.error.flatten() })

    const [row] = await fastify.db
      .update(feitorias)
      .set({ title: body.data.title.trim() })
      .where(eq(feitorias.id, feitoriaId))
      .returning({ id: feitorias.id, title: feitorias.title })

    if (!row) return reply.code(404).send({ error: 'Feitoria não encontrada' })
    return reply.send(row)
  })

  fastify.delete('/feitorias/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const feitoriaId = parseInt(id, 10)
    if (!Number.isFinite(feitoriaId)) return reply.code(400).send({ error: 'ID inválido' })

    await fastify.db.delete(feitorias).where(eq(feitorias.id, feitoriaId))
    return reply.send({ ok: true })
  })
}

export default feitoriasRoutes
