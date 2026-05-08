import { supabaseAfip } from '@/db/schema'
import type {
  TipoDocumentoComercial,
  TipoOperacion,
  DocumentoItem,
} from '@/db/schema'

// =========================================================================
// Calculo de totales para items de documento
// =========================================================================

/**
 * El precio_unitario del item se interpreta en la moneda primaria
 * elegida (`monedaInput`). El cálculo devuelve siempre los importes
 * en ambas monedas usando el `tipoCambio` (ARS por 1 USD).
 */
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
  subtotal: number      // cantidad * precio - bonif (sin IVA, ARS)
  iva_importe: number   // ARS
  total: number         // ARS
  // Mismos importes en USD
  precio_unitario_usd: number
  subtotal_usd: number
  iva_importe_usd: number
  total_usd: number
}

export interface TotalesDocumento {
  subtotal: number
  iva_total: number
  exento: number
  no_gravado: number
  percepciones: number
  total: number
  // En USD
  subtotal_usd: number
  iva_total_usd: number
  exento_usd: number
  no_gravado_usd: number
  percepciones_usd: number
  total_usd: number
}

export type MonedaInput = 'ARS' | 'USD'

function round(n: number): number {
  return Math.round(n * 100) / 100
}

interface CalcularItemOpts {
  monedaInput: MonedaInput
  tipoCambio: number
}

export function calcularItem(item: ItemDraft, opts: CalcularItemOpts): ItemCalculado {
  const tc = opts.tipoCambio > 0 ? opts.tipoCambio : 1
  const bonif = Math.max(0, Math.min(100, item.bonificacion))
  const factorBonif = 1 - bonif / 100

  // Resolvemos precio en ambas monedas según la moneda primaria.
  let precioUnitarioArs: number
  let precioUnitarioUsd: number
  if (opts.monedaInput === 'USD') {
    precioUnitarioUsd = item.precio_unitario
    precioUnitarioArs = round(item.precio_unitario * tc)
  } else {
    precioUnitarioArs = item.precio_unitario
    precioUnitarioUsd = round(item.precio_unitario / tc)
  }

  const subtotalArs = round(item.cantidad * precioUnitarioArs * factorBonif)
  const subtotalUsd = round(item.cantidad * precioUnitarioUsd * factorBonif)
  const ivaArs = round(subtotalArs * (item.alicuota_iva / 100))
  const ivaUsd = round(subtotalUsd * (item.alicuota_iva / 100))

  return {
    ...item,
    precio_unitario: precioUnitarioArs,
    subtotal: subtotalArs,
    iva_importe: ivaArs,
    total: round(subtotalArs + ivaArs),
    precio_unitario_usd: precioUnitarioUsd,
    subtotal_usd: subtotalUsd,
    iva_importe_usd: ivaUsd,
    total_usd: round(subtotalUsd + ivaUsd),
  }
}

export function calcularTotales(
  items: ItemDraft[],
  opts: CalcularItemOpts = { monedaInput: 'ARS', tipoCambio: 1 }
): {
  items: ItemCalculado[]
  totales: TotalesDocumento
} {
  const calculados = items.map(it => calcularItem(it, opts))
  const sum = (key: keyof ItemCalculado) =>
    round(calculados.reduce((acc, it) => acc + Number(it[key] ?? 0), 0))

  const subtotal = sum('subtotal')
  const ivaTotal = sum('iva_importe')
  const subtotalUsd = sum('subtotal_usd')
  const ivaTotalUsd = sum('iva_importe_usd')

  const exento = round(
    calculados.filter(it => it.alicuota_iva === 0).reduce((acc, it) => acc + it.subtotal, 0)
  )
  const exentoUsd = round(
    calculados.filter(it => it.alicuota_iva === 0).reduce((acc, it) => acc + it.subtotal_usd, 0)
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
      subtotal_usd: subtotalUsd,
      iva_total_usd: ivaTotalUsd,
      exento_usd: exentoUsd,
      no_gravado_usd: 0,
      percepciones_usd: 0,
      total_usd: round(subtotalUsd + ivaTotalUsd),
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
    precio_unitario_usd: it.precio_unitario_usd,
    iva_importe_usd: it.iva_importe_usd,
    subtotal_usd: it.subtotal_usd,
    total_usd: it.total_usd,
  }
}
