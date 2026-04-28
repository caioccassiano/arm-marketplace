import type { FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { desc, eq } from 'drizzle-orm'
import { lucratividade, feitorias, cmvProducts, fees } from '../db/schema.js'
import type { TikTokItem, TikTokReconcileResult, SkuItem } from './upload.js'

interface ResolvedSku extends SkuItem {
  prefix: string
  preco: number | null
}

interface FeeBreakdown {
  description: string
  amount: number
}

interface EnrichedItem extends TikTokItem {
  receitaMagazord: number | null
  receitaTiktok: number | null
  cmvTotal: number | null
  lucro: number | null
  margem: number | null
  missingCmv: boolean
  itemsResolved: ResolvedSku[]
  taxasAplicadas: number
  taxasBreakdown: FeeBreakdown[]
  tarifaTiktokNum: number | null
  comissaoCreatorNum: number | null
}

interface LucratividadeTotals {
  totalReceitaMagazord: number
  totalReceitaLiquida: number
  totalCmv: number
  totalTaxas: number
  taxasBreakdownSummary: FeeBreakdown[]
  investimentoAds: number
  lucroLiquido: number
  pedidosSemCmv: number
  pedidosComCmv: number
  totalTarifaTiktok: number
  totalComissaoCreator: number
}

interface FeeSnapshot {
  id: number
  description: string
  feeType: string
  value: string
  attributionType: string
}

function skuPrefix(sku: string): string {
  const idx = sku.indexOf('-')
  return idx > 0 ? sku.slice(0, idx) : sku
}

function calcTaxasWithBreakdown(
  receitaMagazord: number,
  feeList: FeeSnapshot[],
  totalQty: number,
): { total: number; breakdown: FeeBreakdown[] } {
  let total = 0
  const breakdown: FeeBreakdown[] = []
  for (const f of feeList) {
    const v = parseFloat(f.value)
    let amount: number
    if (f.feeType === 'FIXED') {
      amount = f.attributionType === 'PER_ITEM' ? +(v * totalQty).toFixed(2) : +v.toFixed(2)
    } else {
      amount = +((v / 100) * receitaMagazord).toFixed(2)
    }
    total += amount
    breakdown.push({ description: f.description, amount })
  }
  return { total: +total.toFixed(2), breakdown }
}

function enrichWithCmvAndFees(
  payload: TikTokReconcileResult,
  cmvByCodigo: Map<string, number>,
  feesSnapshot: FeeSnapshot[],
  investimentoAds: number,
): { items: EnrichedItem[]; totals: LucratividadeTotals } {
  const enriched: EnrichedItem[] = []
  let totalReceitaMagazord = 0
  let totalReceitaLiquida = 0
  let totalCmv = 0
  let totalTaxas = 0
  const taxasSummaryMap = new Map<string, number>()
  let pedidosSemCmv = 0
  let pedidosComCmv = 0
  let totalTarifaTiktok = 0
  let totalComissaoCreator = 0

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
    const tarifaTiktokNum = item.tarifaTiktok != null ? parseFloat(item.tarifaTiktok) : null
    const comissaoCreatorNum = item.comissaoCreator != null ? parseFloat(item.comissaoCreator) : null

    const totalQty = item.items.reduce((s, it) => s + it.quantity, 0)
    const { total: taxasAplicadas, breakdown: taxasBreakdown } =
      item.foiTransacionado && receitaMagazord !== null
        ? calcTaxasWithBreakdown(receitaMagazord, feesSnapshot, totalQty)
        : { total: 0, breakdown: [] }

    let lucro: number | null = null
    let margem: number | null = null
    if (receitaLiquida !== null && cmvTotal !== null) {
      lucro = +(receitaLiquida - cmvTotal).toFixed(2)
      margem = receitaLiquida > 0 ? +(lucro / receitaLiquida).toFixed(4) : null
    }

    if (item.foiTransacionado) {
      if (receitaMagazord !== null) totalReceitaMagazord += receitaMagazord
      if (receitaLiquida !== null) totalReceitaLiquida += receitaLiquida
      totalTaxas += taxasAplicadas
      for (const b of taxasBreakdown) {
        taxasSummaryMap.set(b.description, (taxasSummaryMap.get(b.description) ?? 0) + b.amount)
      }
      if (cmvTotal !== null) {
        totalCmv += cmvTotal
        pedidosComCmv++
      } else {
        pedidosSemCmv++
      }
      if (tarifaTiktokNum !== null) totalTarifaTiktok += tarifaTiktokNum
      if (comissaoCreatorNum !== null) totalComissaoCreator += comissaoCreatorNum
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
      taxasAplicadas,
      taxasBreakdown,
      tarifaTiktokNum,
      comissaoCreatorNum,
    })
  }

  const taxasBreakdownSummary = Array.from(taxasSummaryMap.entries()).map(([description, amount]) => ({
    description,
    amount: +amount.toFixed(2),
  }))
  const lucroLiquido = +(totalReceitaLiquida - totalCmv - totalTaxas - investimentoAds).toFixed(2)

  return {
    items: enriched,
    totals: {
      totalReceitaMagazord: +totalReceitaMagazord.toFixed(2),
      totalReceitaLiquida: +totalReceitaLiquida.toFixed(2),
      totalCmv: +totalCmv.toFixed(2),
      totalTaxas: +totalTaxas.toFixed(2),
      taxasBreakdownSummary,
      investimentoAds,
      lucroLiquido,
      pedidosSemCmv,
      pedidosComCmv,
      totalTarifaTiktok: +totalTarifaTiktok.toFixed(2),
      totalComissaoCreator: +totalComissaoCreator.toFixed(2),
    },
  }
}

const createBody = z.object({
  feitoriaId: z.number().int().positive(),
})

const patchBody = z.object({
  investimentoAds: z.number().min(0),
})

const lucratividadeRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/lucratividade', { preHandler: [fastify.requireAuth] }, async (_request, reply) => {
    const rows = await fastify.db
      .select({
        id: lucratividade.id,
        feitoriaId: lucratividade.feitoriaId,
        investimentoAds: lucratividade.investimentoAds,
        createdAt: lucratividade.createdAt,
        feitoriaTitle: feitorias.title,
        feitoriaItemCount: feitorias.itemCount,
        feitoriaCreatedAt: feitorias.createdAt,
        feesSnapshot: lucratividade.feesSnapshot,
      })
      .from(lucratividade)
      .innerJoin(feitorias, eq(lucratividade.feitoriaId, feitorias.id))
      .orderBy(desc(lucratividade.createdAt))

    const result = rows.map((r) => ({
      id: r.id,
      feitoriaId: r.feitoriaId,
      investimentoAds: r.investimentoAds,
      createdAt: r.createdAt,
      feitoriaTitle: r.feitoriaTitle,
      feitoriaItemCount: r.feitoriaItemCount,
      feitoriaCreatedAt: r.feitoriaCreatedAt,
      feesCount: Array.isArray(r.feesSnapshot) ? r.feesSnapshot.length : 0,
    }))

    return reply.send(result)
  })

  fastify.post('/lucratividade', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parsed = createBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const { feitoriaId } = parsed.data

    const [feitoria] = await fastify.db
      .select({ id: feitorias.id })
      .from(feitorias)
      .where(eq(feitorias.id, feitoriaId))
      .limit(1)

    if (!feitoria) return reply.code(404).send({ error: 'Feitoria não encontrada' })

    const existing = await fastify.db
      .select({ id: lucratividade.id })
      .from(lucratividade)
      .where(eq(lucratividade.feitoriaId, feitoriaId))
      .limit(1)

    if (existing.length > 0) return reply.code(409).send({ error: 'Feitoria já adicionada à lucratividade' })

    const activeFees = await fastify.db
      .select()
      .from(fees)
      .where(eq(fees.isActive, true))

    const feesSnapshot = activeFees.map((f) => ({
      id: f.id,
      description: f.description,
      feeType: f.feeType,
      value: f.value,
      attributionType: f.attributionType,
    }))

    const [row] = await fastify.db
      .insert(lucratividade)
      .values({ feitoriaId, feesSnapshot })
      .returning()

    return reply.code(201).send(row)
  })

  fastify.get('/lucratividade/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const entradaId = parseInt(id, 10)
    if (!Number.isFinite(entradaId)) return reply.code(400).send({ error: 'ID inválido' })

    const [entrada] = await fastify.db
      .select()
      .from(lucratividade)
      .where(eq(lucratividade.id, entradaId))
      .limit(1)

    if (!entrada) return reply.code(404).send({ error: 'Entrada não encontrada' })

    const [feitoria] = await fastify.db
      .select()
      .from(feitorias)
      .where(eq(feitorias.id, entrada.feitoriaId))
      .limit(1)

    if (!feitoria) return reply.code(404).send({ error: 'Feitoria associada não encontrada' })

    const cmvRows = await fastify.db
      .select({ codigo: cmvProducts.codigo, preco: cmvProducts.preco })
      .from(cmvProducts)

    const cmvMap = new Map<string, number>()
    for (const c of cmvRows) cmvMap.set(c.codigo, parseFloat(c.preco))

    const feesSnapshot = (entrada.feesSnapshot as FeeSnapshot[]) ?? []
    const payload = feitoria.payload as TikTokReconcileResult
    const ignoradosCount = payload.items.filter((i) => i.statusFinanceiro === 'IGNORAR').length
    const filteredPayload = {
      ...payload,
      items: payload.items.filter((i) => i.statusFinanceiro !== 'IGNORAR'),
    }

    const investimentoAds = parseFloat(entrada.investimentoAds)
    const { items, totals } = enrichWithCmvAndFees(filteredPayload, cmvMap, feesSnapshot, investimentoAds)

    return reply.send({
      entrada: {
        id: entrada.id,
        feitoriaId: entrada.feitoriaId,
        investimentoAds: entrada.investimentoAds,
        createdAt: entrada.createdAt,
      },
      feitoria: {
        id: feitoria.id,
        title: feitoria.title,
        itemCount: feitoria.itemCount,
        activeItemCount: filteredPayload.items.length,
        ignoradosCount,
        totalDiff: feitoria.totalDiff,
        createdAt: feitoria.createdAt,
      },
      totals,
      items,
      cmvSize: cmvMap.size,
      feesCount: feesSnapshot.length,
      feesSnapshot,
    })
  })

  fastify.patch('/lucratividade/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const entradaId = parseInt(id, 10)
    if (!Number.isFinite(entradaId)) return reply.code(400).send({ error: 'ID inválido' })

    const parsed = patchBody.safeParse(request.body)
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() })

    const [row] = await fastify.db
      .update(lucratividade)
      .set({ investimentoAds: parsed.data.investimentoAds.toString() })
      .where(eq(lucratividade.id, entradaId))
      .returning()

    if (!row) return reply.code(404).send({ error: 'Entrada não encontrada' })
    return reply.send(row)
  })

  fastify.delete('/lucratividade/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const entradaId = parseInt(id, 10)
    if (!Number.isFinite(entradaId)) return reply.code(400).send({ error: 'ID inválido' })

    await fastify.db.delete(lucratividade).where(eq(lucratividade.id, entradaId))
    return reply.send({ ok: true })
  })
}

export default lucratividadeRoutes
