import { supabase } from '@/db/schema'
import type { Echeq, EchequEstado, Movimiento } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { cuentaEcheqsId } from '@/lib/constants'
import { v4 as uuidv4 } from 'uuid'

export type EchequInput = Omit<Echeq, 'id' | 'created_at' | 'movimiento_id'>

export function useEcheqs(movimientoId: string | null | undefined) {
  return useSupabaseQuery<Echeq[]>(async () => {
    if (!movimientoId) return []
    const { data, error } = await supabase
      .from('echeqs')
      .select('*')
      .eq('movimiento_id', movimientoId)
      .order('fecha', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [movimientoId], ['echeqs'])
}

export function useTodosLosEcheqs() {
  return useSupabaseQuery<Echeq[]>(async () => {
    const { data, error } = await supabase
      .from('echeqs')
      .select('*')
      .order('fecha', { ascending: true })
    if (error) throw error
    return data ?? []
  }, [], ['echeqs', 'movimientos'])
}

export async function reemplazarEcheqsMovimiento(
  movimientoId: string,
  echeqs: EchequInput[]
): Promise<void> {
  const eliminar = await supabase.from('echeqs').delete().eq('movimiento_id', movimientoId)
  if (eliminar.error) throw eliminar.error

  if (echeqs.length === 0) {
    notifyDataChanged()
    return
  }

  const filas = echeqs.map(e => ({ ...e, movimiento_id: movimientoId }))
  const insertar = await supabase.from('echeqs').insert(filas)
  if (insertar.error) throw insertar.error
  notifyDataChanged()
}

export async function actualizarEstadoEcheq(id: string, estado: EchequEstado): Promise<void> {
  const { error } = await supabase.from('echeqs').update({ estado }).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

/**
 * Marca un e-cheq como cobrado y genera la transferencia automática
 * desde la cuenta virtual "E-cheqs en cartera" hacia la cuenta destino real.
 *
 * Genera 2 movimientos:
 *  - Egreso en cuenta-echeqs-{ARS|USD}
 *  - Ingreso en cuenta destino
 *
 * Si el echeq pertenece a un movimiento ingreso (cobro de cheque), el flujo es:
 *   echeqs-cartera -> cuenta real (entra plata real)
 * Si el echeq pertenece a un movimiento egreso (pago con cheque), el flujo es:
 *   cuenta real -> echeqs-cartera (sale plata real)
 * En ambos casos el saldo neto del par es cero (transferencia interna).
 */
export async function cobrarEcheq(
  echeq: Echeq,
  cuentaDestinoId: string,
  fechaCobro: string,
  movimientoPadre: Movimiento
): Promise<void> {
  const moneda: 'ARS' | 'USD' = movimientoPadre.moneda_principal === 'USD' ? 'USD' : 'ARS'
  const cuentaVirtual = cuentaEcheqsId(moneda)
  const now = new Date().toISOString()
  const esIngreso = movimientoPadre.tipo === 'ingreso'
  const monto = echeq.monto

  const descripcion = `Cobro e-cheq ${echeq.numero ? `#${echeq.numero}` : ''} - ${echeq.librador}`.trim()

  const baseMovimiento = {
    fecha: fechaCobro,
    monto_ars: moneda === 'ARS' ? monto : 0,
    monto_usd: moneda === 'USD' ? monto : null,
    moneda_principal: moneda,
    categoria_id: movimientoPadre.categoria_id,
    subcategoria: 'Cobro e-cheq',
    descripcion,
    contacto: movimientoPadre.contacto,
    metodo_pago: 'transferencia' as const,
    notas: `[cobro_echeq:${echeq.id}]`,
    created_at: now,
    updated_at: now,
  }

  // Movimiento 1: sale de cartera virtual (si es ingreso) o entra a cartera (si era pago a proveedor)
  // Movimiento 2: entra a cuenta destino (si es ingreso) o sale de cuenta destino (si era pago)
  const movimientoVirtual = {
    id: uuidv4(),
    ...baseMovimiento,
    tipo: esIngreso ? ('egreso' as const) : ('ingreso' as const),
    cuenta_id: cuentaVirtual,
  }
  const movimientoReal = {
    id: uuidv4(),
    ...baseMovimiento,
    tipo: esIngreso ? ('ingreso' as const) : ('egreso' as const),
    cuenta_id: cuentaDestinoId,
  }

  const inserts = await supabase.from('movimientos').insert([movimientoVirtual, movimientoReal])
  if (inserts.error) throw inserts.error

  const updateEcheq = await supabase
    .from('echeqs')
    .update({ estado: 'cobrado' as EchequEstado, cuenta_destino_id: cuentaDestinoId })
    .eq('id', echeq.id)
  if (updateEcheq.error) throw updateEcheq.error

  notifyDataChanged()
}

export async function eliminarEcheq(id: string): Promise<void> {
  const { error } = await supabase.from('echeqs').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}
