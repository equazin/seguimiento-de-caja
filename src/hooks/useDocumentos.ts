import { supabase, supabaseAfip } from '@/db/schema'
import type {
  ArcaComprobante,
  Documento,
  DocumentoItem,
  DocumentoRelacion,
  MetodoPago,
  TipoOperacion,
  TipoDocumentoComercial,
  EstadoDocumento,
  TipoMovimiento,
} from '@/db/schema'
import { notifyDataChanged, useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAuth } from '@/lib/auth'
import {
  aplicarMargenPresupuesto,
  calcularTotales,
  itemFromCalculado,
  siguienteNumeroInterno,
  type ItemDraft,
} from '@/lib/documentos'
import { todayStr } from '@/lib/formatters'
import { v4 as uuidv4 } from 'uuid'

const TIPOS_NOTA = new Set<TipoDocumentoComercial>(['nota_credito', 'nota_debito'])
const ESTADOS_CONTABLES = new Set<EstadoDocumento>(['confirmado', 'emitido'])

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

export function useDocumento(documentoId: string | null) {
  return useSupabaseQuery(
    async () => {
      if (!documentoId) return null
      const { data, error } = await supabaseAfip
        .from('documentos')
        .select('*')
        .eq('id', documentoId)
        .maybeSingle()
      if (error) throw error
      return (data ?? null) as Documento | null
    },
    [documentoId],
    ['documentos']
  )
}

export interface DocumentoRelacionConDocumento extends DocumentoRelacion {
  direccion: 'origen' | 'destino'
  relacionado: Documento | null
}

export function useDocumentoRelaciones(documentoId: string | null) {
  return useSupabaseQuery(
    async () => {
      if (!documentoId) return [] as DocumentoRelacionConDocumento[]
      const { data: relacionesData, error: relacionesError } = await supabaseAfip
        .from('documento_relaciones')
        .select('*')
        .or(`origen_id.eq.${documentoId},destino_id.eq.${documentoId}`)
        .order('created_at', { ascending: false })
      if (relacionesError) throw relacionesError

      const relaciones = (relacionesData ?? []) as DocumentoRelacion[]
      const ids = [...new Set(relaciones.map(r => r.origen_id === documentoId ? r.destino_id : r.origen_id))]
      if (ids.length === 0) return []

      const { data: documentosData, error: documentosError } = await supabaseAfip
        .from('documentos')
        .select('*')
        .in('id', ids)
      if (documentosError) throw documentosError

      const documentosMap = new Map(((documentosData ?? []) as Documento[]).map(d => [d.id, d]))
      return relaciones.map(relacion => {
        const direccion = relacion.origen_id === documentoId ? 'destino' : 'origen'
        const relacionadoId = direccion === 'destino' ? relacion.destino_id : relacion.origen_id
        return {
          ...relacion,
          direccion,
          relacionado: documentosMap.get(relacionadoId) ?? null,
        } satisfies DocumentoRelacionConDocumento
      })
    },
    [documentoId],
    ['documento_relaciones', 'documentos']
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
  cuentaId: string | null
  metodoPago: MetodoPago
  estado: EstadoDocumento
  items: ItemDraft[]
  origenDocumentoId?: string | null
  margenPorcentaje?: number | null
}

export async function crearDocumento(input: CrearDocumentoInput): Promise<Documento> {
  if (TIPOS_NOTA.has(input.tipoDocumento)) {
    throw new Error('Las notas se crean desde una factura')
  }

  const { items, totales: totalesBase } = calcularTotales(input.items, {
    monedaInput: input.moneda,
    tipoCambio: input.tipoCambio,
  })
  const totales = aplicarMargenPresupuesto(
    totalesBase,
    input.tipoDocumento,
    input.margenPorcentaje
  )
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
      subtotal_usd: totales.subtotal_usd,
      iva_total_usd: totales.iva_total_usd,
      exento_usd: totales.exento_usd,
      no_gravado_usd: totales.no_gravado_usd,
      percepciones_usd: totales.percepciones_usd,
      total_usd: totales.total_usd,
      observaciones: input.observaciones,
      cuenta_id: input.cuentaId,
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

  if (input.origenDocumentoId) {
    const { error: relacionError } = await supabaseAfip
      .from('documento_relaciones')
      .insert({
        origen_id: input.origenDocumentoId,
        destino_id: documento.id,
        tipo_relacion: 'origen',
      })
    if (relacionError) throw relacionError
  }

  await syncStockDocumento(documento.id)
  await syncCajaDocumento(documento.id, input.metodoPago)
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
  cuentaId: string | null
  metodoPago: MetodoPago
  estado: EstadoDocumento
  items: ItemDraft[]
  origenDocumentoId?: string | null
  margenPorcentaje?: number | null
}

export async function actualizarDocumento(input: ActualizarDocumentoInput): Promise<void> {
  const { items, totales: totalesBase } = calcularTotales(input.items, {
    monedaInput: input.moneda,
    tipoCambio: input.tipoCambio,
  })
  const actual = await getDocumentoById(input.id)
  const totales = aplicarMargenPresupuesto(
    totalesBase,
    actual.tipo_documento,
    input.margenPorcentaje
  )
  const documentoValidado: Documento = {
    ...actual,
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
    subtotal_usd: totales.subtotal_usd,
    iva_total_usd: totales.iva_total_usd,
    exento_usd: totales.exento_usd,
    no_gravado_usd: totales.no_gravado_usd,
    percepciones_usd: totales.percepciones_usd,
    total_usd: totales.total_usd,
    observaciones: input.observaciones,
    cuenta_id: input.cuentaId,
    estado: input.estado,
  }
  await validarNotaInterna(documentoValidado)

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
      subtotal_usd: totales.subtotal_usd,
      iva_total_usd: totales.iva_total_usd,
      exento_usd: totales.exento_usd,
      no_gravado_usd: totales.no_gravado_usd,
      percepciones_usd: totales.percepciones_usd,
      total_usd: totales.total_usd,
      observaciones: input.observaciones,
      cuenta_id: input.cuentaId,
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
  await syncCajaDocumento(input.id, input.metodoPago)
  notifyDataChanged()
}

export async function cambiarEstadoDocumento(
  id: string,
  estado: EstadoDocumento
): Promise<void> {
  const documento = await getDocumentoById(id)
  await validarNotaInterna({ ...documento, estado })

  const { error } = await supabaseAfip
    .from('documentos')
    .update({ estado })
    .eq('id', id)
  if (error) throw error
  await syncStockDocumento(id)
  await syncCajaDocumento(id)
  notifyDataChanged()
}

export async function eliminarDocumento(id: string): Promise<void> {
  await eliminarStockDocumento(id)
  await eliminarCajaDocumento(id)
  // Borrar items primero (cascade tambien lo hace, pero por las dudas)
  await supabaseAfip.from('documento_items').delete().eq('documento_id', id)
  const { error } = await supabaseAfip.from('documentos').delete().eq('id', id)
  if (error) throw error
  notifyDataChanged()
}

export function siguienteTipoConvertible(
  tipoDocumento: TipoDocumentoComercial
): TipoDocumentoComercial | null {
  if (tipoDocumento === 'presupuesto') return 'pedido'
  if (tipoDocumento === 'pedido') return 'factura'
  if (tipoDocumento === 'factura') return 'remito'
  return null
}

export function puedeConvertirDocumento(documento: Documento): boolean {
  return !!siguienteTipoConvertible(documento.tipo_documento)
    && !['borrador', 'anulado'].includes(documento.estado)
}

export async function convertirDocumento(id: string): Promise<Documento> {
  const { data: docData, error: docError } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', id)
    .single()
  if (docError) throw docError

  const origen = docData as Documento
  if (!puedeConvertirDocumento(origen)) {
    throw new Error('Este documento no se puede convertir')
  }

  const destinoTipo = siguienteTipoConvertible(origen.tipo_documento)
  if (!destinoTipo) throw new Error('No hay un documento destino disponible')

  const { data: itemsData, error: itemsError } = await supabaseAfip
    .from('documento_items')
    .select('*')
    .eq('documento_id', origen.id)
    .order('orden', { ascending: true })
  if (itemsError) throw itemsError

  const items = (itemsData ?? []) as DocumentoItem[]
  if (items.length === 0) {
    throw new Error('No se puede convertir un documento sin items')
  }

  const numero = await siguienteNumeroInterno(
    origen.empresa_id,
    origen.tipo_operacion,
    destinoTipo
  )
  const observaciones = [
    `Generado desde ${origen.numero_interno}.`,
    origen.observaciones,
  ].filter(Boolean).join('\n')

  const insertResult = await supabaseAfip
    .from('documentos')
    .insert({
      empresa_id: origen.empresa_id,
      tipo_operacion: origen.tipo_operacion,
      tipo_documento: destinoTipo,
      estado: 'borrador',
      numero_interno: numero,
      punto_venta_id: origen.punto_venta_id,
      cliente_id: origen.cliente_id,
      proveedor_id: origen.proveedor_id,
      fecha: todayStr(),
      fecha_vencimiento: origen.fecha_vencimiento,
      moneda: origen.moneda,
      tipo_cambio: origen.tipo_cambio,
      subtotal: origen.subtotal,
      iva_total: origen.iva_total,
      exento: origen.exento,
      no_gravado: origen.no_gravado,
      percepciones: origen.percepciones,
      total: origen.total,
      subtotal_usd: origen.subtotal_usd,
      iva_total_usd: origen.iva_total_usd,
      exento_usd: origen.exento_usd,
      no_gravado_usd: origen.no_gravado_usd,
      percepciones_usd: origen.percepciones_usd,
      total_usd: origen.total_usd,
      observaciones,
      cuenta_id: null,
      movimiento_id: null,
    })
    .select('*')
    .single()
  if (insertResult.error) throw insertResult.error

  const destino = insertResult.data as Documento
  const itemsPayload = items.map(it => ({
    documento_id: destino.id,
    producto_id: it.producto_id,
    orden: it.orden,
    codigo: it.codigo,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    unidad_medida: it.unidad_medida,
    precio_unitario: it.precio_unitario,
    bonificacion: it.bonificacion,
    alicuota_iva: it.alicuota_iva,
    iva_importe: it.iva_importe,
    subtotal: it.subtotal,
    total: it.total,
    precio_unitario_usd: it.precio_unitario_usd,
    iva_importe_usd: it.iva_importe_usd,
    subtotal_usd: it.subtotal_usd,
    total_usd: it.total_usd,
  }))
  const { error: insertItemsError } = await supabaseAfip
    .from('documento_items')
    .insert(itemsPayload)
  if (insertItemsError) throw insertItemsError

  const { error: relacionError } = await supabaseAfip
    .from('documento_relaciones')
    .insert({
      origen_id: origen.id,
      destino_id: destino.id,
      tipo_relacion: 'origen',
    })
  if (relacionError) throw relacionError

  const nuevoEstado = estadoOrigenDespuesDeConversion(destinoTipo)
  if (nuevoEstado) {
    const { error: estadoError } = await supabaseAfip
      .from('documentos')
      .update({ estado: nuevoEstado })
      .eq('id', origen.id)
    if (estadoError) throw estadoError
    await syncStockDocumento(origen.id)
    await syncCajaDocumento(origen.id)
  }

  notifyDataChanged()
  return destino
}

export async function crearNotaDesdeDocumento(
  origenId: string,
  tipoNota: 'nota_credito' | 'nota_debito'
): Promise<Documento> {
  const { data: docData, error: docError } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', origenId)
    .single()
  if (docError) throw docError

  const origen = docData as Documento
  if (origen.tipo_documento !== 'factura') {
    throw new Error('Las notas se generan desde una factura')
  }
  if (origen.estado === 'borrador' || origen.estado === 'anulado') {
    throw new Error('La factura debe estar confirmada o emitida')
  }
  if (tipoNota === 'nota_credito') {
    const saldo = await calcularSaldoPendienteFactura(origen.id)
    if (saldo <= 0) {
      throw new Error('La factura no tiene saldo pendiente para una nota de credito')
    }
  }

  const { data: itemsData, error: itemsError } = await supabaseAfip
    .from('documento_items')
    .select('*')
    .eq('documento_id', origen.id)
    .order('orden', { ascending: true })
  if (itemsError) throw itemsError

  const items = (itemsData ?? []) as DocumentoItem[]
  if (items.length === 0) {
    throw new Error('No se puede crear una nota sin items')
  }

  const numero = await siguienteNumeroInterno(
    origen.empresa_id,
    origen.tipo_operacion,
    tipoNota
  )
  const label = tipoNota === 'nota_credito' ? 'Nota de credito' : 'Nota de debito'
  const observaciones = [
    `${label} generada desde ${origen.numero_interno}.`,
    origen.observaciones,
  ].filter(Boolean).join('\n')

  const insertResult = await supabaseAfip
    .from('documentos')
    .insert({
      empresa_id: origen.empresa_id,
      tipo_operacion: origen.tipo_operacion,
      tipo_documento: tipoNota,
      estado: 'borrador',
      numero_interno: numero,
      punto_venta_id: origen.punto_venta_id,
      cliente_id: origen.cliente_id,
      proveedor_id: origen.proveedor_id,
      fecha: todayStr(),
      fecha_vencimiento: origen.fecha_vencimiento,
      moneda: origen.moneda,
      tipo_cambio: origen.tipo_cambio,
      subtotal: origen.subtotal,
      iva_total: origen.iva_total,
      exento: origen.exento,
      no_gravado: origen.no_gravado,
      percepciones: origen.percepciones,
      total: origen.total,
      observaciones,
      cuenta_id: null,
      movimiento_id: null,
    })
    .select('*')
    .single()
  if (insertResult.error) throw insertResult.error

  const nota = insertResult.data as Documento
  const itemsPayload = items.map(it => ({
    documento_id: nota.id,
    producto_id: it.producto_id,
    orden: it.orden,
    codigo: it.codigo,
    descripcion: it.descripcion,
    cantidad: it.cantidad,
    unidad_medida: it.unidad_medida,
    precio_unitario: it.precio_unitario,
    bonificacion: it.bonificacion,
    alicuota_iva: it.alicuota_iva,
    iva_importe: it.iva_importe,
    subtotal: it.subtotal,
    total: it.total,
  }))
  const { error: insertItemsError } = await supabaseAfip
    .from('documento_items')
    .insert(itemsPayload)
  if (insertItemsError) throw insertItemsError

  const { error: relacionError } = await supabaseAfip
    .from('documento_relaciones')
    .insert({
      origen_id: origen.id,
      destino_id: nota.id,
      tipo_relacion: tipoNota === 'nota_credito' ? 'anulacion' : 'ajuste',
    })
  if (relacionError) throw relacionError

  notifyDataChanged()
  return nota
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

async function getDocumentoById(id: string): Promise<Documento> {
  const { data, error } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data as Documento
}

async function validarNotaInterna(documento: Documento): Promise<void> {
  if (!TIPOS_NOTA.has(documento.tipo_documento)) return

  const relacion = await getRelacionFacturaOrigen(documento.id)
  if (!relacion) {
    throw new Error('La nota debe estar vinculada a una factura origen')
  }

  if (documento.tipo_documento === 'nota_credito' && relacion.tipo_relacion !== 'anulacion') {
    throw new Error('La nota de credito debe estar relacionada como anulacion')
  }
  if (documento.tipo_documento === 'nota_debito' && relacion.tipo_relacion !== 'ajuste') {
    throw new Error('La nota de debito debe estar relacionada como ajuste')
  }

  const origen = await getDocumentoById(relacion.origen_id)
  if (origen.tipo_documento !== 'factura') {
    throw new Error('La nota debe tener una factura como origen')
  }
  if (origen.estado === 'borrador' || origen.estado === 'anulado') {
    throw new Error('La factura origen debe estar confirmada o emitida')
  }
  if (origen.empresa_id !== documento.empresa_id || origen.tipo_operacion !== documento.tipo_operacion) {
    throw new Error('La nota debe pertenecer a la misma empresa y operacion que la factura origen')
  }
  if (origen.moneda !== documento.moneda) {
    throw new Error('La nota debe mantener la misma moneda que la factura origen')
  }
  if (origen.cliente_id !== documento.cliente_id || origen.proveedor_id !== documento.proveedor_id) {
    throw new Error('La nota debe mantener el mismo cliente o proveedor que la factura origen')
  }
  if (Number(documento.total) <= 0) {
    throw new Error('La nota necesita un total mayor a cero')
  }

  if (documento.tipo_documento === 'nota_credito' && ESTADOS_CONTABLES.has(documento.estado)) {
    const saldo = await calcularSaldoPendienteFactura(origen.id, documento.id)
    if (Number(documento.total) - saldo > 0.005) {
      throw new Error(
        `La nota de credito supera el saldo pendiente de la factura (${formatSaldo(saldo)} ${origen.moneda})`
      )
    }
  }
}

async function getRelacionFacturaOrigen(
  notaId: string
): Promise<DocumentoRelacion | null> {
  const { data, error } = await supabaseAfip
    .from('documento_relaciones')
    .select('*')
    .eq('destino_id', notaId)
    .in('tipo_relacion', ['anulacion', 'ajuste'])
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return (data ?? null) as DocumentoRelacion | null
}

async function calcularSaldoPendienteFactura(
  facturaId: string,
  excluirDocumentoId?: string
): Promise<number> {
  const factura = await getDocumentoById(facturaId)
  const { data: relacionesData, error: relacionesError } = await supabaseAfip
    .from('documento_relaciones')
    .select('destino_id')
    .eq('origen_id', facturaId)
    .in('tipo_relacion', ['anulacion', 'ajuste'])
  if (relacionesError) throw relacionesError

  const destinoIds = ((relacionesData ?? []) as Array<{ destino_id: string }>)
    .map(relacion => relacion.destino_id)
    .filter(id => id !== excluirDocumentoId)
  if (destinoIds.length === 0) return roundMoney(Number(factura.total))

  const { data: notasData, error: notasError } = await supabaseAfip
    .from('documentos')
    .select('id,tipo_documento,estado,total')
    .in('id', destinoIds)
  if (notasError) throw notasError

  return roundMoney(
    ((notasData ?? []) as Array<Pick<Documento, 'tipo_documento' | 'estado' | 'total'>>)
      .filter(nota => ESTADOS_CONTABLES.has(nota.estado))
      .reduce((saldo, nota) => {
        if (nota.tipo_documento === 'nota_credito') return saldo - Number(nota.total)
        if (nota.tipo_documento === 'nota_debito') return saldo + Number(nota.total)
        return saldo
      }, Number(factura.total))
  )
}

function formatSaldo(value: number): string {
  return roundMoney(Math.max(0, value)).toFixed(2)
}

function mueveStock(documento: Documento): boolean {
  if (!['factura', 'remito', 'nota_credito'].includes(documento.tipo_documento)) return false
  return ['confirmado', 'emitido'].includes(documento.estado)
}

function tipoStockDocumento(documento: Documento): 'ingreso' | 'egreso' {
  if (documento.tipo_documento === 'nota_credito') {
    return documento.tipo_operacion === 'venta' ? 'ingreso' : 'egreso'
  }
  return documento.tipo_operacion === 'venta' ? 'egreso' : 'ingreso'
}

function estadoOrigenDespuesDeConversion(
  destinoTipo: TipoDocumentoComercial
): EstadoDocumento | null {
  if (destinoTipo === 'remito') return 'remitido'
  if (destinoTipo === 'factura') return 'facturado'
  return null
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

  const tipo = tipoStockDocumento(documento)
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

function mueveCaja(documento: Documento): boolean {
  return ['factura', 'nota_credito', 'nota_debito'].includes(documento.tipo_documento)
    && ['confirmado', 'emitido'].includes(documento.estado)
    && !!documento.cuenta_id
}

function tipoCajaDocumento(documento: Documento): TipoMovimiento {
  if (documento.tipo_documento === 'nota_credito') {
    return documento.tipo_operacion === 'venta' ? 'egreso' : 'ingreso'
  }
  return documento.tipo_operacion === 'venta' ? 'ingreso' : 'egreso'
}

function accionCajaDocumento(documento: Documento): string {
  if (documento.tipo_documento === 'nota_credito') {
    return documento.tipo_operacion === 'venta' ? 'Devolucion' : 'Credito'
  }
  if (documento.tipo_documento === 'nota_debito') {
    return documento.tipo_operacion === 'venta' ? 'Cobro adicional' : 'Pago adicional'
  }
  return documento.tipo_operacion === 'venta' ? 'Cobro' : 'Pago'
}

async function eliminarCajaDocumento(documentoId: string): Promise<void> {
  const { data, error } = await supabaseAfip
    .from('documentos')
    .select('movimiento_id')
    .eq('id', documentoId)
    .maybeSingle()
  if (error) throw error

  const movimientoId = (data as { movimiento_id: string | null } | null)?.movimiento_id
  if (!movimientoId) return

  const { error: deleteError } = await supabase
    .from('movimientos')
    .delete()
    .eq('id', movimientoId)
  if (deleteError) throw deleteError
}

async function syncCajaDocumento(
  documentoId: string,
  metodoPago: MetodoPago = 'transferencia'
): Promise<void> {
  const { data: docData, error: docError } = await supabaseAfip
    .from('documentos')
    .select('*')
    .eq('id', documentoId)
    .single()
  if (docError) throw docError

  const documento = docData as Documento
  if (!mueveCaja(documento)) {
    if (documento.movimiento_id) {
      await eliminarCajaDocumento(documento.id)
      const { error } = await supabaseAfip
        .from('documentos')
        .update({ movimiento_id: null })
        .eq('id', documento.id)
      if (error) throw error
    }
    return
  }

  const tipoMovimiento = tipoCajaDocumento(documento)
  const categoriaId = await getCategoriaCajaId(tipoMovimiento)
  const contacto = await getContactoDocumento(documento)
  const montoArs = documento.moneda === 'USD'
    ? roundMoney(Number(documento.total) * Number(documento.tipo_cambio || 1))
    : roundMoney(Number(documento.total))
  const montoUsd = documento.moneda === 'USD' ? roundMoney(Number(documento.total)) : null
  const descripcion = `${accionCajaDocumento(documento)} ${documento.tipo_documento} ${documento.numero_interno}`
  const movimientoPayload = {
    fecha: documento.fecha,
    tipo: tipoMovimiento,
    monto_ars: montoArs,
    monto_usd: montoUsd,
    tipo_cambio: documento.moneda === 'USD' ? Number(documento.tipo_cambio || 1) : null,
    categoria_id: categoriaId,
    subcategoria: 'Documentos',
    descripcion,
    contacto,
    metodo_pago: metodoPago,
    cuenta_id: documento.cuenta_id as string,
    notas: documento.observaciones,
  }

  if (documento.movimiento_id) {
    const { error } = await supabase
      .from('movimientos')
      .update({ ...movimientoPayload, updated_at: new Date().toISOString() })
      .eq('id', documento.movimiento_id)
    if (error) throw error
    return
  }

  const now = new Date().toISOString()
  const movimientoId = uuidv4()
  const { error: insertError } = await supabase
    .from('movimientos')
    .insert({
      id: movimientoId,
      ...movimientoPayload,
      created_at: now,
      updated_at: now,
    })
  if (insertError) throw insertError

  const { error: updateDocError } = await supabaseAfip
    .from('documentos')
    .update({ movimiento_id: movimientoId })
    .eq('id', documento.id)
  if (updateDocError) throw updateDocError
}

async function getCategoriaCajaId(tipo: TipoMovimiento): Promise<string> {
  const preferida = tipo === 'ingreso' ? 'cat-venta-equipos' : 'cat-mercaderia'
  const { data: categoriaPreferida, error: preferredError } = await supabase
    .from('categorias')
    .select('id')
    .eq('id', preferida)
    .maybeSingle()
  if (preferredError) throw preferredError
  if (categoriaPreferida?.id) return categoriaPreferida.id

  const { data, error } = await supabase
    .from('categorias')
    .select('id')
    .eq('tipo', tipo)
    .order('nombre')
    .limit(1)
    .maybeSingle()
  if (error) throw error
  if (!data?.id) throw new Error('No hay categoria de caja para registrar el movimiento')
  return data.id
}

async function getContactoDocumento(documento: Documento): Promise<string | null> {
  if (documento.tipo_operacion === 'venta' && documento.cliente_id) {
    const { data, error } = await supabaseAfip
      .from('clientes')
      .select('razon_social')
      .eq('id', documento.cliente_id)
      .maybeSingle()
    if (error) throw error
    return (data as { razon_social: string } | null)?.razon_social ?? null
  }
  if (documento.tipo_operacion === 'compra' && documento.proveedor_id) {
    const { data, error } = await supabaseAfip
      .from('proveedores')
      .select('razon_social')
      .eq('id', documento.proveedor_id)
      .maybeSingle()
    if (error) throw error
    return (data as { razon_social: string } | null)?.razon_social ?? null
  }
  return null
}

function roundMoney(value: number): number {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100
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
