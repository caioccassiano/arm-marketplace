# Arquitetura — ARM Market Placer

## Propósito

Conciliação financeira e análise de resultados entre a plataforma Magazord e os marketplaces Mercado Livre e TikTok Shop. Ferramenta interna para 2-3 usuários.

## Stack

| Camada | Tecnologia | Por quê |
|---|---|---|
| Backend | Fastify 5 + TypeScript | Ultra-rápido, schema-based, excelente DX com tipos. Especificado pelo time. |
| ORM | Drizzle ORM | Zero magic, queries são TypeScript puro, migrations versionadas, leve. |
| Banco | PostgreSQL | Dados financeiros exigem ACID. Suporte nativo a JSONB para guardar raw data. |
| Frontend | React 19 + Vite | SPA servida pelo próprio Fastify em produção — zero infra extra. |
| Data fetching | TanStack Query | Cache, loading states, refetch automático — essencial para polling de status. |
| Gráficos | Recharts | Battle-tested, composable, funciona bem com Tailwind. |
| Validação | Zod | Runtime + TypeScript types em um lugar só. |
| Auth | @fastify/session | Session-based (não JWT) — mais simples para ferramenta interna sem mobile. |
| CSS | Tailwind v3 | Rápido para IU interna, sem overhead de design system. |

## Estrutura de Pastas

```
src/
├── config/env.ts          # Zod schema das envs — falha no boot se inválido
├── db/
│   ├── client.ts          # Conexão postgres.js + drizzle
│   └── schema.ts          # Definição de tabelas + relations
├── modules/               # Clientes HTTP de cada fonte externa
│   ├── magazord/
│   ├── mercado-livre/
│   └── tiktok-shop/
├── plugins/
│   ├── db.ts              # Decora fastify.db
│   └── auth.ts            # Decora fastify.requireAuth
├── reconciliation/
│   └── engine.ts          # Lógica de matching pura (sem efeito colateral)
├── routes/
│   ├── auth.ts            # POST /api/auth/login, logout, GET /api/auth/me
│   ├── sync.ts            # POST /api/sync — importa pedidos de qualquer fonte
│   ├── orders.ts          # GET /api/orders (com filtros)
│   ├── reconciliation.ts  # CRUD de sessões de conciliação
│   └── reports.ts         # GET /api/reports/summary, gmv-daily, divergences
└── seed/index.ts          # Cria usuários iniciais

client/src/
├── lib/
│   ├── api.ts             # fetch wrapper + tipos compartilhados
│   └── utils.ts           # fmt, fmtDate, labels, cores
├── components/
│   ├── Layout.tsx         # Sidebar + navegação
│   └── StatCard.tsx       # Card de métrica
└── pages/
    ├── Login.tsx
    ├── Dashboard.tsx       # GMV, taxas, gráfico diário, últimas conciliações
    ├── Reconciliation.tsx  # Criar conciliação + histórico
    ├── ReconciliationDetail.tsx  # Itens, divergências, resolver
    └── Orders.tsx          # Tabela de pedidos com filtros
```

## Schema do Banco

### `orders` (pedidos unificados)
- Uma única tabela para todas as fontes (`source`: magazord | mercado_livre | tiktok_shop)
- `external_id` + `source` = chave única (upsert seguro)
- `raw_data` JSONB guarda o payload original para auditoria
- `marketplace` = qual marketplace originou (útil nos pedidos Magazord)

### `reconciliation_sessions`
- Representa uma rodada de conciliação para um período + marketplace
- Status: `pending → running → completed | failed`
- Contadores agregados calculados pelo engine

### `reconciliation_items`
- Um item por par (Magazord ↔ Marketplace) ou pedido sem par
- `status`: matched | amount_mismatch | fee_mismatch | magazord_only | marketplace_only
- `resolved_at` / `resolved_by`: controle manual de divergências tratadas

## Fluxo de Conciliação

```
1. Sync   POST /api/sync  →  busca pedidos das APIs externas, faz upsert em orders
2. Create POST /api/reconciliation  →  cria sessão (status=pending), retorna 202
3. Engine runReconciliation()  →  roda async em background
   a. Busca orders{source=magazord, marketplace=X}
   b. Busca orders{source=X}
   c. Matching por número de pedido (primário) ou valor+data (secundário)
   d. Classifica cada par
   e. Insere reconciliation_items
   f. Atualiza sessão com contadores + status=completed
4. Frontend poleia GET /api/reconciliation a cada 5s até status=completed
```

## Algoritmo de Matching

1. **Por número de pedido** — o Magazord armazena o número do marketplace no campo `orderNumber`. Normaliza ambos (só dígitos) e checa substring.
2. **Por valor + data** — se não achou por número: `|valor_mz - valor_mp| ≤ R$0,05` e `|data_mz - data_mp| ≤ 24h`.
3. Sobras de cada lado viram `magazord_only` ou `marketplace_only`.

## Dev Workflow

```bash
# Terminal 1 — backend
pnpm install && cp .env.example .env
# editar .env com DATABASE_URL e SESSION_SECRET
pnpm db:migrate
pnpm db:seed
pnpm dev

# Terminal 2 — frontend
cd client && pnpm install && pnpm dev
```

Acesse http://localhost:5173. O Vite proxeia `/api` para o Fastify na porta 3000.

## Produção

```bash
pnpm client:build   # gera client/dist/
pnpm build          # compila TypeScript para dist/
NODE_ENV=production pnpm start
# Fastify serve client/dist/ como static files na raiz
```

## Decisões Deliberadas

- **Sem JWT** — sessão server-side é mais simples e segura para ferramenta interna sem clientes mobile.
- **Sem ORM lazy-loading** — Drizzle força queries explícitas; sem N+1 acidental.
- **raw_data JSONB** — cada API retorna estruturas diferentes que mudam com o tempo; guardar o payload original preserva a possibilidade de reprocessar.
- **Reconciliação assíncrona** — POST retorna 202 imediatamente, engine roda em background. Sem filas por ora (volume baixo).
- **In-memory session store** — suficiente para 2-3 usuários. Se precisar de persistência entre deploys, substituir por `connect-pg-simple`.
