import { supabaseAfip } from '@/db/schema'
import type { Cliente, Proveedor, Producto } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAuth } from '@/lib/auth'

type ContactoTabla = 'clientes' | 'proveedores'
type ContactoImport = Partial<Omit<Cliente, 'id' | 'empresa_id' | 'created_at' | 'updated_at'>>
type ProductoImport = Partial<Omit<Producto, 'id' | 'empresa_id' | 'created_at' | 'updated_at'>>

interface ListFilters {
  busqueda?: string
  soloActivos?: boolean
}

function matchesBusqueda(value: string | null | undefined, q: string): boolean {
  if (!value) return false
  return value.toLowerCase().includes(q)
}

// =========================================================================
// Clientes
// =========================================================================

export function useClientes(filtros?: ListFilters) {
  const { empresa } = useAuth()
  const empresaId = empresa?.id

  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as Cliente[]
      let query = supabaseAfip
        .from('clientes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('razon_social', { ascending: true })

      if (filtros?.soloActivos) query = query.eq('activo', true)

      const { data, error } = await query
      if (error) throw error
      const items = (data ?? []) as Cliente[]
      if (!filtros?.busqueda) return items
      const q = filtros.busqueda.toLowerCase()
      return items.filter(
        c =>
          matchesBusqueda(c.razon_social, q) ||
          matchesBusqueda(c.nombre_fantasia, q) ||
          matchesBusqueda(c.numero_documento, q) ||
          matchesBusqueda(c.email, q)
      )
    },
    [empresaId, filtros?.busqueda, filtros?.soloActivos],
    ['clientes']
  )
}

export async function crearCliente(empresaId: string, data: Partial<Cliente>) {
  const { error } = await supabaseAfip
    .from('clientes')
    .insert({ ...data, empresa_id: empresaId })
  if (error) throw error
  notifyDataChanged()
}

export async function importarClientes(empresaId: string, rows: ContactoImport[]) {
  if (rows.length === 0) return
  const { error } = await supabaseAfip
    .from('clientes')
    .insert(rows.map(row => ({ ...row, empresa_id: empresaId })))
  if (error) throw error
  notifyDataChanged()
}

export async function actualizarCliente(id: string, data: Partial<Cliente>) {
  const { error } = await supabaseAfip
    .from('clientes')
    .update(data)
    .eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function setClienteActivo(id: string, activo: boolean) {
  await actualizarCliente(id, { activo })
}

// =========================================================================
// Proveedores
// =========================================================================

export function useProveedores(filtros?: ListFilters) {
  const { empresa } = useAuth()
  const empresaId = empresa?.id

  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as Proveedor[]
      let query = supabaseAfip
        .from('proveedores')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('razon_social', { ascending: true })

      if (filtros?.soloActivos) query = query.eq('activo', true)

      const { data, error } = await query
      if (error) throw error
      const items = (data ?? []) as Proveedor[]
      if (!filtros?.busqueda) return items
      const q = filtros.busqueda.toLowerCase()
      return items.filter(
        p =>
          matchesBusqueda(p.razon_social, q) ||
          matchesBusqueda(p.nombre_fantasia, q) ||
          matchesBusqueda(p.numero_documento, q) ||
          matchesBusqueda(p.email, q)
      )
    },
    [empresaId, filtros?.busqueda, filtros?.soloActivos],
    ['proveedores']
  )
}

export async function crearProveedor(empresaId: string, data: Partial<Proveedor>) {
  const { error } = await supabaseAfip
    .from('proveedores')
    .insert({ ...data, empresa_id: empresaId })
  if (error) throw error
  notifyDataChanged()
}

export async function importarProveedores(empresaId: string, rows: ContactoImport[]) {
  if (rows.length === 0) return
  const { error } = await supabaseAfip
    .from('proveedores')
    .insert(rows.map(row => ({ ...row, empresa_id: empresaId })))
  if (error) throw error
  notifyDataChanged()
}

export async function actualizarProveedor(id: string, data: Partial<Proveedor>) {
  const { error } = await supabaseAfip
    .from('proveedores')
    .update(data)
    .eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function setProveedorActivo(id: string, activo: boolean) {
  await actualizarProveedor(id, { activo })
}

// =========================================================================
// Productos
// =========================================================================

export function useProductos(filtros?: ListFilters) {
  const { empresa } = useAuth()
  const empresaId = empresa?.id

  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as Producto[]
      let query = supabaseAfip
        .from('productos')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('nombre', { ascending: true })

      if (filtros?.soloActivos) query = query.eq('activo', true)

      const { data, error } = await query
      if (error) throw error
      const items = (data ?? []) as Producto[]
      if (!filtros?.busqueda) return items
      const q = filtros.busqueda.toLowerCase()
      return items.filter(
        p => matchesBusqueda(p.nombre, q) || matchesBusqueda(p.codigo, q)
      )
    },
    [empresaId, filtros?.busqueda, filtros?.soloActivos],
    ['productos']
  )
}

export async function crearProducto(empresaId: string, data: Partial<Producto>) {
  const { error } = await supabaseAfip
    .from('productos')
    .insert({ ...data, empresa_id: empresaId })
  if (error) throw error
  notifyDataChanged()
}

export async function importarProductos(empresaId: string, rows: ProductoImport[]) {
  if (rows.length === 0) return
  const { error } = await supabaseAfip
    .from('productos')
    .insert(rows.map(row => ({ ...row, empresa_id: empresaId })))
  if (error) throw error
  notifyDataChanged()
}

export async function actualizarProducto(id: string, data: Partial<Producto>) {
  const { error } = await supabaseAfip
    .from('productos')
    .update(data)
    .eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function setProductoActivo(id: string, activo: boolean) {
  await actualizarProducto(id, { activo })
}

// Util compartido por si se necesita en otro lado
export type { ContactoTabla, ContactoImport, ProductoImport }
