import { supabase } from '@/db/schema'
import type { Categoria } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { v4 as uuidv4 } from 'uuid'

export function useCategorias() {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .order('tipo', { ascending: false })
      .order('nombre')
    if (error) throw error
    return data ?? []
  }, [], ['categorias'])
}

export function useCategoriasIngreso() {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('tipo', 'ingreso')
      .order('nombre')
    if (error) throw error
    return data ?? []
  }, [], ['categorias'])
}

export function useCategoriasEgreso() {
  return useSupabaseQuery(async () => {
    const { data, error } = await supabase
      .from('categorias')
      .select('*')
      .eq('tipo', 'egreso')
      .order('nombre')
    if (error) throw error
    return data ?? []
  }, [], ['categorias'])
}

export async function crearCategoria(data: Omit<Categoria, 'id'>) {
  const { error } = await supabase.from('categorias').insert({ ...data, id: uuidv4() })
  if (error) throw error
  notifyDataChanged()
}

export async function actualizarCategoria(id: string, data: Partial<Omit<Categoria, 'id'>>) {
  const { error } = await supabase.from('categorias').update(data).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function eliminarCategoria(id: string) {
  const { error } = await supabase.from('categorias').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}
