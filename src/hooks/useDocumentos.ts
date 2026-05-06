import { supabaseAfip } from '@/db/schema'
import type {
  ArcaComprobante,
  Documento,
  DocumentoItem,
  TipoOperacion,
  TipoDocumentoComercial,
  EstadoDocumento,
} from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAuth } from '@/lib/auth'
import {
  calcularTotales,
  itemFromCalculado,
  siguienteNumeroInterno,
  type ItemDraft,
} from '@/lib/documentos'

export interface DocumentoFiltros {
  tipoOperacion: TipoOperacion
  tipoDocumento?: TipoDocumentoComercial | ''
  estado?: EstadoDocumento | ''
  busqueda?: string
}

export function useDocumentos(filtros: DocumentoFiltros) {
  const { empresa } = useAuth()
  const empresaId = empresa?.id

  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as Documento[]
      let query = supabaseAfip
        .from('documentos')
        .select('*')
        .eq('empresa_id', empresaId)
        .eq('tipo_operacion', filtros.tipoOperacion)
        .order('fecha', { ascending: false })
        .order('created_at', { ascending: false })

      if (filtros.tipoDocumento) query = query.eq('tipo_documento', filtros.tipoDocumento)
      if (filtros.estado) query = query.eq('estado', filtros.estado)

      const { data, error } = await query
      if (error) throw error
      const items = (data ?? []) as Documento[]
      const q = filtros.busqueda?.trim().toLowerCase()
      if (!q) return items
      return items.filter(
        d =>
          d.numero_interno.toLowerCase().includes(q) ||
          d.observaciones?.toLowerCase().includes(q)
      )
    },
    [
      empresaId,
      filtros.tipoOperacion,
      filtros.tipoDocumento,
      filtros.estado,
      filtros.busqueda,
    ],
    ['documentos']
  )
}

export function useDocumentoItems(documentoId: string | null) {
  return useSupabaseQuery(
    async () => {
      if (!documentoId) return [] as DocumentoItem[]
      const { data, error } = await supabaseAfip
        .from('documento_items')
        .select('*')
        .eq('documento_id', documentoId)
        .order('orden', { ascending: true })
      if (error) throw error
      return (data ?? []) as DocumentoItem[]
    },
    [documentoId],
    ['documento_items']
  )
}

export function useArcaComprobantes() {
  const { empresa } = useAuth()
  const empresaId = empresa?.id

  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as ArcaComprobante[]
      const { data, error } = await supabaseAfip
        .from('arca_comprobantes')
        .select('*')
        .eq('empresa_id', empresaId)
      if (error) throw error
      return (data ?? []) as ArcaComprobante[]
    },
    [empresaId],
    ['arca_comprobantes']
  )
}

interface CrearDocumentoInput {
  empresaId: string
  tipoOperacion: TipoOperacion
  tipoDocumento: TipoDocumentoComercial
  clienteId: string | null
  proveedorId: string | null
  fecha: string
  fechaVencimiento: string | null
  moneda: 'ARS' | 'USD'
  tipoCambio: number
  observaciones: string | null
  estado: EstadoDocumento
  items: ItemDraft[]
}

export async function crearDocumento(input: CrearDocumentoInput): Promise<Documento> {
  const { items, totales } = calcularTotales(input.items)
  const numero = await siguienteNumeroInterno(
    input.empresaId,
    input.tipoOperacion,
    input.tipoDocumento
  )

  const insertResult = await supabaseAfip
    .from('documentos')
    .insert({
      empresa_id: input.empresaId,
      tipo_operacion: input.tipoOperacion,
      tipo_documento: input.tipoDocumento,
      estado: input.estado,
      numero_interno: numero,
      cliente_id: input.clienteId,
      proveedor_id: input.proveedorId,
      fecha: input.fecha,
      fecha_vencimiento: input.fechaVencimiento,
      moneda: input.moneda,
      tipo_cambio: input.tipoCambio,
      subtotal: totales.subtotal,
      iva_total: totales.iva_total,
      exento: totales.exento,
      no_gravado: totales.no_gravado,
      percepciones: totales.percepciones,
      total: totales.total,
      observaciones: input.observaciones,
    })
    .select('*')
    .single()
  if (insertResult.error) throw insertResult.error
  const documento = insertResult.data as Documento

  if (items.length > 0) {
    const itemsPayload = items.map((it, idx) => ({
      ...itemFromCalculado(it, idx),
      documento_id: documento.id,
    }))
    const { error: itemsError } = await supabaseAfip
      .from('documento_items')
      .insert(itemsPayload)
    if (itemsError) throw itemsError
  }

  await syncStockDocumento(documento.id)
  notifyDataChanged()
  return documento
}

interface ActualizarDocumentoInput {
  id: string
  clienteId: string | null
  proveedorId: string | null
  fecha: string
  fechaVencimiento: string | null
  moneda: 'ARS' | 'USD'
  tipoCambio: number
  observaciones: string | null
  estado: EstadoDocumento
  items: ItemDraft[]
}

export async function actualizarDocumento(input: ActualizarDocumentoInput): Promise<void> {
  const { items, totales } = calcularTotales(input.items)

  const { error: updateError } = await supabaseAfip
    .from('documentos')
    .update({
      cliente_id: input.clienteId,
      proveedor_id: input.proveedorId,
      fecha: input.fecha,
      fecha_vencimiento: input.fechaVencimiento,
      moneda: input.moneda,
      tipo_cambio: input.tipoCambio,
      subtotal: totales.subtotal,
      iva_total: totales.iva_total,
      exento: totales.exento,
      no_gravado: totales.no_gravado,
      percepciones: totales.percepciones,
      total: totales.total,
      observaciones: input.observaciones,
      estado: input.estado,
    })
    .eq('id', input.id)
  if (updateError) throw updateError

  // Reescribimos los items: borramos y volvemos a insertar para
  // mantenerlo simple. Documentos confirmados no deberian editarse.
  const { error: deleteError } = await supabaseAfip
    .from('documento_items')
    .delete()
    .eq('documento_id', input.id)
  if (deleteError) throw deleteError

  if (items.length > 0) {
    const itemsPayload = items.map((it, idx) => ({
      ...itemFromCalculado(it, idx),
      documento_id: input.id,
    }))
    const { error: itemsError } = await supabaseAfip
      .from('documento_items')
      .insert(itemsPayload)
    if (itemsError) throw itemsError
  }

  await syncStockDocumento(input.id)
  notifyDataChanged()
}

export async function cambiarEstadoDocumento(
  id: string,
  estado: EstadoDocumento
): Promise<void> {
  const { error } = await supabaseAfip
    .from('documentos')
    .update({ estado })
    .eq('id', id)
  if (error) throw error
  await syncStockDocumento(id)
  notifyDataChanged()
}

export async function eliminarDocumento(id: string): Promise<void> {
  await eliminarStockDocumento(id)
  // Borrar items primero (cascade tambien lo hace, pero por las dudas)
  await supabaseAfip.from('documento_items').delete().eq('documento_id', id)
  const { error } = await supabaseAfip.from('documentos').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export async function emitirDocumentoArca(id: string): Promise<unknown> {
  const { data, error } = await supabaseAfip.functions.invoke('arca', {
    body: { action: 'emitir', documentoId: id },
  })
  if (error) throw error
  const result = data as {
    resultado?: string
    errores?: Array<{ code?: number; msg?: string }>
    observaciones?: Array<{ code?: number; msg?: string }>
  } | null
  if (result?.resultado && result.resultado !== 'A') {
    const detalles = [...(result.errores ?? []), ...(result.observaciones ?? [])]
      .map(item => `${item.code ?? ''} ${item.msg ?? ''}`.trim())
      .filter(Boolean)
      .join('; ')
    throw new Error(detalles || `ARCA devolvió resultado ${result.resultado}`)
  }
  notifyDataChanged()
  return data
}

function mueveStock(documento: Documento): boolean {
  if (!['factura', 'remito'].includes(documento.tipo_documento)) return false
  return ['confirmado', 'emitido'].includes(documento.estado)
}

async function eliminarStockDocumento(documentoId: string): Promise<Map<string, number>> {
  const { data: existentes, error: selectError } = await supabaseAfip
    .from('stock_movimientos')
    .select('producto_id,tipo,cantidad')
    .eq('documento_id', documentoId)
  if (selectError) throw selectError

  const deltas = new Map<string, number>()
  for (const mov of (existentes ?? []) as Array<{ producto_id: string; tipo: string; cantidad: number }>) {
    const signo = mov.tipo === 'ingreso' ? -1 : mov.tipo === 'egreso' ? 1 : -1
    deltas.set(mov.producto_id, (deltas.get(mov.producto_id) ?? 0) + signo * Number(mov.cantidad))
  }

  const { error } = await supabaseAfip
    .from('stock_movimientos')
    .delete()
    .eq('documento_id', documentoId)
  if (error) throw error

  return deltas
}

async function syncStockDocumento(documentoId: string): Promise<void> {
  const { data: docData, error: docError } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single()
  if (docError) throw docError
  const documento = docData as Documento

  const deltas = await eliminarStockDocumento(documentoId)
  if (!mueveStock(documento)) {
    await ajustarStockProductos(deltas)
    return
  }

  const { data: itemsData, error: itemsError } = await supabaseAfip
    .from('documento_items')
    .select('producto_id,cantidad')
    .eq('documento_id', documentoId)
    .not('producto_id', 'is', null)
  if (itemsError) throw itemsError

  const items = (itemsData ?? []) as Array<{ producto_id: string | null; cantidad: number }>
  const productoIds = [...new Set(items.map(it => it.producto_id).filter(Boolean) as string[])]
  if (productoIds.length === 0) {
    await ajustarStockProductos(deltas)
    return
  }

  const { data: productosData, error: productosError } = await supabaseAfip
    .from('productos')
    .select('id,stockeable')
    .in('id', productoIds)
  if (productosError) throw productosError

  const stockeables = new Set(
    ((productosData ?? []) as Array<{ id: string; stockeable: boolean }>)
      .filter(p => p.stockeable)
      .map(p => p.id)
  )

  const tipo = documento.tipo_operacion === 'venta' ? 'egreso' : 'ingreso'
  const movimientos = items
    .filter(it => it.producto_id && stockeables.has(it.producto_id))
    .map(it => {
      const signo = tipo === 'ingreso' ? 1 : -1
      const productoId = it.producto_id as string
      deltas.set(productoId, (deltas.get(productoId) ?? 0) + signo * Number(it.cantidad))
      return {
        empresa_id: documento.empresa_id,
        producto_id: productoId,
        documento_id: documento.id,
        tipo,
        cantidad: Number(it.cantidad),
        motivo: `${documento.tipo_operacion} ${documento.tipo_documento} ${documento.numero_interno}`,
      }
    })

  if (movimientos.length > 0) {
    const { error } = await supabaseAfip.from('stock_movimientos').insert(movimientos)
    if (error) throw error
  }

  await ajustarStockProductos(deltas)
}

async function ajustarStockProductos(deltas: Map<string, number>): Promise<void> {
  const ids = [...deltas.keys()].filter(productoId => (deltas.get(productoId) ?? 0) !== 0)
  await Promise.all(
    ids.map(async productoId => {
      const { data, error } = await supabaseAfip
        .from('productos')
        .select('stock_actual')
        .eq('id', productoId)
        .single()
      if (error) throw error

      const stockActual = Number((data as { stock_actual: number }).stock_actual)
      const stock = stockActual + (deltas.get(productoId) ?? 0)

      const { error: updateError } = await supabaseAfip
        .from('productos')
        .update({ stock_actual: stock })
        .eq('id', productoId)
      if (updateError) throw updateError
    })
  )
}
