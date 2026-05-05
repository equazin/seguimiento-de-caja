import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '@/db/schema'
import type { Categoria } from '@/db/schema'
import { v4 as uuidv4 } from 'uuid'

export function useCategorias() {
  return useLiveQuery(() => db.categorias.toArray())
}

export function useCategoriasIngreso() {
  return useLiveQuery(() => db.categorias.where('tipo').equals('ingreso').toArray())
}

export function useCategoriasEgreso() {
  return useLiveQuery(() => db.categorias.where('tipo').equals('egreso').toArray())
}

export async function crearCategoria(data: Omit<Categoria, 'id'>) {
  return db.categorias.add({ ...data, id: uuidv4() })
}

export async function actualizarCategoria(id: string, data: Partial<Categoria>) {
  return db.categorias.update(id, data)
}

export async function eliminarCategoria(id: string) {
  return db.categorias.delete(id)
}
