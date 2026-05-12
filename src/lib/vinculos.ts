import type { EstadoPedidoCompra, EstadoPedidoVenta, MovimientoVinculo, PedidoCompra, PedidoVenta } from '@/db/schema'

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

export function calcularSaldoPendiente(
  pedido: PedidoCompra | PedidoVenta,
  vinculos: MovimientoVinculo[]
): number {
  const totalPagado = vinculos.reduce((s, v) => s + montoCanceladoVinculo(v), 0)
  return Math.max(0, pedido.monto_total - totalPagado)
}

export function calcularEstadoCompra(
  pedido: PedidoCompra,
  vinculos: MovimientoVinculo[]
): EstadoPedidoCompra {
  if (pedido.estado === 'cancelado') return 'cancelado'
  const totalPagado = vinculos.reduce((s, v) => s + montoCanceladoVinculo(v), 0)
  if (totalPagado <= 0) return 'pendiente'
  if (totalPagado >= pedido.monto_total) return 'pagado_total'
  return 'pagado_parcial'
}

export function calcularEstadoVenta(
  pedido: PedidoVenta,
  vinculos: MovimientoVinculo[]
): EstadoPedidoVenta {
  if (pedido.estado === 'cancelado') return 'cancelado'
  const totalCobrado = vinculos.reduce((s, v) => s + montoCanceladoVinculo(v), 0)
  if (totalCobrado <= 0) return 'pendiente'
  if (totalCobrado >= pedido.monto_total) return 'cobrado_total'
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
