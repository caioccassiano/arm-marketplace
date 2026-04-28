import { readFileSync } from 'fs'
import { sql } from 'drizzle-orm'
import { db } from '../db/client.js'
import { cmvProducts } from '../db/schema.js'

const CSV_PATH = '/Users/caiocassiano/Downloads/Exportar Consulta de Derivação do Produto-2026-04-27 18_31_30.csv'

function parsePrecoBR(raw: string): string | null {
  const cleaned = raw.replace(/^R\$\s*/i, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  if (!Number.isFinite(n) || n < 0) return null
  return n.toFixed(2)
}

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const buf = readFileSync(CSV_PATH)
const text = buf.toString('latin1')
const rawLines = text.trim().split(/\r?\n/).filter(Boolean)
const lines = rawLines.map((l) => l.split(';').map((c) => c.trim().replace(/^"|"$/g, '')))

if (lines.length === 0) {
  console.error('Arquivo vazio')
  process.exit(1)
}

const header = (lines[0] ?? []).map((c) => norm(String(c ?? '')))
const findIdx = (candidates: string[]): number =>
  header.findIndex((h) => candidates.some((c) => h === c || h.includes(c)))

const codigoIdx = findIdx(['codigo'])
const produtoIdIdx = findIdx(['id produto', 'idproduto'])
const descricaoIdx = findIdx(['produto - derivacao', 'derivacao', 'nome'])
const precoIdx = findIdx(['preco', 'price', 'valor'])

const colCodigo    = codigoIdx    >= 0 ? codigoIdx    : 0
const colProdutoId = produtoIdIdx >= 0 ? produtoIdIdx : 1
const colDescricao = descricaoIdx >= 0 ? descricaoIdx : 2
const colPreco     = precoIdx     >= 0 ? precoIdx     : 3

console.log(`Colunas detectadas: código=${colCodigo} produtoId=${colProdutoId} descrição=${colDescricao} preço=${colPreco}`)

const rows: { codigo: string; produtoId: string | null; descricao: string | null; preco: string }[] = []
const seen = new Set<string>()

for (const cols of lines.slice(1)) {
  const codigo = String(cols[colCodigo] ?? '').trim()
  if (!codigo || seen.has(codigo)) continue
  const precoStr = String(cols[colPreco] ?? '').trim()
  const preco = parsePrecoBR(precoStr)
  if (!preco) continue
  seen.add(codigo)
  rows.push({
    codigo,
    produtoId: String(cols[colProdutoId] ?? '').trim() || null,
    descricao: String(cols[colDescricao] ?? '').trim() || null,
    preco,
  })
}

console.log(`${rows.length} linhas parseadas. Fazendo upsert…`)

const CHUNK = 500
for (let i = 0; i < rows.length; i += CHUNK) {
  await db
    .insert(cmvProducts)
    .values(rows.slice(i, i + CHUNK))
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

console.log(`Concluído. ${rows.length} SKUs atualizados.`)
