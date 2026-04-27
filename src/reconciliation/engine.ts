import { eq, and, between, gte, lte } from 'drizzle-orm'
import type { DB } from '../db/client.js'
import {
  orders,
  reconciliationSessions,
  reconciliationItems,
  type Order,
  type NewReconciliationItem,
} from '../db/schema.js'

// Tolerância para considerar valores iguais (centavos)
const AMOUNT_TOLERANCE = 0.05

type ItemStatus =
  | 'matched'
  | 'amount_mismatch'
  | 'fee_mismatch'
  | 'magazord_only'
  | 'marketplace_only'

interface MatchResult {
  status: ItemStatus
  magazordOrder?: Order
  marketplaceOrder?: Order
  amountDiff?: number
  feeDiff?: number
}

function normalizeOrderNumber(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '').toLowerCase()
}

function amountDiff(a: string | null, b: string | null): number {
  return Math.abs(parseFloat(a ?? '0') - parseFloat(b ?? '0'))
}

function matchOrders(
  magazordOrders: Order[],
  marketplaceOrders: Order[],
  marketplace: string,
): MatchResult[] {
  const results: MatchResult[] = []
  const usedMarketplaceIds = new Set<number>()

  for (const mzOrder of magazordOrders) {
    const mzNum = normalizeOrderNumber(mzOrder.orderNumber)
    const mzAmount = parseFloat(mzOrder.totalAmount)

    let best: Order | undefined

    // Estratégia 1: match por número de pedido (o Magazord guarda o número do marketplace)
    if (mzNum) {
      best = marketplaceOrders.find(
        (mp) =>
          !usedMarketplaceIds.has(mp.id) &&
          normalizeOrderNumber(mp.orderNumber).includes(mzNum),
      )
    }

    // Estratégia 2: match por valor + data próxima (±1 dia)
    if (!best) {
      const mzDate = new Date(mzOrder.orderedAt).getTime()
      best = marketplaceOrders.find((mp) => {
        if (usedMarketplaceIds.has(mp.id)) return false
        const mpAmount = parseFloat(mp.totalAmount)
        const mpDate = new Date(mp.orderedAt).getTime()
        const withinAmount = Math.abs(mzAmount - mpAmount) <= AMOUNT_TOLERANCE
        const withinDay = Math.abs(mzDate - mpDate) <= 86_400_000
        return withinAmount && withinDay
      })
    }

    if (best) {
      usedMarketplaceIds.add(best.id)

      const totalDiff = amountDiff(mzOrder.totalAmount, best.totalAmount)
      const fDiff = amountDiff(mzOrder.marketplaceFee, best.marketplaceFee)

      let status: ItemStatus = 'matched'
      if (totalDiff > AMOUNT_TOLERANCE) status = 'amount_mismatch'
      else if (fDiff > AMOUNT_TOLERANCE) status = 'fee_mismatch'

      results.push({
        status,
        magazordOrder: mzOrder,
        marketplaceOrder: best,
        amountDiff: totalDiff,
        feeDiff: fDiff,
      })
    } else {
      results.push({ status: 'magazord_only', magazordOrder: mzOrder })
    }
  }

  // Sobras do marketplace que não foram vinculadas
  for (const mp of marketplaceOrders) {
    if (!usedMarketplaceIds.has(mp.id)) {
      results.push({ status: 'marketplace_only', marketplaceOrder: mp })
    }
  }

  return results
}

export async function runReconciliation(
  db: DB,
  sessionId: number,
  marketplace: string,
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  await db
    .update(reconciliationSessions)
    .set({ status: 'running' })
    .where(eq(reconciliationSessions.id, sessionId))

  try {
    const magazordOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.source, 'magazord'),
          eq(orders.marketplace, marketplace),
          gte(orders.orderedAt, periodStart),
          lte(orders.orderedAt, periodEnd),
        ),
      )

    const marketplaceOrders = await db
      .select()
      .from(orders)
      .where(
        and(
          eq(orders.source, marketplace),
          gte(orders.orderedAt, periodStart),
          lte(orders.orderedAt, periodEnd),
        ),
      )

    const matches = matchOrders(magazordOrders, marketplaceOrders, marketplace)

    const items: NewReconciliationItem[] = matches.map((m) => ({
      sessionId,
      status: m.status,
      magazordOrderId: m.magazordOrder?.id ?? null,
      marketplaceOrderId: m.marketplaceOrder?.id ?? null,
      magazordAmount: m.magazordOrder?.totalAmount ?? null,
      marketplaceAmount: m.marketplaceOrder?.totalAmount ?? null,
      amountDiff: m.amountDiff != null ? String(m.amountDiff.toFixed(2)) : null,
      magazordFee: m.magazordOrder?.marketplaceFee ?? null,
      marketplaceFee: m.marketplaceOrder?.marketplaceFee ?? null,
      feeDiff: m.feeDiff != null ? String(m.feeDiff.toFixed(2)) : null,
    }))

    if (items.length > 0) {
      await db.insert(reconciliationItems).values(items)
    }

    const matched = matches.filter((m) => m.status === 'matched').length
    const amountMismatch = matches.filter((m) => m.status === 'amount_mismatch').length
    const magazordOnly = matches.filter((m) => m.status === 'magazord_only').length
    const marketplaceOnly = matches.filter((m) => m.status === 'marketplace_only').length

    const totalAmountDiff = matches
      .filter((m) => m.amountDiff != null)
      .reduce((sum, m) => sum + (m.amountDiff ?? 0), 0)

    await db
      .update(reconciliationSessions)
      .set({
        status: 'completed',
        totalMagazordOrders: magazordOrders.length,
        totalMarketplaceOrders: marketplaceOrders.length,
        matchedCount: matched,
        amountMismatchCount: amountMismatch,
        magazordOnlyCount: magazordOnly,
        marketplaceOnlyCount: marketplaceOnly,
        totalAmountDiff: totalAmountDiff.toFixed(2),
        completedAt: new Date(),
      })
      .where(eq(reconciliationSessions.id, sessionId))
  } catch (err) {
    await db
      .update(reconciliationSessions)
      .set({ status: 'failed' })
      .where(eq(reconciliationSessions.id, sessionId))
    throw err
  }
}
