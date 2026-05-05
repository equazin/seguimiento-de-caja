import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Movimiento } from '@/db/schema'
import { v4 as uuidv4 } from 'uuid'

export interface MovimientoFiltros {
  fechaDesde?: string
  fechaHasta?: string
  tipo?: 'ingreso' | 'egreso' | ''
  categoriaId?: string
  cuentaId?: string
  metodoPago?: string
  contacto?: string
}

export function useMovimientos(filtros?: MovimientoFiltros) {
  return useLiveQuery(async () => {
    let query = db.movimientos.orderBy('fecha').reverse()
    let items = await query.toArray()

    if (filtros?.fechaDesde) {
      items = items.filter(m => m.fecha >= filtros.fechaDesde!)
    }
    if (filtros?.fechaHasta) {
      items = items.filter(m => m.fecha <= filtros.fechaHasta!)
    }
    if (filtros?.tipo) {
      items = items.filter(m => m.tipo === filtros.tipo)
    }
    if (filtros?.categoriaId) {
      items = items.filter(m => m.categoria_id === filtros.categoriaId)
    }
    if (filtros?.cuentaId) {
      items = items.filter(m => m.cuenta_id === filtros.cuentaId)
    }
    if (filtros?.metodoPago) {
      items = items.filter(m => m.metodo_pago === filtros.metodoPago)
    }
    if (filtros?.contacto) {
      const busq = filtros.contacto.toLowerCase()
      items = items.filter(m =>
        m.contacto?.toLowerCase().includes(busq) ||
        m.descripcion.toLowerCase().includes(busq)
      )
    }

    return items
  }, [
    filtros?.fechaDesde, filtros?.fechaHasta, filtros?.tipo,
    filtros?.categoriaId, filtros?.cuentaId, filtros?.metodoPago, filtros?.contacto,
  ])
}

export function useUltimosMovimientos(limite: number = 10) {
  return useLiveQuery(() =>
    db.movimientos.orderBy('fecha').reverse().limit(limite).toArray()
  )
}

export async function crearMovimiento(data: Omit<Movimiento, 'id' | 'created_at' | 'updated_at'>) {
  const now = new Date().toISOString()
  return db.movimientos.add({ ...data, id: uuidv4(), created_at: now, updated_at: now })
}

export async function actualizarMovimiento(id: string, data: Partial<Movimiento>) {
  return db.movimientos.update(id, { ...data, updated_at: new Date().toISOString() })
}

export async function eliminarMovimiento(id: string) {
  return db.movimientos.delete(id)
}

export async function eliminarMovimientosBulk(ids: string[]) {
  return db.movimientos.bulkDelete(ids)
}
