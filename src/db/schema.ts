import {
  pgTable,
  serial,
  varchar,
  text,
  integer,
  numeric,
  timestamp,
  date,
  jsonb,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert

// ── Pedidos unificados ────────────────────────────────────────────────────────
// source: 'magazord' | 'mercado_livre' | 'tiktok_shop'
// marketplace: qual marketplace dentro da fonte (para Magazord, qual plataforma originou o pedido)
export const orders = pgTable(
  'orders',
  {
    id: serial('id').primaryKey(),
    source: varchar('source', { length: 50 }).notNull(),
    externalId: varchar('external_id', { length: 255 }).notNull(),
    orderNumber: varchar('order_number', { length: 100 }),
    status: varchar('status', { length: 50 }).notNull(),
    marketplace: varchar('marketplace', { length: 50 }),
    customerName: varchar('customer_name', { length: 255 }),
    totalAmount: numeric('total_amount', { precision: 12, scale: 2 }).notNull(),
    marketplaceFee: numeric('marketplace_fee', { precision: 12, scale: 2 }).default('0'),
    shippingFee: numeric('shipping_fee', { precision: 12, scale: 2 }).default('0'),
    netAmount: numeric('net_amount', { precision: 12, scale: 2 }),
    orderedAt: timestamp('ordered_at').notNull(),
    rawData: jsonb('raw_data'),
    syncedAt: timestamp('synced_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [uniqueIndex('orders_source_external_id_idx').on(t.source, t.externalId)],
)

export type Order = typeof orders.$inferSelect
export type NewOrder = typeof orders.$inferInsert

// ── Sessões de conciliação ────────────────────────────────────────────────────
export const reconciliationSessions = pgTable('reconciliation_sessions', {
  id: serial('id').primaryKey(),
  periodStart: date('period_start').notNull(),
  periodEnd: date('period_end').notNull(),
  marketplace: varchar('marketplace', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  createdBy: integer('created_by').references(() => users.id),

  totalMagazordOrders: integer('total_magazord_orders').default(0),
  totalMarketplaceOrders: integer('total_marketplace_orders').default(0),
  matchedCount: integer('matched_count').default(0),
  amountMismatchCount: integer('amount_mismatch_count').default(0),
  magazordOnlyCount: integer('magazord_only_count').default(0),
  marketplaceOnlyCount: integer('marketplace_only_count').default(0),
  totalAmountDiff: numeric('total_amount_diff', { precision: 12, scale: 2 }).default('0'),

  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type ReconciliationSession = typeof reconciliationSessions.$inferSelect
export type NewReconciliationSession = typeof reconciliationSessions.$inferInsert

// ── Itens de conciliação ──────────────────────────────────────────────────────
// status:
//   matched          → pedido encontrado nos dois lados, valores OK
//   amount_mismatch  → encontrado nos dois lados, mas valor total difere
//   fee_mismatch     → valores ok, mas taxa do marketplace difere
//   magazord_only    → está no Magazord, não encontrado no marketplace
//   marketplace_only → está no marketplace, não encontrado no Magazord
export const reconciliationItems = pgTable('reconciliation_items', {
  id: serial('id').primaryKey(),
  sessionId: integer('session_id')
    .references(() => reconciliationSessions.id)
    .notNull(),
  status: varchar('status', { length: 50 }).notNull(),

  magazordOrderId: integer('magazord_order_id').references(() => orders.id),
  marketplaceOrderId: integer('marketplace_order_id').references(() => orders.id),

  magazordAmount: numeric('magazord_amount', { precision: 12, scale: 2 }),
  marketplaceAmount: numeric('marketplace_amount', { precision: 12, scale: 2 }),
  amountDiff: numeric('amount_diff', { precision: 12, scale: 2 }),

  magazordFee: numeric('magazord_fee', { precision: 12, scale: 2 }),
  marketplaceFee: numeric('marketplace_fee', { precision: 12, scale: 2 }),
  feeDiff: numeric('fee_diff', { precision: 12, scale: 2 }),

  notes: text('notes'),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: integer('resolved_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export type ReconciliationItem = typeof reconciliationItems.$inferSelect
export type NewReconciliationItem = typeof reconciliationItems.$inferInsert

// ── Relations ─────────────────────────────────────────────────────────────────
export const reconciliationSessionsRelations = relations(reconciliationSessions, ({ one, many }) => ({
  creator: one(users, { fields: [reconciliationSessions.createdBy], references: [users.id] }),
  items: many(reconciliationItems),
}))

export const reconciliationItemsRelations = relations(reconciliationItems, ({ one }) => ({
  session: one(reconciliationSessions, {
    fields: [reconciliationItems.sessionId],
    references: [reconciliationSessions.id],
  }),
  magazordOrder: one(orders, {
    fields: [reconciliationItems.magazordOrderId],
    references: [orders.id],
    relationName: 'magazordOrder',
  }),
  marketplaceOrder: one(orders, {
    fields: [reconciliationItems.marketplaceOrderId],
    references: [orders.id],
    relationName: 'marketplaceOrder',
  }),
  resolver: one(users, {
    fields: [reconciliationItems.resolvedBy],
    references: [users.id],
  }),
}))
