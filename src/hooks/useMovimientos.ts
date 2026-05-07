import { supabase } from '@/db/schema'
import type { Movimiento } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
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
  return useSupabaseQuery(async () => {
    let query = supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })

    if (filtros?.fechaDesde) query = query.gte('fecha', filtros.fechaDesde)
    if (filtros?.fechaHasta) query = query.lte('fecha', filtros.fechaHasta)
    if (filtros?.tipo) query = query.eq('tipo', filtros.tipo)
    if (filtros?.categoriaId) query = query.eq('categoria_id', filtros.categoriaId)
    if (filtros?.cuentaId) query = query.eq('cuenta_id', filtros.cuentaId)
    if (filtros?.metodoPago) query = query.eq('metodo_pago', filtros.metodoPago as Movimiento['metodo_pago'])

    const { data, error } = await query
    if (error) throw error

    let items = data ?? []
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
  ], ['movimientos'])
}

export function useUltimosMovimientos(limite: number = 10) {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .order('fecha', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limite)
    if (error) throw error
    return data ?? []
  }, [limite], ['movimientos'])
}

export function useMovimiento(id: string | null) {
  return useSupabaseQuery(async () => {
    if (!id) return null
    const { data, error } = await supabase
      .from('movimientos')
      .select('*')
      .eq('id', id)
      .maybeSingle()
    if (error) throw error
    return data ?? null
  }, [id], ['movimientos'])
}

export async function crearMovimiento(data: Omit<Movimiento, 'id' | 'created_at' | 'updated_at'>): Promise<Movimiento> {
  const now = new Date().toISOString()
  const { data: created, error } = await supabase
    .from('movimientos')
    .insert({ ...data, id: uuidv4(), created_at: now, updated_at: now })
    .select()
    .single()
  if (error) throw error
  notifyDataChanged()
  return created
}

export async function actualizarMovimiento(id: string, data: Partial<Omit<Movimiento, 'id' | 'created_at' | 'updated_at'>>) {
  const { error } = await supabase
    .from('movimientos')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function eliminarMovimiento(id: string) {
  const { error } = await supabase.from('movimientos').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function eliminarMovimientosBulk(ids: string[]) {
  if (!ids.length) return
  const { error } = await supabase.from('movimientos').delete().in('id', ids)
  if (error) throw error
  notifyDataChanged()
}
