import { supabase } from '@/db/schema'
import type { EstadoPedidoCompra, EstadoPedidoVenta, MovimientoVinculo, PedidoCompra, PedidoVenta } from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { calcularEstadoCompra, calcularEstadoVenta } from '@/lib/vinculos'
import { v4 as uuidv4 } from 'uuid'

// ─── Filtros ─────────────────────────────────────────────────────────────────

export interface FiltrosPedidoCompra {
  estado?: EstadoPedidoCompra | ''
  proveedor?: string
  fechaDesde?: string
  fechaHasta?: string
}

export interface FiltrosPedidoVenta {
  estado?: EstadoPedidoVenta | ''
  cliente?: string
  fechaDesde?: string
  fechaHasta?: string
}

// ─── Pedidos de compra ────────────────────────────────────────────────────────

export function usePedidosCompra(filtros?: FiltrosPedidoCompra) {
  return useSupabaseQuery(async () => {
    let q = supabase
      .from('pedidos_compra')
      .select('*')
      .order('fecha', { ascending: false })

    if (filtros?.estado) q = q.eq('estado', filtros.estado)
    if (filtros?.fechaDesde) q = q.gte('fecha', filtros.fechaDesde)
    if (filtros?.fechaHasta) q = q.lte('fecha', filtros.fechaHasta)

    const { data, error } = await q
    if (error) throw error

    let items = data ?? []
    if (filtros?.proveedor) {
      const busq = filtros.proveedor.toLowerCase()
      items = items.filter(p =>
        p.proveedor.toLowerCase().includes(busq) ||
        p.numero.toLowerCase().includes(busq)
      )
    }
    return items
  }, [filtros?.estado, filtros?.proveedor, filtros?.fechaDesde, filtros?.fechaHasta], ['pedidos_compra'])
}

export function usePedidoCompraDetalle(id: string | null) {
  return useSupabaseQuery(async () => {
    if (!id) return null
    const [{ data: pedido }, { data: vinculos }] = await Promise.all([
      supabase.from('pedidos_compra').select('*').eq('id', id).maybeSingle(),
      supabase.from('movimiento_vinculos').select('*').eq('pedido_compra_id', id),
    ])
    if (!pedido) return null
    return { pedido, vinculos: vinculos ?? [] }
  }, [id], ['pedidos_compra', 'movimiento_vinculos'])
}

export async function crearPedidoCompra(data: Omit<PedidoCompra, 'id' | 'created_at'>): Promise<PedidoCompra> {
  const { data: created, error } = await supabase
    .from('pedidos_compra')
    .insert({ ...data, id: uuidv4(), created_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  notifyDataChanged()
  return created
}

export async function actualizarPedidoCompra(id: string, data: Partial<Omit<PedidoCompra, 'id' | 'created_at'>>) {
  const { error } = await supabase.from('pedidos_compra').update(data).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function eliminarPedidoCompra(id: string) {
  const { error } = await supabase.from('pedidos_compra').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

// ─── Pedidos de venta ─────────────────────────────────────────────────────────

export function usePedidosVenta(filtros?: FiltrosPedidoVenta) {
  return useSupabaseQuery(async () => {
    let q = supabase
      .from('pedidos_venta')
      .select('*')
      .order('fecha', { ascending: false })

    if (filtros?.estado) q = q.eq('estado', filtros.estado)
    if (filtros?.fechaDesde) q = q.gte('fecha', filtros.fechaDesde)
    if (filtros?.fechaHasta) q = q.lte('fecha', filtros.fechaHasta)

    const { data, error } = await q
    if (error) throw error

    let items = data ?? []
    if (filtros?.cliente) {
      const busq = filtros.cliente.toLowerCase()
      items = items.filter(p =>
        p.cliente.toLowerCase().includes(busq) ||
        p.numero.toLowerCase().includes(busq)
      )
    }
    return items
  }, [filtros?.estado, filtros?.cliente, filtros?.fechaDesde, filtros?.fechaHasta], ['pedidos_venta'])
}

export function usePedidoVentaDetalle(id: string | null) {
  return useSupabaseQuery(async () => {
    if (!id) return null
    const [{ data: pedido }, { data: vinculos }] = await Promise.all([
      supabase.from('pedidos_venta').select('*').eq('id', id).maybeSingle(),
      supabase.from('movimiento_vinculos').select('*').eq('pedido_venta_id', id),
    ])
    if (!pedido) return null
    return { pedido, vinculos: vinculos ?? [] }
  }, [id], ['pedidos_venta', 'movimiento_vinculos'])
}

export async function crearPedidoVenta(data: Omit<PedidoVenta, 'id' | 'created_at'>): Promise<PedidoVenta> {
  const { data: created, error } = await supabase
    .from('pedidos_venta')
    .insert({ ...data, id: uuidv4(), created_at: new Date().toISOString() })
    .select()
    .single()
  if (error) throw error
  notifyDataChanged()
  return created
}

export async function actualizarPedidoVenta(id: string, data: Partial<Omit<PedidoVenta, 'id' | 'created_at'>>) {
  const { error } = await supabase.from('pedidos_venta').update(data).eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function eliminarPedidoVenta(id: string) {
  const { error } = await supabase.from('pedidos_venta').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

// ─── Vínculos ─────────────────────────────────────────────────────────────────

export function useVinculos(movimientoId: string | null) {
  return useSupabaseQuery(async () => {
    if (!movimientoId) return []
    const { data, error } = await supabase
      .from('movimiento_vinculos')
      .select('*')
      .eq('movimiento_id', movimientoId)
    if (error) throw error
    return data ?? []
  }, [movimientoId], ['movimiento_vinculos'])
}

export function useVinculosConPedido(movimientoId: string | null) {
  return useSupabaseQuery(async () => {
    if (!movimientoId) return []
    const { data: vinculos, error } = await supabase
      .from('movimiento_vinculos')
      .select('*')
      .eq('movimiento_id', movimientoId)
    if (error) throw error
    if (!vinculos?.length) return []

    const compraIds = vinculos.filter(v => v.pedido_compra_id).map(v => v.pedido_compra_id!)
    const ventaIds = vinculos.filter(v => v.pedido_venta_id).map(v => v.pedido_venta_id!)

    const [compras, ventas] = await Promise.all([
      compraIds.length
        ? supabase.from('pedidos_compra').select('id,numero,proveedor,estado,monto_total').in('id', compraIds)
        : Promise.resolve({ data: [] }),
      ventaIds.length
        ? supabase.from('pedidos_venta').select('id,numero,cliente,estado,monto_total').in('id', ventaIds)
        : Promise.resolve({ data: [] }),
    ])

    return vinculos.map(v => ({
      ...v,
      pedido_compra: compras.data?.find(p => p.id === v.pedido_compra_id) ?? null,
      pedido_venta: ventas.data?.find(p => p.id === v.pedido_venta_id) ?? null,
    }))
  }, [movimientoId], ['movimiento_vinculos', 'pedidos_compra', 'pedidos_venta'])
}

export async function crearVinculo(data: Omit<MovimientoVinculo, 'id'>): Promise<MovimientoVinculo> {
  const { data: created, error } = await supabase
    .from('movimiento_vinculos')
    .insert({ ...data, id: uuidv4() })
    .select()
    .single()
  if (error) throw error
  await recalcularEstadoPedidoFromVinculo(created)
  notifyDataChanged()
  return created
}

export async function actualizarVinculo(id: string, data: Partial<Omit<MovimientoVinculo, 'id'>>) {
  const { data: updated, error } = await supabase
    .from('movimiento_vinculos')
    .update(data)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  await recalcularEstadoPedidoFromVinculo(updated)
  notifyDataChanged()
}

export async function eliminarVinculo(id: string) {
  const { data: vinculo } = await supabase
    .from('movimiento_vinculos')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  const { error } = await supabase.from('movimiento_vinculos').delete().eq('id', id)
  if (error) throw error

  if (vinculo) await recalcularEstadoPedidoFromVinculo(vinculo)
  notifyDataChanged()
}

export async function reemplazarVinculosMovimiento(
  movimientoId: string,
  nuevosVinculos: Omit<MovimientoVinculo, 'id' | 'movimiento_id'>[]
) {
  const { data: viejos } = await supabase
    .from('movimiento_vinculos')
    .select('*')
    .eq('movimiento_id', movimientoId)

  await supabase.from('movimiento_vinculos').delete().eq('movimiento_id', movimientoId)

  if (nuevosVinculos.length > 0) {
    const { error } = await supabase.from('movimiento_vinculos').insert(
      nuevosVinculos.map(v => ({ ...v, id: uuidv4(), movimiento_id: movimientoId }))
    )
    if (error) throw error
  }

  const pedidosAfectados = new Set<string>()
  ;(viejos ?? []).forEach(v => {
    if (v.pedido_compra_id) pedidosAfectados.add(`compra:${v.pedido_compra_id}`)
    if (v.pedido_venta_id) pedidosAfectados.add(`venta:${v.pedido_venta_id}`)
  })
  nuevosVinculos.forEach(v => {
    if (v.pedido_compra_id) pedidosAfectados.add(`compra:${v.pedido_compra_id}`)
    if (v.pedido_venta_id) pedidosAfectados.add(`venta:${v.pedido_venta_id}`)
  })

  await Promise.all([...pedidosAfectados].map(key => {
    const [tipo, id] = key.split(':')
    return recalcularEstadoPedido(id, tipo as 'compra' | 'venta')
  }))

  notifyDataChanged()
}

async function recalcularEstadoPedidoFromVinculo(vinculo: MovimientoVinculo) {
  if (vinculo.pedido_compra_id) {
    await recalcularEstadoPedido(vinculo.pedido_compra_id, 'compra')
  }
  if (vinculo.pedido_venta_id) {
    await recalcularEstadoPedido(vinculo.pedido_venta_id, 'venta')
  }
}

export async function recalcularEstadoPedido(id: string, tipo: 'compra' | 'venta') {
  const tabla = tipo === 'compra' ? 'pedidos_compra' : 'pedidos_venta'
  const fk = tipo === 'compra' ? 'pedido_compra_id' : 'pedido_venta_id'

  const [{ data: pedido }, { data: vinculos }] = await Promise.all([
    supabase.from(tabla).select('*').eq('id', id).maybeSingle(),
    supabase.from('movimiento_vinculos').select('monto_aplicado').eq(fk, id),
  ])

  if (!pedido || pedido.estado === 'cancelado') return

  const nuevoEstado = tipo === 'compra'
    ? calcularEstadoCompra(pedido as PedidoCompra, (vinculos ?? []) as MovimientoVinculo[])
    : calcularEstadoVenta(pedido as PedidoVenta, (vinculos ?? []) as MovimientoVinculo[])

  if (nuevoEstado !== pedido.estado) {
    await supabase.from(tabla).update({ estado: nuevoEstado }).eq('id', id)
  }
}

// ─── Queries para Dashboard ───────────────────────────────────────────────────

export async function getTopPedidosPendientes() {
  const [comprasRes, ventasRes, vinculosRes] = await Promise.all([
    supabase.from('pedidos_compra').select('*').neq('estado', 'cancelado').neq('estado', 'pagado_total'),
    supabase.from('pedidos_venta').select('*').neq('estado', 'cancelado').neq('estado', 'cobrado_total'),
    supabase.from('movimiento_vinculos').select('*'),
  ])

  const vinculos = vinculosRes.data ?? []

  const compras = (comprasRes.data ?? []).map(p => {
    const pvinculos = vinculos.filter(v => v.pedido_compra_id === p.id)
    const totalPagado = pvinculos.reduce((s, v) => s + v.monto_aplicado, 0)
    return { ...p, saldo_pendiente: Math.max(0, p.monto_total - totalPagado) }
  }).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente).slice(0, 5)

  const ventas = (ventasRes.data ?? []).map(p => {
    const pvinculos = vinculos.filter(v => v.pedido_venta_id === p.id)
    const totalCobrado = pvinculos.reduce((s, v) => s + v.monto_aplicado, 0)
    return { ...p, saldo_pendiente: Math.max(0, p.monto_total - totalCobrado) }
  }).sort((a, b) => b.saldo_pendiente - a.saldo_pendiente).slice(0, 5)

  return { compras, ventas }
}
