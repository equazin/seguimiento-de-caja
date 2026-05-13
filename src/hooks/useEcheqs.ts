import { supabase } from '@/db/schema'
import type { Echeq, EchequEstado } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'

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

export async function eliminarEcheq(id: string): Promise<void> {
  const { error } = await supabase.from('echeqs').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}
