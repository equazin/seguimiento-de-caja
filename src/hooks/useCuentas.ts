import { supabase } from '@/db/schema'
import type { Cuenta, Movimiento } from '@/db/schema'
import { getSaldoCuenta } from '@/db/queries'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { v4 as uuidv4 } from 'uuid'

export function useCuentas() {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('cuentas')
      .select('*')
      .eq('activa', true)
      .order('nombre')
    if (error) throw error
    return data ?? []
  }, [], ['cuentas'])
}

export function useCuentasConSaldo() {
  return useSupabaseQuery(async () => {
    const { data: cuentas, error } = await supabase
      .from('cuentas')
      .select('*')
      .eq('activa', true)
      .order('nombre')
    if (error) throw error

    const cuentasConSaldo = await Promise.all(
      (cuentas ?? []).map(async cuenta => ({
        ...cuenta,
        saldo_actual: await getSaldoCuenta(cuenta.id),
      }))
    )
    return cuentasConSaldo
  }, [], ['cuentas', 'movimientos'])
}

export async function crearCuenta(data: Omit<Cuenta, 'id'>) {
  const { error } = await supabase.from('cuentas').insert({ ...data, id: uuidv4() })
  if (error) throw error
  notifyDataChanged()
}

export async function actualizarCuenta(id: string, data: Partial<Omit<Cuenta, 'id'>>) {
  const { error } = await supabase.from('cuentas').update(data).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function desactivarCuenta(id: string) {
  const { error } = await supabase.from('cuentas').update({ activa: false }).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function transferirEntreCuentas(
  cuentaOrigenId: string,
  cuentaDestinoId: string,
  monto: number,
  descripcion: string,
  fecha: string,
  descuentoBancario: number = 0
) {
  const now = new Date().toISOString()
  const descripcionTransferencia = `Transferencia: ${descripcion}`
  const esDepositoEcheq = descuentoBancario > 0
  const movimientos: Movimiento[] = [
    {
      id: uuidv4(),
      fecha,
      tipo: 'egreso',
      monto_ars: monto,
      moneda_principal: 'ARS',
      descripcion: descripcionTransferencia,
      categoria_id: 'cat-bancarios',
      metodo_pago: esDepositoEcheq ? 'cheque' : 'transferencia',
      cuenta_id: cuentaOrigenId,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      fecha,
      tipo: 'ingreso',
      monto_ars: monto,
      moneda_principal: 'ARS',
      descripcion: descripcionTransferencia,
      categoria_id: 'cat-bancarios',
      metodo_pago: esDepositoEcheq ? 'cheque' : 'transferencia',
      cuenta_id: cuentaDestinoId,
      created_at: now,
      updated_at: now,
    },
  ]

  if (esDepositoEcheq) {
    movimientos.push({
      id: uuidv4(),
      fecha,
      tipo: 'egreso',
      monto_ars: descuentoBancario,
      moneda_principal: 'ARS',
      descripcion: `Impuestos/comisiones banco: ${descripcion}`,
      categoria_id: 'cat-bancarios',
      metodo_pago: 'cheque',
      cuenta_id: cuentaDestinoId,
      created_at: now,
      updated_at: now,
    })
  }

  const { error } = await supabase.from('movimientos').insert(movimientos)
  if (error) throw error
  notifyDataChanged()
}
