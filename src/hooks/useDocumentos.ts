import { supabaseAfip } from '@/db/schema'
import type {
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
  notifyDataChanged()
}

export async function eliminarDocumento(id: string): Promise<void> {
  // Borrar items primero (cascade tambien lo hace, pero por las dudas)
  await supabaseAfip.from('documento_items').delete().eq('documento_id', id)
  const { error } = await supabaseAfip.from('documentos').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}
