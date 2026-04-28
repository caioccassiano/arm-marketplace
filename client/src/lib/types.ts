export interface SkuItem {
  sku: string
  quantity: number
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
    receitaLiquidaTotal?: string
    totalTarifaTiktok?: number
    totalComissaoCreator?: number
  }
  items: TikTokItem[]
}
