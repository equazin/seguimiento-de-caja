import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Cuenta } from '@/db/schema'
import { getSaldoCuenta } from '@/db/queries'
import { v4 as uuidv4 } from 'uuid'

export function useCuentas() {
  return useLiveQuery(() => db.cuentas.filter(c => c.activa === true).toArray())
}

export function useCuentasConSaldo() {
  return useLiveQuery(async () => {
    const cuentas = await db.cuentas.filter(c => c.activa === true).toArray()
    const cuentasConSaldo = await Promise.all(
      cuentas.map(async cuenta => ({
        ...cuenta,
        saldo_actual: await getSaldoCuenta(cuenta.id),
      }))
    )
    return cuentasConSaldo
  })
}

export async function crearCuenta(data: Omit<Cuenta, 'id'>) {
  return db.cuentas.add({ ...data, id: uuidv4() })
}

export async function actualizarCuenta(id: string, data: Partial<Cuenta>) {
  return db.cuentas.update(id, data)
}

export async function desactivarCuenta(id: string) {
  return db.cuentas.update(id, { activa: false })
}

export async function transferirEntreCuentas(
  cuentaOrigenId: string,
  cuentaDestinoId: string,
  monto: number,
  descripcion: string,
  fecha: string
) {
  const now = new Date().toISOString()
  await db.movimientos.bulkAdd([
    {
      id: uuidv4(),
      fecha,
      tipo: 'egreso',
      monto_ars: monto,
      descripcion: `Transferencia: ${descripcion}`,
      categoria_id: 'cat-bancarios',
      metodo_pago: 'transferencia',
      cuenta_id: cuentaOrigenId,
      created_at: now,
      updated_at: now,
    },
    {
      id: uuidv4(),
      fecha,
      tipo: 'ingreso',
      monto_ars: monto,
      descripcion: `Transferencia: ${descripcion}`,
      categoria_id: 'cat-bancarios',
      metodo_pago: 'transferencia',
      cuenta_id: cuentaDestinoId,
      created_at: now,
      updated_at: now,
    },
  ])
}
