import type { EstadoPedidoCompra, EstadoPedidoVenta, MonedaCuenta, Movimiento, MovimientoVinculo, PedidoCompra, PedidoVenta } from '@/db/schema'

const RETENCION_GANANCIAS_RE = /\s*\[retencion_ganancias:([0-9]+(?:[\.,][0-9]+)?)\]\s*/i

export function obtenerRetencionGanancias(vinculo: Pick<MovimientoVinculo, 'notas'>): number {
  const match = vinculo.notas?.match(RETENCION_GANANCIAS_RE)
  if (!match) return 0
  const value = Number(match[1].replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : 0
}

export function limpiarNotaRetencion(notas: string | null | undefined): string {
  return (notas ?? '').replace(RETENCION_GANANCIAS_RE, '').trim()
}

export function serializarNotaRetencion(notas: string | null | undefined, retencionGanancias: number): string | null {
  const notaLimpia = limpiarNotaRetencion(notas)
  const retencion = Number.isFinite(retencionGanancias) && retencionGanancias > 0
    ? Math.round(retencionGanancias * 100) / 100
    : 0
  const marker = retencion > 0 ? `[retencion_ganancias:${retencion}]` : ''
  return [notaLimpia, marker].filter(Boolean).join(' ') || null
}

export function montoCanceladoVinculo(vinculo: Pick<MovimientoVinculo, 'monto_aplicado' | 'notas'>): number {
  return Number(vinculo.monto_aplicado) + obtenerRetencionGanancias(vinculo)
}

type MovimientoMoneda = Pick<Movimiento, 'id' | 'moneda_principal' | 'tipo_cambio'>
export type MovimientosPorId = Map<string, MovimientoMoneda>

function monedaPedido(pedido: PedidoCompra | PedidoVenta): MonedaCuenta {
  return pedido.monto_total_usd != null && Number(pedido.monto_total_usd) > 0 ? 'USD' : 'ARS'
}

export function totalPedidoEnMonedaPrincipal(pedido: PedidoCompra | PedidoVenta): number {
  return monedaPedido(pedido) === 'USD'
    ? Number(pedido.monto_total_usd ?? 0)
    : Number(pedido.monto_total)
}

function convertirMontoEntreMonedas(
  monto: number,
  monedaOrigen: MonedaCuenta,
  monedaDestino: MonedaCuenta,
  tipoCambio: number
): number {
  if (monedaOrigen === monedaDestino) return monto
  const tc = Number.isFinite(tipoCambio) && tipoCambio > 0 ? tipoCambio : 1
  return monedaDestino === 'USD' ? monto / tc : monto * tc
}

export function montoVinculoEnMonedaPedido(
  vinculo: Pick<MovimientoVinculo, 'movimiento_id' | 'monto_aplicado' | 'notas'>,
  pedido: PedidoCompra | PedidoVenta,
  movimientos?: MovimientosPorId,
  incluirRetenciones = true
): number {
  const movimiento = movimientos?.get(vinculo.movimiento_id)
  const monedaDestino = monedaPedido(pedido)
  const monedaOrigen = movimiento?.moneda_principal ?? monedaDestino
  const tipoCambio = Number(movimiento?.tipo_cambio ?? pedido.tipo_cambio ?? 1)
  const monto = incluirRetenciones ? montoCanceladoVinculo(vinculo) : Number(vinculo.monto_aplicado)
  return convertirMontoEntreMonedas(monto, monedaOrigen, monedaDestino, tipoCambio)
}

export function totalCanceladoEnMonedaPedido(
  pedido: PedidoCompra | PedidoVenta,
  vinculos: MovimientoVinculo[],
  movimientos?: MovimientosPorId
): number {
  return vinculos.reduce((s, v) => s + montoVinculoEnMonedaPedido(v, pedido, movimientos), 0)
}

export function calcularSaldoPendiente(
  pedido: PedidoCompra | PedidoVenta,
  vinculos: MovimientoVinculo[],
  movimientos?: MovimientosPorId
): number {
  const totalPagado = totalCanceladoEnMonedaPedido(pedido, vinculos, movimientos)
  return Math.max(0, totalPedidoEnMonedaPrincipal(pedido) - totalPagado)
}

export function calcularEstadoCompra(
  pedido: PedidoCompra,
  vinculos: MovimientoVinculo[],
  movimientos?: MovimientosPorId
): EstadoPedidoCompra {
  if (pedido.estado === 'cancelado') return 'cancelado'
  const totalPagado = totalCanceladoEnMonedaPedido(pedido, vinculos, movimientos)
  if (totalPagado <= 0) return 'pendiente'
  if (totalPagado >= totalPedidoEnMonedaPrincipal(pedido)) return 'pagado_total'
  return 'pagado_parcial'
}

export function calcularEstadoVenta(
  pedido: PedidoVenta,
  vinculos: MovimientoVinculo[],
  movimientos?: MovimientosPorId
): EstadoPedidoVenta {
  if (pedido.estado === 'cancelado') return 'cancelado'
  const totalCobrado = totalCanceladoEnMonedaPedido(pedido, vinculos, movimientos)
  if (totalCobrado <= 0) return 'pendiente'
  if (totalCobrado >= totalPedidoEnMonedaPrincipal(pedido)) return 'cobrado_total'
  return 'cobrado_parcial'
}

export function validarVinculos(
  montoMovimiento: number,
  vinculos: { monto_aplicado: number }[],
  moneda: 'ARS' | 'USD' = 'ARS'
): { valido: boolean; error?: string } {
  const suma = vinculos.reduce((s, v) => s + (v.monto_aplicado || 0), 0)
  const simbolo = moneda === 'USD' ? 'USD ' : '$'
  if (suma > montoMovimiento) {
    return {
      valido: false,
      error: `La suma de montos aplicados (${simbolo}${suma.toLocaleString('es-AR')}) supera el monto del movimiento (${simbolo}${montoMovimiento.toLocaleString('es-AR')})`,
    }
  }
  return { valido: true }
}

export function formatearNumeroOC(correlativo: number): string {
  const anio = new Date().getFullYear()
  return `OC-${anio}-${String(correlativo).padStart(4, '0')}`
}

export function formatearNumeroPV(correlativo: number): string {
  const anio = new Date().getFullYear()
  return `PV-${anio}-${String(correlativo).padStart(4, '0')}`
}

export function estaVencido(fechaVencimiento: string | null | undefined): boolean {
  if (!fechaVencimiento) return false
  return new Date(fechaVencimiento) < new Date(new Date().toISOString().split('T')[0])
}

export function venceProximamente(fechaVencimiento: string | null | undefined, dias = 7): boolean {
  if (!fechaVencimiento) return false
  const hoy = new Date(new Date().toISOString().split('T')[0])
  const venc = new Date(fechaVencimiento)
  const diff = (venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24)
  return diff >= 0 && diff <= dias
}

export const ESTADO_COMPRA_CONFIG: Record<EstadoPedidoCompra, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  pagado_parcial: { label: 'Pago parcial', color: '#3b82f6' },
  pagado_total: { label: 'Pagado', color: '#22c55e' },
  cancelado: { label: 'Cancelado', color: '#6b7280' },
}

export const ESTADO_VENTA_CONFIG: Record<EstadoPedidoVenta, { label: string; color: string }> = {
  pendiente: { label: 'Pendiente', color: '#f59e0b' },
  cobrado_parcial: { label: 'Cobro parcial', color: '#3b82f6' },
  cobrado_total: { label: 'Cobrado', color: '#22c55e' },
  cancelado: { label: 'Cancelado', color: '#6b7280' },
}
