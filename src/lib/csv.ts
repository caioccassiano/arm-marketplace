export type CsvRow = Record<string, string>

function detectDelimiter(line: string): string {
  return (line.match(/;/g) ?? []).length >= (line.match(/,/g) ?? []).length ? ';' : ','
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((v) => v.trim().replace(/^"|"$/g, ''))
}

function normalizeHeader(h: string): string {
  return h
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '_')
}

export function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean)
  if (lines.length < 2) return []
  const delimiter = detectDelimiter(lines[0]!)
  const headers = splitLine(lines[0]!, delimiter).map(normalizeHeader)
  return lines.slice(1).map((line) => {
    const cols = splitLine(line, delimiter)
    const row: CsvRow = {}
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? ''
    })
    return row
  })
}

const ALIASES: Record<string, string[]> = {
  orderNumber: ['numero_pedido', 'pedido', 'order_number', 'numero', 'id_pedido', 'n_pedido', 'nro_pedido', 'num_pedido', 'order'],
  totalAmount: ['valor_total', 'total', 'amount', 'valor', 'gmv', 'preco_total', 'price', 'vl_total', 'vlr_total'],
  marketplaceFee: ['taxa_marketplace', 'taxa', 'fee', 'comissao', 'commission', 'marketplace_fee', 'vl_taxa', 'vlr_taxa'],
  orderedAt: ['data_pedido', 'data', 'date', 'created_at', 'data_criacao', 'dt_pedido', 'dt_criacao'],
}

export function extractColumn(row: CsvRow, field: keyof typeof ALIASES): string | undefined {
  for (const alias of ALIASES[field]!) {
    const val = row[alias]
    if (val !== undefined && val !== '') return val
  }
  for (const key of Object.keys(row)) {
    for (const alias of ALIASES[field]!) {
      if (key.includes(alias) && row[key] !== '') return row[key]
    }
  }
  return undefined
}

export function parseAmount(s: string | undefined): string {
  if (!s) return '0.00'
  const n = parseFloat(s.replace(/\./g, '').replace(',', '.'))
  return isNaN(n) ? '0.00' : n.toFixed(2)
}

export function parseDate(s: string | undefined): Date {
  if (!s) return new Date()
  const br = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (br) return new Date(`${br[3]}-${br[2]}-${br[1]}T12:00:00Z`)
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(`${s.slice(0, 10)}T12:00:00Z`)
  return new Date()
}
