import type { FastifyPluginAsync } from 'fastify'
import { sql, desc, asc, ilike, or, count, eq } from 'drizzle-orm'
import { cmvProducts } from '../db/schema.js'
import * as XLSX from 'xlsx'

interface ParsedCmvRow {
  codigo: string
  produtoId: string | null
  descricao: string | null
  preco: string
}

function isXlsxBuffer(buf: Buffer): boolean {
  return buf[0] === 0x50 && buf[1] === 0x4b
}

function parsePrecoBR(raw: string): string | null {
  // Aceita "R$ 30,00", "30,00", "30.00", "R$ 1.234,56"
  const cleaned = raw
    .replace(/^R\$\s*/i, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n.toFixed(2)
}

function parseCmvFile(buf: Buffer): ParsedCmvRow[] {
  let lines: string[][]

  if (isXlsxBuffer(buf)) {
    const wb = XLSX.read(buf, { type: 'buffer' })
    const ws = wb.Sheets[wb.SheetNames[0] ?? '']
    if (!ws) return []
    lines = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as string[][]
  } else {
    // Magazord exporta em ISO-8859-1 (latin1) com `;`
    const text = buf.toString('latin1')
    const rawLines = text.trim().split(/\r?\n/).filter(Boolean)
    lines = rawLines.map((l) => l.split(';').map((c) => c.trim().replace(/^"|"$/g, '')))
  }

  if (lines.length === 0) return []

  // Header esperado: Código;Id Produto;Produto - Derivação; preço
  // Detecta pelo primeiro header que contenha "código" ou "codigo" (case-insensitive, sem acento)
  const norm = (s: string): string =>
    s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

  const header = (lines[0] ?? []).map((c) => norm(String(c ?? '')))
  const findIdx = (candidates: string[]): number =>
    header.findIndex((h) => candidates.some((c) => h === c || h.includes(c)))

  const codigoIdx = findIdx(['codigo'])
  const produtoIdIdx = findIdx(['id produto', 'idproduto'])
  const descricaoIdx = findIdx(['produto - derivacao', 'derivacao', 'nome'])
  const precoIdx = findIdx(['preco', 'price', 'valor'])

  const colCodigo = codigoIdx >= 0 ? codigoIdx : 0
  const colProdutoId = produtoIdIdx >= 0 ? produtoIdIdx : 1
  const colDescricao = descricaoIdx >= 0 ? descricaoIdx : 2
  const colPreco = precoIdx >= 0 ? precoIdx : 3

  const out: ParsedCmvRow[] = []
  const seen = new Set<string>()
  for (const cols of lines.slice(1)) {
    const codigo = String(cols[colCodigo] ?? '').trim()
    if (!codigo || seen.has(codigo)) continue

    const precoStr = String(cols[colPreco] ?? '').trim()
    const preco = parsePrecoBR(precoStr)
    if (preco === null) continue

    seen.add(codigo)
    out.push({
      codigo,
      produtoId: String(cols[colProdutoId] ?? '').trim() || null,
      descricao: String(cols[colDescricao] ?? '').trim() || null,
      preco,
    })
  }
  return out
}

const cmvRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/cmv/upload', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const parts = request.parts()
    let fileBuf: Buffer | null = null

    for await (const part of parts) {
      if (part.type === 'file' && (part.fieldname === 'file' || part.fieldname === 'cmv')) {
        fileBuf = await part.toBuffer()
      }
    }

    if (!fileBuf) return reply.code(400).send({ error: 'Envie o arquivo CMV' })

    const rows = parseCmvFile(fileBuf)
    if (rows.length === 0) {
      return reply.code(400).send({ error: 'Nenhuma linha válida encontrada no arquivo' })
    }

    // Upsert em lote único — evita N queries sequenciais
    const CHUNK = 500
    for (let i = 0; i < rows.length; i += CHUNK) {
      await fastify.db
        .insert(cmvProducts)
        .values(
          rows.slice(i, i + CHUNK).map((r) => ({
            codigo: r.codigo,
            produtoId: r.produtoId,
            descricao: r.descricao,
            preco: r.preco,
          })),
        )
        .onConflictDoUpdate({
          target: cmvProducts.codigo,
          set: {
            produtoId: sql`excluded.produto_id`,
            descricao: sql`excluded.descricao`,
            preco: sql`excluded.preco`,
            updatedAt: sql`now()`,
          },
        })
    }

    const totalRow = await fastify.db.select({ value: count() }).from(cmvProducts)
    const total = totalRow[0]?.value ?? 0

    return reply.send({ ok: true, upserted: rows.length, total })
  })

  fastify.get('/cmv', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const query = request.query as { q?: string; limit?: string }
    const limit = query.limit ? Math.min(parseInt(query.limit, 10) || 50, 10000) : 10000
    const search = query.q?.trim()

    const where = search
      ? or(ilike(cmvProducts.codigo, `%${search}%`), ilike(cmvProducts.descricao, `%${search}%`))
      : undefined

    const rows = await fastify.db
      .select()
      .from(cmvProducts)
      .where(where)
      .orderBy(asc(cmvProducts.codigo))
      .limit(limit)

    const totalRow = await fastify.db.select({ value: count() }).from(cmvProducts)
    const total = totalRow[0]?.value ?? 0

    return reply.send({ items: rows, total })
  })

  fastify.post('/cmv', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const body = request.body as { codigo?: string; produtoId?: string | null; descricao?: string | null; preco?: string }

    if (!body.codigo?.trim()) return reply.code(400).send({ error: 'Código obrigatório' })
    const preco = parsePrecoBR(String(body.preco ?? ''))
    if (!preco) return reply.code(400).send({ error: 'Preço inválido' })

    try {
      const [created] = await fastify.db
        .insert(cmvProducts)
        .values({
          codigo: body.codigo.trim(),
          produtoId: body.produtoId?.trim() || null,
          descricao: body.descricao?.trim() || null,
          preco,
        })
        .returning()
      return reply.code(201).send(created)
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: `Código "${body.codigo}" já cadastrado` })
      }
      throw err
    }
  })

  fastify.patch('/cmv/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const body = request.body as { codigo?: string; produtoId?: string | null; descricao?: string | null; preco?: string }

    const patch: Partial<{ codigo: string; produtoId: string | null; descricao: string | null; preco: string; updatedAt: Date }> = {
      updatedAt: new Date(),
    }
    if (body.codigo !== undefined) patch.codigo = body.codigo.trim()
    if ('produtoId' in body) patch.produtoId = body.produtoId?.trim() || null
    if ('descricao' in body) patch.descricao = body.descricao?.trim() || null
    if (body.preco !== undefined) {
      const preco = parsePrecoBR(String(body.preco))
      if (!preco) return reply.code(400).send({ error: 'Preço inválido' })
      patch.preco = preco
    }

    try {
      const [updated] = await fastify.db
        .update(cmvProducts)
        .set(patch)
        .where(eq(cmvProducts.id, parseInt(id, 10)))
        .returning()
      if (!updated) return reply.code(404).send({ error: 'SKU não encontrado' })
      return reply.send(updated)
    } catch (err: unknown) {
      if ((err as { code?: string }).code === '23505') {
        return reply.code(409).send({ error: `Código "${body.codigo}" já cadastrado` })
      }
      throw err
    }
  })

  fastify.delete('/cmv/:id', { preHandler: [fastify.requireAuth] }, async (request, reply) => {
    const { id } = request.params as { id: string }
    await fastify.db.delete(cmvProducts).where(eq(cmvProducts.id, parseInt(id, 10)))
    return reply.send({ ok: true })
  })

  fastify.get('/cmv/stats', { preHandler: [fastify.requireAuth] }, async (_request, reply) => {
    const totalRow = await fastify.db.select({ value: count() }).from(cmvProducts)
    const total = totalRow[0]?.value ?? 0

    const [latest] = await fastify.db
      .select({ updatedAt: cmvProducts.updatedAt })
      .from(cmvProducts)
      .orderBy(desc(cmvProducts.updatedAt))
      .limit(1)

    return reply.send({ total, lastUpdated: latest?.updatedAt ?? null })
  })
}

export default cmvRoutes
