import { supabaseAfip } from '@/db/schema'
import type {
  TipoDocumentoComercial,
  TipoOperacion,
  DocumentoItem,
} from '@/db/schema'

// =========================================================================
// Calculo de totales para items de documento
// =========================================================================

export interface ItemDraft {
  producto_id: string | null
  codigo: string | null
  descripcion: string
  cantidad: number
  unidad_medida: string
  precio_unitario: number
  bonificacion: number  // porcentaje 0..100
  alicuota_iva: number  // porcentaje 0..100
}

export interface ItemCalculado extends ItemDraft {
  subtotal: number      // cantidad * precio - bonif (sin IVA)
  iva_importe: number
  total: number
}

export interface TotalesDocumento {
  subtotal: number
  iva_total: number
  exento: number
  no_gravado: number
  percepciones: number
  total: number
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}

export function calcularItem(item: ItemDraft): ItemCalculado {
  const bonif = Math.max(0, Math.min(100, item.bonificacion))
  const baseBruta = item.cantidad * item.precio_unitario
  const subtotal = round(baseBruta * (1 - bonif / 100))
  const iva = round(subtotal * (item.alicuota_iva / 100))
  return {
    ...item,
    subtotal,
    iva_importe: iva,
    total: round(subtotal + iva),
  }
}

export function calcularTotales(items: ItemDraft[]): {
  items: ItemCalculado[]
  totales: TotalesDocumento
} {
  const calculados = items.map(calcularItem)
  const subtotal = round(calculados.reduce((acc, it) => acc + it.subtotal, 0))
  const ivaTotal = round(calculados.reduce((acc, it) => acc + it.iva_importe, 0))
  const exento = round(
    calculados
      .filter(it => it.alicuota_iva === 0)
      .reduce((acc, it) => acc + it.subtotal, 0)
  )
  return {
    items: calculados,
    totales: {
      subtotal,
      iva_total: ivaTotal,
      exento,
      no_gravado: 0,
      percepciones: 0,
      total: round(subtotal + ivaTotal),
    },
  }
}

// =========================================================================
// Numeracion interna por empresa + tipo de operacion + tipo de documento
// =========================================================================

const PREFIJOS: Record<TipoDocumentoComercial, string> = {
  presupuesto: 'PRES',
  pedido: 'PED',
  remito: 'REM',
  factura: 'FAC',
  nota_credito: 'NC',
  nota_debito: 'ND',
}

export async function siguienteNumeroInterno(
  empresaId: string,
  tipoOperacion: TipoOperacion,
  tipoDocumento: TipoDocumentoComercial
): Promise<string> {
  const prefijo = PREFIJOS[tipoDocumento]
  const { data, error } = await supabaseAfip
    .from('documentos')
    .select('numero_interno')
    .eq('empresa_id', empresaId)
    .eq('tipo_operacion', tipoOperacion)
    .eq('tipo_documento', tipoDocumento)
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error

  const rows = (data ?? []) as Array<{ numero_interno: string }>
  let max = 0
  for (const row of rows) {
    const match = row.numero_interno?.match(/(\d+)$/)
    if (!match) continue
    const n = Number(match[1])
    if (Number.isFinite(n) && n > max) max = n
  }
  const next = max + 1
  return `${prefijo}-${String(next).padStart(5, '0')}`
}

// =========================================================================
// Helpers de etiqueta para UI
// =========================================================================

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoComercial, string> = {
  presupuesto: 'Presupuesto',
  pedido: 'Pedido',
  remito: 'Remito',
  factura: 'Factura',
  nota_credito: 'Nota de crédito',
  nota_debito: 'Nota de débito',
}

export function tipoDocumentoLabel(tipo: TipoDocumentoComercial): string {
  return TIPO_DOCUMENTO_LABEL[tipo]
}

// =========================================================================
// Errores de ARCA: extraer mensajes amigables
// =========================================================================

export interface ArcaMensaje {
  code?: number | string | null
  msg?: string | null
}

export function parseArcaMensajes(input: unknown): ArcaMensaje[] {
  if (!input) return []
  if (Array.isArray(input)) {
    const result: ArcaMensaje[] = []
    for (const item of input) {
      if (item && typeof item === 'object') {
        const record = item as Record<string, unknown>
        const code = (record.code ?? record.Code ?? null) as ArcaMensaje['code']
        const msg = (record.msg ?? record.Msg ?? null) as ArcaMensaje['msg']
        if (msg || code) result.push({ code, msg })
      } else if (typeof item === 'string' && item.trim()) {
        result.push({ msg: item })
      }
    }
    return result
  }
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input)
      return parseArcaMensajes(parsed)
    } catch {
      return [{ msg: input }]
    }
  }
  if (typeof input === 'object') {
    return parseArcaMensajes([input])
  }
  return []
}

export function primerMensajeArca(input: unknown): string | null {
  const mensajes = parseArcaMensajes(input)
  if (mensajes.length === 0) return null
  const first = mensajes[0]
  return (first.msg ?? '').trim() || (first.code ? `Error ${first.code}` : null)
}

export function formatMensajesArca(input: unknown, maxLen = 220): string | null {
  const mensajes = parseArcaMensajes(input)
  if (mensajes.length === 0) return null
  const joined = mensajes
    .map(m => [m.code != null ? `[${m.code}]` : '', m.msg ?? ''].filter(Boolean).join(' ').trim())
    .filter(Boolean)
    .join(' · ')
  return joined.length > maxLen ? `${joined.slice(0, maxLen - 1)}…` : joined
}

export function itemFromCalculado(it: ItemCalculado, orden: number): Omit<DocumentoItem, 'id' | 'documento_id'> {
  return {
    producto_id: it.producto_id,
    orden,
    codigo: it.codigo,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    unidad_medida: it.unidad_medida,
    precio_unitario: it.precio_unitario,
    bonificacion: it.bonificacion,
    alicuota_iva: it.alicuota_iva,
    iva_importe: it.iva_importe,
    subtotal: it.subtotal,
    total: it.total,
  }
}
