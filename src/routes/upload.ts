import type { FastifyPluginAsync } from 'fastify'
import { parseCsv, extractColumn, parseAmount, parseDate } from '../lib/csv.js'
import * as XLSX from 'xlsx'

// ─── Generic marketplace reconciliation ──────────────────────────────────────

interface OrderRow {
  id: number
  orderNumber: string | null
  totalAmount: string
  marketplaceFee: string | null
  orderedAt: Date
}

export interface UploadItem {
  status: string
  magazordNum: string | null | undefined
  magazordAmount: string | undefined
  magazordFee: string | null | undefined
  marketplaceNum: string | null | undefined
  marketplaceAmount: string | undefined
  marketplaceFee: string | null | undefined
  amountDiff: string | undefined
  feeDiff: string | undefined
}

export interface UploadResult {
  marketplace: string
  summary: {
    magazordTotal: number
    marketplaceTotal: number
    matched: number
    amountMismatch: number
    magazordOnly: number
    marketplaceOnly: number
    totalAmountDiff: string
  }
  items: UploadItem[]
}

const TOLERANCE = 0.05

function normalize(s: string | null | undefined): string {
  return (s ?? '').replace(/\D/g, '')
}

function matchRows(magazord: OrderRow[], marketplace: OrderRow[]): UploadItem[] {
  const results: UploadItem[] = []
  const used = new Set<number>()

  for (const mz of magazord) {
    const mzNum = normalize(mz.orderNumber)
    const mzAmt = parseFloat(mz.totalAmount)
    let best: OrderRow | undefined

    if (mzNum) {
      best = marketplace.find((mp) => !used.has(mp.id) && normalize(mp.orderNumber).includes(mzNum))
    }

    if (!best) {
      const mzTime = mz.orderedAt.getTime()
      best = marketplace.find((mp) => {
        if (used.has(mp.id)) return false
        return (
          Math.abs(mzAmt - parseFloat(mp.totalAmount)) <= TOLERANCE &&
          Math.abs(mzTime - mp.orderedAt.getTime()) <= 86_400_000
        )
      })
    }

    if (best) {
      used.add(best.id)
      const aDiff = Math.abs(mzAmt - parseFloat(best.totalAmount))
      const fDiff = Math.abs(
        parseFloat(mz.marketplaceFee ?? '0') - parseFloat(best.marketplaceFee ?? '0'),
      )
      let status = 'matched'
      if (aDiff > TOLERANCE) status = 'amount_mismatch'
      else if (fDiff > TOLERANCE) status = 'fee_mismatch'
      results.push({
        status,
        magazordNum: mz.orderNumber,
        magazordAmount: mz.totalAmount,
        magazordFee: mz.marketplaceFee,
        marketplaceNum: best.orderNumber,
        marketplaceAmount: best.totalAmount,
        marketplaceFee: best.marketplaceFee,
        amountDiff: aDiff.toFixed(2),
        feeDiff: fDiff.toFixed(2),
      })
    } else {
      results.push({
        status: 'magazord_only',
        magazordNum: mz.orderNumber,
        magazordAmount: mz.totalAmount,
        magazordFee: mz.marketplaceFee,
        marketplaceNum: undefined,
        marketplaceAmount: undefined,
        marketplaceFee: undefined,
        amountDiff: undefined,
        feeDiff: undefined,
      })
    }
  }

  for (const mp of marketplace) {
    if (!used.has(mp.id)) {
      results.push({
        status: 'marketplace_only',
        magazordNum: undefined,
        magazordAmount: undefined,
        magazordFee: undefined,
        marketplaceNum: mp.orderNumber,
        marketplaceAmount: mp.totalAmount,
        marketplaceFee: mp.marketplaceFee,
        amountDiff: undefined,
        feeDiff: undefined,
      })
    }
  }

  return results
}

// ─── TikTok × Magazord reconciliation ────────────────────────────────────────

export interface SkuItem {
  sku: string
  quantity: number
}

interface TikTokRow {
  orderId: string
  status: string
  amount: string
  shippingFee: string
  subtotalAfter: string
  items: SkuItem[]
}

interface MagazordTikTokRow {
  codigoSecundario: string
  situacao: string
  valorTotal: string
}

export interface TikTokItem {
  statusMatch: 'MATCH_OK' | 'MATCH_COM_DIVERGENCIA' | 'SOMENTE_TIKTOK' | 'SOMENTE_ERP'
  statusFinanceiro: 'OK' | 'DIVERGENTE' | 'A_RECEBER' | 'IGNORAR'
  motivoDivergencia: string | null
  foiTransacionado: boolean
  pago: boolean
  emEspera: boolean
  tiktokOrderId: string | null
  tiktokStatus: string | null
  tiktokAmount: string | null
  magazordCodSec: string | null
  magazordSituacao: string | null
  magazordAmount: string | null
  diferencaValor: string | null
  receitaLiquida: string | null
  tarifaTiktok: string | null
  comissaoCreator: string | null
  items: SkuItem[]
}

export interface ReembolsoEntry {
  orderId: string | null
  ajusteId: string | null
  dataLiquidacao: string | null
  valor: number
  tipoTransacao: string
}

export interface TikTokReconcileResult {
  summary: {
    tiktokTotal: number
    magazordTotal: number
    matchOk: number
    matchDivergente: number
    somenteTiktok: number
    somenteErp: number
    totalDiff: string
    liquidadosPagos: number
    emEsperaTotal: number
    receitaLiquidaTotal: string
    totalTarifaTiktok: number
    totalComissaoCreator: number
  }
  items: TikTokItem[]
  reembolsos: ReembolsoEntry[]
}

const TIKTOK_TRANSACIONADO = new Set(['Concluído', 'A ser enviado', 'Enviado'])
const TIKTOK_TOLERANCE = 0.01

function isXlsxBuffer(buf: Buffer): boolean {
  // XLSX is a ZIP file — magic bytes PK (0x50 0x4B)
  return buf[0] === 0x50 && buf[1] === 0x4b
}

function expandSheetRange(ws: XLSX.WorkSheet): void {
  // Alguns exports do TikTok salvam o !ref limitado às primeiras linhas, mas
  // mantêm células reais até linhas muito além. Recalcula o range a partir
  // das células presentes para que sheet_to_json leia tudo.
  let maxRow = 0
  let maxCol = 0
  for (const key of Object.keys(ws)) {
    if (key.startsWith('!')) continue
    const addr = XLSX.utils.decode_cell(key)
    if (addr.r > maxRow) maxRow = addr.r
    if (addr.c > maxCol) maxCol = addr.c
  }
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } })
}

function xlsxToRows(buf: Buffer): string[][] {
  const wb = XLSX.read(buf, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0] ?? '']
  if (!ws) return []
  expandSheetRange(ws)
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as string[][]
}

function parseTiktokAmount(s: string): string {
  const clean = s.replace(/^BRL\s*/i, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(clean)
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

function buildTiktokOrderMap(rows: string[][]): TikTokRow[] {
  // TikTok exports always have row 0 = headers, row 1 = descriptions — skip both
  // If file is CSV and row 1 looks like data (not a description), skip only row 0
  const descriptionKeyword = 'unique order'
  const row1 = String(rows[1]?.[0] ?? '').toLowerCase()
  const dataStart = row1.includes(descriptionKeyword) ? 2 : 1

  // SKU está na coluna H (índice 7 — "Seller SKU"). Detecta via header com fallback
  const header = (rows[0] ?? []).map((c) => String(c ?? '').trim().toLowerCase())
  const findCol = (candidates: string[], fallback: number): number => {
    const i = header.findIndex((h) => candidates.some((c) => h === c || h.includes(c)))
    return i >= 0 ? i : fallback
  }
  const skuIdx = findCol(['seller sku', 'seller_sku'], 7)
  const qtyIdx = findCol(['quantity', 'qty', 'quantidade'], -1)

  const orderMap = new Map<string, TikTokRow>()
  for (const row of rows.slice(dataStart)) {
    const orderId = String(row[0] ?? '').trim()
    if (!orderId) continue

    const sku = String(row[skuIdx] ?? '').trim()
    const qtyRaw = qtyIdx >= 0 ? String(row[qtyIdx] ?? '').trim() : ''
    const qty = qtyRaw ? Math.max(1, parseInt(qtyRaw, 10) || 1) : 1

    const existing = orderMap.get(orderId)
    if (existing) {
      if (sku) {
        const found = existing.items.find((it) => it.sku === sku)
        if (found) found.quantity += qty
        else existing.items.push({ sku, quantity: qty })
      }
      continue
    }

    const amount = parseTiktokAmount(String(row[23] ?? ''))
    if (parseFloat(amount) === 0) continue // brinde — ignorar
    orderMap.set(orderId, {
      orderId,
      status: String(row[2] ?? '').trim(),
      amount,
      shippingFee: parseTiktokAmount(String(row[18] ?? '')),
      subtotalAfter: parseTiktokAmount(String(row[17] ?? '')),
      items: sku ? [{ sku, quantity: qty }] : [],
    })
  }
  return [...orderMap.values()]
}

function parseTiktokFile(buf: Buffer): TikTokRow[] {
  if (isXlsxBuffer(buf)) {
    return buildTiktokOrderMap(xlsxToRows(buf))
  }
  // CSV — try UTF-8 first, fallback to latin1
  let text: string
  try {
    text = buf.toString('utf-8')
    if (text.includes('�')) throw new Error('invalid utf8')
  } catch {
    text = buf.toString('latin1')
  }
  const delimiter = text.includes(';') ? ';' : ','
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  const rows = lines.map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')))
  return buildTiktokOrderMap(rows)
}

interface LiquidadoData {
  valor: number
  tarifaTiktok: number
  comissaoCreator: number
}

function normalizeHeader(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function findHeaderIdx(header: string[], patterns: RegExp[]): number {
  for (let i = 0; i < header.length; i++) {
    const h = normalizeHeader(String(header[i] ?? ''))
    if (patterns.some((p) => p.test(h))) return i
  }
  return -1
}

function parseDataLiquidacao(raw: string): string | null {
  const s = (raw ?? '').trim()
  if (!s) return null
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  m = /^(\d{2})[\/\-](\d{2})[\/\-](\d{4})/.exec(s)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  m = /^(\d{4})\/(\d{2})\/(\d{2})/.exec(s)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const d = new Date(s)
  if (!isNaN(d.getTime())) {
    const yyyy = d.getUTCFullYear()
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
    const dd = String(d.getUTCDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }
  return null
}

function parseLiquidadosFile(buf: Buffer): { paid: Map<string, LiquidadoData>; reembolsos: ReembolsoEntry[] } {
  // Liquidação: para cada linha, lê col G (idx 6) "ID do pedido/ajuste" + col 38 "ID do pedido relacionado"
  // Soma col N (idx 13) "Valor total a ser liquidado" agrupado pelo orderId — refunds zeram o valor.
  // Tarifa TikTok = cols Y(24) + AA(26) + AB(27); Comissão Creator = col AF(31)
  // Coluna F (idx 5) "Tipo de Transacao" — quando contém "Reembolso", linha vira entrada em `reembolsos`.
  let sheets: string[][][]
  if (isXlsxBuffer(buf)) {
    const wb = XLSX.read(buf, { type: 'buffer' })
    sheets = wb.SheetNames.map((n) => {
      const ws = wb.Sheets[n]
      if (!ws) return []
      expandSheetRange(ws)
      return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as string[][]
    })
  } else {
    const text = buf.toString('utf-8')
    const delimiter = text.includes(';') ? ';' : ','
    const rows = text.trim().split(/\r?\n/).filter(Boolean)
      .map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')))
    sheets = [rows]
  }

  const paid = new Map<string, LiquidadoData>()
  const reembolsos: ReembolsoEntry[] = []
  const isOrderId = (s: string): boolean => s.length >= 15 && /^\d+$/.test(s)
  const parseValue = (s: string): number => {
    const n = parseFloat(String(s ?? '').trim())
    return Number.isFinite(n) ? n : 0
  }

  for (const rows of sheets) {
    if (rows.length === 0) continue
    const header = rows[0]?.map((h) => String(h ?? '').trim()) ?? []
    if (header[6] !== 'ID do pedido/ajuste') continue

    const idxTipo = findHeaderIdx(header, [/tipo.*transac/, /transaction.*type/])
    const idxData = findHeaderIdx(header, [/data.*liquidac/, /^data$/, /liquidation.*date/, /transaction.*date/])

    for (const cols of rows.slice(1)) {
      const direct = String(cols[6] ?? '').trim()
      const related = String(cols[38] ?? '').trim()
      // Col 38 ("ID do pedido relacionado") sempre aponta para o pedido real:
      // - Para linhas tipo "Pedido": col 6 == col 38 (mesmo ID)
      // - Para "Reembolso de logística" e outros ajustes: col 6 = ID do ajuste,
      //   col 38 = ID do pedido original que recebe o ajuste
      const orderId = isOrderId(related) ? related : isOrderId(direct) ? direct : ''
      const value = parseValue(String(cols[13] ?? ''))
      const tarifa = parseValue(String(cols[24] ?? '')) + parseValue(String(cols[26] ?? '')) + parseValue(String(cols[27] ?? ''))
      const comissao = parseValue(String(cols[31] ?? ''))

      if (idxTipo >= 0) {
        const tipo = String(cols[idxTipo] ?? '').trim()
        if (tipo && normalizeHeader(tipo).includes('reembolso')) {
          const dataRaw = idxData >= 0 ? String(cols[idxData] ?? '').trim() : ''
          reembolsos.push({
            orderId: isOrderId(related) ? related : null,
            ajusteId: isOrderId(direct) ? direct : null,
            dataLiquidacao: parseDataLiquidacao(dataRaw),
            valor: value,
            tipoTransacao: tipo,
          })
        }
      }

      if (!orderId) continue
      const existing = paid.get(orderId) ?? { valor: 0, tarifaTiktok: 0, comissaoCreator: 0 }
      paid.set(orderId, {
        valor: existing.valor + value,
        tarifaTiktok: existing.tarifaTiktok + tarifa,
        comissaoCreator: existing.comissaoCreator + comissao,
      })
    }
  }
  return { paid, reembolsos }
}

function parseEmEsperaFile(buf: Buffer): Map<string, LiquidadoData> {
  // "Pedidos não liquidados e ajuste" do TikTok Shop:
  //   header em row 5 (idx 4); dados em row 6+ (idx 5+).
  //   col AM (idx 38) = "ID do pedido relacionado".
  //   col D (idx 3) = "Valor estimado a ser liquidado" — somado por orderId.
  //   Tarifa TikTok = cols T(19) + V(21); Comissão Creator = col AA(26)
  let sheets: string[][][]
  if (isXlsxBuffer(buf)) {
    const wb = XLSX.read(buf, { type: 'buffer' })
    sheets = wb.SheetNames.map((n) => {
      const ws = wb.Sheets[n]
      if (!ws) return []
      expandSheetRange(ws)
      return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: '' }) as string[][]
    })
  } else {
    const text = buf.toString('utf-8')
    const delimiter = text.includes(';') ? ';' : ','
    const rows = text.trim().split(/\r?\n/).filter(Boolean)
      .map((l) => l.split(delimiter).map((c) => c.trim().replace(/^"|"$/g, '')))
    sheets = [rows]
  }

  const waiting = new Map<string, LiquidadoData>()
  const isOrderId = (s: string): boolean => s.length >= 15 && /^\d+$/.test(s)
  const parseValue = (s: string): number => {
    const n = parseFloat(String(s ?? '').trim())
    return Number.isFinite(n) ? n : 0
  }

  for (const rows of sheets) {
    if (rows.length === 0) continue
    // Localiza a linha de header procurando "ID do pedido relacionado" em col AM
    let headerIdx = -1
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      if (String(rows[i]?.[38] ?? '').trim() === 'ID do pedido relacionado') {
        headerIdx = i
        break
      }
    }
    if (headerIdx < 0) continue

    for (const cols of rows.slice(headerIdx + 1)) {
      const orderId = String(cols[38] ?? '').trim()
      if (!orderId || orderId === '/' || !isOrderId(orderId)) continue
      const value = parseValue(String(cols[3] ?? ''))
      const tarifa = parseValue(String(cols[19] ?? '')) + parseValue(String(cols[21] ?? ''))
      const comissao = parseValue(String(cols[26] ?? ''))
      const existing = waiting.get(orderId) ?? { valor: 0, tarifaTiktok: 0, comissaoCreator: 0 }
      waiting.set(orderId, {
        valor: existing.valor + value,
        tarifaTiktok: existing.tarifaTiktok + tarifa,
        comissaoCreator: existing.comissaoCreator + comissao,
      })
    }
  }
  return waiting
}

function parseMagazordFile(buf: Buffer): MagazordTikTokRow[] {
  let lines: string[][]

  if (isXlsxBuffer(buf)) {
    lines = xlsxToRows(buf).slice(1) // skip header row
  } else {
    const text = buf.toString('latin1')
    const rawLines = text.trim().split(/\r?\n/).filter(Boolean)
    lines = rawLines.slice(1).map((l) => l.split(';').map((c) => c.trim().replace(/^"|"$/g, '')))
  }

  const rows: MagazordTikTokRow[] = []
  for (const cols of lines) {
    const codigoSecundario = String(cols[5] ?? '').trim()
    if (!codigoSecundario) continue
    const situacao = String(cols[0] ?? '').trim()
    const rawAmt = String(cols[30] ?? '0').replace(/\./g, '').replace(',', '.')
    const n = parseFloat(rawAmt)
    rows.push({ codigoSecundario, situacao, valorTotal: isNaN(n) ? '0.00' : n.toFixed(2) })
  }
  return rows
}

function reconcileTiktok(
  tiktokRows: TikTokRow[],
  magazordRows: MagazordTikTokRow[],
  paidMap: Map<string, LiquidadoData>,
  waitingMap: Map<string, LiquidadoData>,
): TikTokItem[] {
  const magazordMap = new Map<string, MagazordTikTokRow>()
  for (const mz of magazordRows) magazordMap.set(mz.codigoSecundario, mz)

  const items: TikTokItem[] = []
  const usedMagazord = new Set<string>()

  // Liquidado tem prioridade sobre em espera
  const liquidaFor = (orderId: string): string | null => {
    const paid = paidMap.get(orderId)
    if (paid) return paid.valor.toFixed(2)
    const waiting = waitingMap.get(orderId)
    if (waiting) return waiting.valor.toFixed(2)
    return null
  }

  const tiktokCostsFor = (orderId: string): { tarifaTiktok: string | null; comissaoCreator: string | null } => {
    const data = paidMap.get(orderId) ?? waitingMap.get(orderId)
    if (!data) return { tarifaTiktok: null, comissaoCreator: null }
    return { tarifaTiktok: data.tarifaTiktok.toFixed(2), comissaoCreator: data.comissaoCreator.toFixed(2) }
  }

  for (const tk of tiktokRows) {
    const mz = magazordMap.get(tk.orderId)
    const foiTransacionado = TIKTOK_TRANSACIONADO.has(tk.status)
    const pago = paidMap.has(tk.orderId)
    const emEspera = waitingMap.has(tk.orderId)
    const receitaLiquida = liquidaFor(tk.orderId)

    if (mz) {
      usedMagazord.add(tk.orderId)
      const diff = parseFloat(tk.amount) - parseFloat(mz.valorTotal)
      const absDiff = Math.abs(diff)
      const statusMatch: TikTokItem['statusMatch'] =
        absDiff <= TIKTOK_TOLERANCE ? 'MATCH_OK' : 'MATCH_COM_DIVERGENCIA'
      const shipping = parseFloat(tk.shippingFee)
      const subtotalAfter = parseFloat(tk.subtotalAfter)
      // Parcelamento = quanto o Order Amount excede a soma das partes (subtotal + frete)
      // Indica juros do parcelamento embutidos no valor pago pelo comprador
      const parcelExcess = parseFloat(tk.amount) - subtotalAfter - shipping
      let motivoDivergencia: string | null = null
      if (statusMatch === 'MATCH_COM_DIVERGENCIA') {
        if (absDiff < 0.1) motivoDivergencia = 'ARREDONDAMENTO'
        else if (shipping > 0 && Math.abs(absDiff - shipping) <= 0.1) motivoDivergencia = 'FRETE_CLIENTE'
        else if (
          shipping > 0 &&
          parcelExcess > 0.1 &&
          Math.abs(absDiff - shipping - parcelExcess) <= 0.5
        ) motivoDivergencia = 'FRETE_PARCELAMENTO'
        else if (parcelExcess > 0.1 && Math.abs(absDiff - parcelExcess) <= 0.5) motivoDivergencia = 'PARCELAMENTO'
        else motivoDivergencia = 'NAO_IDENTIFICADO'
      }
      const statusFinanceiro: TikTokItem['statusFinanceiro'] = foiTransacionado
        ? statusMatch === 'MATCH_OK'
          ? 'OK'
          : 'DIVERGENTE'
        : 'IGNORAR'
      items.push({
        statusMatch,
        statusFinanceiro,
        motivoDivergencia,
        foiTransacionado,
        pago,
        emEspera,
        tiktokOrderId: tk.orderId,
        tiktokStatus: tk.status,
        tiktokAmount: tk.amount,
        magazordCodSec: mz.codigoSecundario,
        magazordSituacao: mz.situacao,
        magazordAmount: mz.valorTotal,
        diferencaValor: diff.toFixed(2),
        receitaLiquida,
        ...tiktokCostsFor(tk.orderId),
        items: tk.items,
      })
    } else {
      items.push({
        statusMatch: 'SOMENTE_TIKTOK',
        statusFinanceiro: foiTransacionado ? 'A_RECEBER' : 'IGNORAR',
        motivoDivergencia: null,
        foiTransacionado,
        pago,
        emEspera,
        tiktokOrderId: tk.orderId,
        tiktokStatus: tk.status,
        tiktokAmount: tk.amount,
        magazordCodSec: null,
        magazordSituacao: null,
        magazordAmount: null,
        diferencaValor: null,
        receitaLiquida,
        ...tiktokCostsFor(tk.orderId),
        items: tk.items,
      })
    }
  }

  for (const [codSec, mz] of magazordMap) {
    if (!usedMagazord.has(codSec)) {
      items.push({
        statusMatch: 'SOMENTE_ERP',
        statusFinanceiro: 'IGNORAR',
        motivoDivergencia: null,
        foiTransacionado: false,
        pago: false,
        emEspera: false,
        tiktokOrderId: null,
        tiktokStatus: null,
        tiktokAmount: null,
        magazordCodSec: codSec,
        magazordSituacao: mz.situacao,
        magazordAmount: mz.valorTotal,
        diferencaValor: null,
        receitaLiquida: null,
        tarifaTiktok: null,
        comissaoCreator: null,
        items: [],
      })
    }
  }

  return items
}

// ─── Routes ──────────────────────────────────────────────────────────────────

const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/upload/reconcile',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const parts = request.parts()
      let magazordCsv = ''
      let marketplaceCsv = ''
      let marketplaceName = 'Marketplace'

      for await (const part of parts) {
        if (part.type === 'field') {
          if (part.fieldname === 'marketplace') marketplaceName = String(part.value)
        } else {
          const buf = await part.toBuffer()
          const text = buf.toString('utf-8')
          if (part.fieldname === 'magazord') magazordCsv = text
          else if (part.fieldname === 'marketplace_file') marketplaceCsv = text
        }
      }

      if (!magazordCsv || !marketplaceCsv) {
        return reply.code(400).send({ error: 'Envie os dois arquivos CSV' })
      }

      const toRow = (raw: Record<string, string>, i: number): OrderRow => ({
        id: i,
        orderNumber: extractColumn(raw, 'orderNumber') ?? null,
        totalAmount: parseAmount(extractColumn(raw, 'totalAmount')),
        marketplaceFee:
          extractColumn(raw, 'marketplaceFee') !== undefined
            ? parseAmount(extractColumn(raw, 'marketplaceFee'))
            : null,
        orderedAt: parseDate(extractColumn(raw, 'orderedAt')),
      })

      const magazordRows = parseCsv(magazordCsv).map(toRow)
      const marketplaceRows = parseCsv(marketplaceCsv).map(toRow)
      const items = matchRows(magazordRows, marketplaceRows)

      const matched = items.filter((i) => i.status === 'matched').length
      const amountMismatch = items.filter((i) => i.status === 'amount_mismatch').length
      const magazordOnly = items.filter((i) => i.status === 'magazord_only').length
      const marketplaceOnly = items.filter((i) => i.status === 'marketplace_only').length
      const totalDiff = items.reduce((s, i) => s + parseFloat(i.amountDiff ?? '0'), 0)

      const result: UploadResult = {
        marketplace: marketplaceName,
        summary: {
          magazordTotal: magazordRows.length,
          marketplaceTotal: marketplaceRows.length,
          matched,
          amountMismatch,
          magazordOnly,
          marketplaceOnly,
          totalAmountDiff: totalDiff.toFixed(2),
        },
        items,
      }

      return reply.send(result)
    },
  )

  fastify.post(
    '/upload/tiktok-reconcile',
    { preHandler: [fastify.requireAuth] },
    async (request, reply) => {
      const parts = request.parts()
      let tiktokBuf: Buffer | null = null
      let magazordBuf: Buffer | null = null
      let liquidadosBuf: Buffer | null = null
      let emEsperaBuf: Buffer | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          const buf = await part.toBuffer()
          if (part.fieldname === 'tiktok') tiktokBuf = buf
          else if (part.fieldname === 'magazord') magazordBuf = buf
          else if (part.fieldname === 'liquidados') liquidadosBuf = buf
          else if (part.fieldname === 'em_espera') emEsperaBuf = buf
        }
      }

      if (!tiktokBuf || !magazordBuf) {
        return reply.code(400).send({ error: 'Envie os dois arquivos (tiktok + magazord)' })
      }

      const tiktokRows = parseTiktokFile(tiktokBuf)
      const magazordRows = parseMagazordFile(magazordBuf)
      const liquidadosResult = liquidadosBuf
        ? parseLiquidadosFile(liquidadosBuf)
        : { paid: new Map<string, LiquidadoData>(), reembolsos: [] as ReembolsoEntry[] }
      const paidMap = liquidadosResult.paid
      const reembolsos = liquidadosResult.reembolsos
      const waitingMap = emEsperaBuf ? parseEmEsperaFile(emEsperaBuf) : new Map<string, LiquidadoData>()
      const items = reconcileTiktok(tiktokRows, magazordRows, paidMap, waitingMap)

      const matchOk = items.filter((i) => i.statusMatch === 'MATCH_OK').length
      const matchDivergente = items.filter((i) => i.statusMatch === 'MATCH_COM_DIVERGENCIA').length
      const somenteTiktok = items.filter((i) => i.statusMatch === 'SOMENTE_TIKTOK').length
      const somenteErp = items.filter((i) => i.statusMatch === 'SOMENTE_ERP').length
      const totalDiff = items.reduce((s, i) => s + parseFloat(i.diferencaValor ?? '0'), 0)
      const liquidadosPagos = items.filter((i) => i.pago).length
      const emEsperaTotal = items.filter((i) => i.emEspera).length
      const receitaLiquidaTotal = items
        .filter((i) => i.foiTransacionado && i.receitaLiquida !== null)
        .reduce((s, i) => s + parseFloat(i.receitaLiquida ?? '0'), 0)
      const totalTarifaTiktok = items.reduce((s, i) => s + parseFloat(i.tarifaTiktok ?? '0'), 0)
      const totalComissaoCreator = items.reduce((s, i) => s + parseFloat(i.comissaoCreator ?? '0'), 0)

      const result: TikTokReconcileResult = {
        summary: {
          tiktokTotal: tiktokRows.length,
          magazordTotal: magazordRows.length,
          matchOk,
          matchDivergente,
          somenteTiktok,
          somenteErp,
          totalDiff: totalDiff.toFixed(2),
          liquidadosPagos,
          emEsperaTotal,
          receitaLiquidaTotal: receitaLiquidaTotal.toFixed(2),
          totalTarifaTiktok: +totalTarifaTiktok.toFixed(2),
          totalComissaoCreator: +totalComissaoCreator.toFixed(2),
        },
        items,
        reembolsos,
      }

      return reply.send(result)
    },
  )
}

export default uploadRoutes
