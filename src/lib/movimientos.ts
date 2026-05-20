import type { Movimiento } from '@/db/schema'
import { CUENTA_ECHEQS_ARS_ID } from '@/lib/constants'

const COBRO_ECHEQ_RE = /\[cobro_echeq:[^\]]+\]/
const IMPUESTOS_ECHEQ_RE = /\[impuestos:[^\]]+\]/

export function esCuentaVirtualEcheq(cuentaId: string | null | undefined): boolean {
  return cuentaId === CUENTA_ECHEQS_ARS_ID
}

export function esMovimientoCobroEcheq(movimiento: Pick<Movimiento, 'notas'>): boolean {
  return COBRO_ECHEQ_RE.test(movimiento.notas ?? '')
}

export function esMovimientoImpuestoEcheq(movimiento: Pick<Movimiento, 'notas'>): boolean {
  return IMPUESTOS_ECHEQ_RE.test(movimiento.notas ?? '')
}

export function esTransferenciaInterna(movimiento: Pick<Movimiento, 'categoria_id' | 'descripcion' | 'notas'>): boolean {
  if (esMovimientoCobroEcheq(movimiento) && !esMovimientoImpuestoEcheq(movimiento)) {
    return true
  }

  return (
    movimiento.categoria_id === 'cat-bancarios' &&
    movimiento.descripcion.trim().toLowerCase().startsWith('transferencia:')
  )
}

export function esMovimientoDeResultado(
  movimiento: Pick<Movimiento, 'categoria_id' | 'descripcion' | 'notas'>
): boolean {
  return !esTransferenciaInterna(movimiento)
}

export function valorMovimientoArs(movimiento: Pick<Movimiento, 'monto_ars'>): number {
  const monto = Number(movimiento.monto_ars)
  return Number.isFinite(monto) ? monto : 0
}

export function signoMovimiento(movimiento: Pick<Movimiento, 'tipo'>): number {
  return movimiento.tipo === 'ingreso' ? 1 : -1
}

export function resumirMovimientosResultado<
  T extends Pick<Movimiento, 'tipo' | 'monto_ars' | 'moneda_principal' | 'categoria_id' | 'descripcion' | 'notas'>,
>(movimientos: T[]) {
  const reportables = movimientos.filter(m =>
    (m.moneda_principal ?? 'ARS') === 'ARS' && esMovimientoDeResultado(m)
  )
  const ingresos = reportables
    .filter(m => m.tipo === 'ingreso')
    .reduce((s, m) => s + valorMovimientoArs(m), 0)
  const egresos = reportables
    .filter(m => m.tipo === 'egreso')
    .reduce((s, m) => s + valorMovimientoArs(m), 0)

  return {
    ingresos,
    egresos,
    resultado: ingresos - egresos,
    movimientos: reportables,
    internos: movimientos.length - reportables.length,
  }
}
