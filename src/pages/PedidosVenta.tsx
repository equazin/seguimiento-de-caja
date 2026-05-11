import React, { useMemo, useState, useEffect } from 'react'
import { Plus, AlertTriangle, Clock, ChevronDown, ChevronRight, Trash2, Edit2, X, ShoppingCart, FileText } from 'lucide-react'
import {
  usePedidosVenta,
  usePedidosCompra,
  crearPedidoVenta,
  actualizarPedidoVenta,
  eliminarPedidoVenta,
  usePedidoVentaDetalle,
} from '@/hooks/usePedidos'
import { useClientes, useProductos } from '@/hooks/useCatalogo'
import { useCotizacionUSD } from '@/hooks/useCotizacionUSD'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { ImportarDesdeDocumentoDialog } from '@/components/ventas/ImportarDesdeDocumentoDialog'
import { formatMoney, formatDate } from '@/lib/formatters'
import {
  ESTADO_VENTA_CONFIG,
  calcularSaldoPendiente,
  estaVencido,
  limpiarNotaRetencion,
  montoCanceladoVinculo,
  obtenerRetencionGanancias,
  venceProximamente,
} from '@/lib/vinculos'
import { toast } from 'sonner'
import type { Documento, EstadoPedidoVenta, PedidoItem, PedidoVenta } from '@/db/schema'
import type { ItemDraft } from '@/lib/documentos'

const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27]

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface Filtros {
  estado: EstadoPedidoVenta | ''
  cliente: string
  fechaDesde: string
  fechaHasta: string
}

interface FormState {
  numero: string
  cliente_id: string
  cliente: string  // texto fallback
  fecha: string
  fecha_vencimiento: string
  producto_id: string
  pedido_compra_origen_id: string
  cantidad: string
  precio_unitario_usd: string
  alicuota_iva: string
  margen_porcentaje: string
  tipo_cambio: string
  descripcion: string
  notas: string
  items_importados: PedidoItem[] | null
}

const INITIAL_FORM: FormState = {
  numero: '',
  cliente_id: '',
  cliente: '',
  fecha: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
  producto_id: '',
  pedido_compra_origen_id: '',
  cantidad: '1',
  precio_unitario_usd: '',
  alicuota_iva: '21',
  margen_porcentaje: '',
  tipo_cambio: '',
  descripcion: '',
  notas: '',
  items_importados: null,
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function itemDraftToPedidoItem(item: ItemDraft, tipoCambio: number, moneda: 'ARS' | 'USD'): PedidoItem {
  const tc = tipoCambio > 0 ? tipoCambio : 1
  const cantidad = Number(item.cantidad) || 1
  const precioUnitario = moneda === 'USD'
    ? Number(item.precio_unitario) || 0
    : round2((Number(item.precio_unitario) || 0) / tc)
  const bonificacion = Math.max(0, Math.min(100, Number(item.bonificacion) || 0))
  const subtotal = round2(cantidad * precioUnitario * (1 - bonificacion / 100))
  const alicuotaIva = Number(item.alicuota_iva) || 0
  const ivaImporte = round2(subtotal * alicuotaIva / 100)

  return {
    producto_id: item.producto_id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    cantidad,
    unidad_medida: item.unidad_medida,
    precio_unitario: precioUnitario,
    bonificacion,
    alicuota_iva: alicuotaIva,
    subtotal,
    iva_importe: ivaImporte,
    total: round2(subtotal + ivaImporte),
  }
}

function normalizarItemsPedido(items: PedidoItem[] | null | undefined): PedidoItem[] {
  return (items ?? []).map(item => ({
    ...item,
    producto_id: item.producto_id ?? null,
    codigo: item.codigo ?? null,
    unidad_medida: item.unidad_medida ?? 'unidad',
    cantidad: Number(item.cantidad) || 1,
    precio_unitario: Number(item.precio_unitario) || 0,
    bonificacion: Number(item.bonificacion) || 0,
    alicuota_iva: Number(item.alicuota_iva) || 0,
    subtotal: Number(item.subtotal) || 0,
    iva_importe: Number(item.iva_importe) || 0,
    total: Number(item.total) || 0,
  }))
}

function parsePorcentaje(value: string): number {
  if (!value.trim()) return 0
  const porcentaje = Number(value.replace(',', '.'))
  return Number.isFinite(porcentaje) ? Math.max(0, porcentaje) : 0
}

function formatPorcentaje(value: number): string {
  const rounded = Math.round(value * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(2)
}

function totalItemsUsd(items: PedidoItem[]): number {
  return round2(items.reduce((acc, item) => acc + Number(item.total ?? 0), 0))
}

function margenDesdePedido(pedido: PedidoVenta, items: PedidoItem[]): string {
  const baseUsd = totalItemsUsd(items)
  const totalUsd = Number(pedido.monto_total_usd ?? 0) > 0
    ? Number(pedido.monto_total_usd)
    : Number(pedido.tipo_cambio ?? 0) > 0
      ? round2(Number(pedido.monto_total ?? 0) / Number(pedido.tipo_cambio))
      : 0
  const margenUsd = round2(totalUsd - baseUsd)
  if (baseUsd <= 0 || margenUsd <= 0) return ''
  return formatPorcentaje((margenUsd / baseUsd) * 100)
}

function margenDesdePresupuesto(documento: Documento): string {
  const margen = documento.percepciones_usd != null
    ? Number(documento.percepciones_usd)
    : Number(documento.percepciones ?? 0)
  const base = documento.subtotal_usd != null && documento.iva_total_usd != null
    ? Number(documento.subtotal_usd) + Number(documento.iva_total_usd)
    : Number(documento.subtotal ?? 0) + Number(documento.iva_total ?? 0)
  if (!Number.isFinite(margen) || !Number.isFinite(base) || margen <= 0 || base <= 0) return ''
  return formatPorcentaje((margen / base) * 100)
}

// ─── Sub-componente: fila expandible ─────────────────────────────────────────

function FilaDetalle({ id }: { id: string }) {
  const detalle = usePedidoVentaDetalle(id)
  if (!detalle) return (
    <div className="py-4 text-center text-sm text-muted-foreground">Cargando...</div>
  )
  const { pedido, vinculos } = detalle
  const totalCobrado = vinculos.reduce((s, v) => s + v.monto_aplicado, 0)
  const totalRetenciones = vinculos.reduce((s, v) => s + obtenerRetencionGanancias(v), 0)
  const totalCancelado = vinculos.reduce((s, v) => s + montoCanceladoVinculo(v), 0)
  const saldo = calcularSaldoPendiente(pedido, vinculos)

  return (
    <div className="px-6 pb-4 pt-2 space-y-3">
      {pedido.descripcion && (
        <p className="text-sm text-muted-foreground">{pedido.descripcion}</p>
      )}
      <div className="flex gap-6 text-sm">
        <div>
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="font-semibold text-white">{formatMoney(pedido.monto_total)}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Cobrado</p>
          <p className="font-semibold text-success">{formatMoney(totalCobrado)}</p>
        </div>
        {totalRetenciones > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Retenciones</p>
            <p className="font-semibold text-warning">{formatMoney(totalRetenciones)}</p>
          </div>
        )}
        {totalRetenciones > 0 && (
          <div>
            <p className="text-xs text-muted-foreground">Cancelado</p>
            <p className="font-semibold text-white">{formatMoney(totalCancelado)}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-muted-foreground">Saldo</p>
          <p className={`font-semibold ${saldo > 0 ? 'text-warning' : 'text-success'}`}>{formatMoney(saldo)}</p>
        </div>
      </div>
      {vinculos.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Movimiento</th>
                <th className="px-3 py-2 text-right font-medium">Monto cobrado</th>
                <th className="px-3 py-2 text-right font-medium">Retencion</th>
                <th className="px-3 py-2 text-left font-medium">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vinculos.map(v => (
                <tr key={v.id} className="hover:bg-surface-2/50">
                  <td className="px-3 py-2 text-muted-foreground font-mono">{v.movimiento_id.slice(0, 8)}…</td>
                  <td className="px-3 py-2 text-right text-white">{formatMoney(v.monto_aplicado)}</td>
                  <td className="px-3 py-2 text-right text-warning">
                    {obtenerRetencionGanancias(v) > 0 ? formatMoney(obtenerRetencionGanancias(v)) : '—'}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{limpiarNotaRetencion(v.notas) || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vinculos.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Sin cobros vinculados</p>
      )}
    </div>
  )
}

// ─── Modal de creación/edición ────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  pedido?: PedidoVenta | null
}

function PedidoVentaModal({ open, onClose, pedido }: ModalProps) {
  const clientesData = useClientes({ soloActivos: true })
  const productosData = useProductos({ soloActivos: true })
  const pedidosCompraData = usePedidosCompra()
  const clientes = useMemo(() => clientesData ?? [], [clientesData])
  const productos = useMemo(() => productosData ?? [], [productosData])
  const pedidosCompra = useMemo(
    () => (pedidosCompraData ?? []).filter(p => p.estado !== 'cancelado'),
    [pedidosCompraData]
  )
  const cotizacion = useCotizacionUSD()
  const cotizacionGlobal = cotizacion?.cotizacion ?? 0

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)
  const [importPresupuestoOpen, setImportPresupuestoOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (pedido) {
      const tcPedido = pedido.tipo_cambio
      const itemsPedido = normalizarItemsPedido(pedido.items)
      const item = itemsPedido[0]
      const ivaFallback = 0
      const totalUsd = Number(pedido.monto_total_usd ?? 0)
      const precioFallback = totalUsd > 0 ? totalUsd : 0
      const requierePreservarItems = itemsPedido.length > 1 || itemsPedido.some(it => Number(it.bonificacion ?? 0) > 0)
      setForm({
        numero: pedido.numero,
        cliente_id: pedido.cliente_id ?? '',
        cliente: pedido.cliente ?? '',
        fecha: pedido.fecha,
        fecha_vencimiento: pedido.fecha_vencimiento ?? '',
        producto_id: item?.producto_id ?? '',
        pedido_compra_origen_id: '',
        cantidad: String(item?.cantidad ?? 1),
        precio_unitario_usd: String(item?.precio_unitario ?? (precioFallback || '')),
        alicuota_iva: String(item?.alicuota_iva ?? ivaFallback),
        margen_porcentaje: margenDesdePedido(pedido, itemsPedido),
        tipo_cambio: tcPedido != null ? String(tcPedido) : String(cotizacionGlobal || ''),
        descripcion: item?.descripcion ?? pedido.descripcion ?? '',
        notas: pedido.notas ?? '',
        items_importados: requierePreservarItems ? itemsPedido : null,
      })
    } else {
      setForm({
        ...INITIAL_FORM,
        fecha: new Date().toISOString().split('T')[0],
        tipo_cambio: cotizacionGlobal > 0 ? String(cotizacionGlobal) : '',
      })
    }
  }, [open, pedido?.id, cotizacionGlobal])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  function pickCliente(id: string) {
    const cliente = clientes.find(c => c.id === id)
    setForm(f => ({
      ...f,
      cliente_id: id,
      cliente: cliente ? cliente.razon_social : f.cliente,
    }))
    setErrors(e => ({ ...e, cliente_id: undefined }))
  }

  function pickProducto(id: string) {
    const producto = productos.find(p => p.id === id)
    setForm(f => ({
      ...f,
      producto_id: id,
      pedido_compra_origen_id: '',
      items_importados: null,
      descripcion: producto ? producto.nombre : f.descripcion,
      precio_unitario_usd: producto ? String(producto.precio_neto) : f.precio_unitario_usd,
      alicuota_iva: producto ? String(producto.alicuota_iva) : f.alicuota_iva,
    }))
    setErrors(e => ({ ...e, producto_id: undefined, precio_unitario_usd: undefined, alicuota_iva: undefined }))
  }

  function importarPedidoCompra(id: string) {
    if (!id) {
      setForm(f => ({ ...f, pedido_compra_origen_id: '' }))
      return
    }
    const pedidoCompra = pedidosCompra.find(p => p.id === id)
    if (!pedidoCompra) return
    const item = pedidoCompra.items?.[0]
    const totalUsd = Number(pedidoCompra.monto_total_usd ?? 0)
    const cantidad = Number(item?.cantidad ?? 1)
    const precioUnitario = item?.precio_unitario != null
      ? Number(item.precio_unitario)
      : cantidad > 0 && totalUsd > 0
        ? round2(totalUsd / cantidad)
        : 0
    const descripcion = item?.descripcion ?? pedidoCompra.descripcion ?? `Orden ${pedidoCompra.numero}`

    setForm(f => ({
      ...f,
      pedido_compra_origen_id: id,
      items_importados: null,
      producto_id: item?.producto_id ?? '',
      cantidad: String(cantidad > 0 ? cantidad : 1),
      precio_unitario_usd: precioUnitario > 0 ? String(precioUnitario) : '',
      alicuota_iva: String(item?.alicuota_iva ?? 0),
      tipo_cambio: pedidoCompra.tipo_cambio != null ? String(pedidoCompra.tipo_cambio) : f.tipo_cambio,
      descripcion,
      notas: f.notas.trim()
        ? f.notas
        : `Importado desde orden de compra ${pedidoCompra.numero}`,
    }))
    setErrors(e => ({
      ...e,
      producto_id: undefined,
      cantidad: undefined,
      precio_unitario_usd: undefined,
      alicuota_iva: undefined,
      tipo_cambio: undefined,
    }))
  }

  function importarPresupuesto(documento: Documento, items: ItemDraft[], contactoId: string | null) {
    const tcDocumento = Number(documento.tipo_cambio) > 0 ? Number(documento.tipo_cambio) : cotizacionGlobal || 1
    const itemsPedido = items.map(item => itemDraftToPedidoItem(item, tcDocumento, documento.moneda))
    const primerItem = itemsPedido[0]
    const cliente = contactoId ? clientes.find(c => c.id === contactoId) : null
    const margenPresupuesto = margenDesdePresupuesto(documento)
    const descripcion = itemsPedido.length > 1
      ? `Presupuesto ${documento.numero_interno} (${itemsPedido.length} items)`
      : primerItem?.descripcion ?? `Presupuesto ${documento.numero_interno}`

    setForm(f => ({
      ...f,
      cliente_id: contactoId ?? f.cliente_id,
      cliente: cliente?.razon_social ?? f.cliente,
      fecha_vencimiento: documento.fecha_vencimiento ?? f.fecha_vencimiento,
      producto_id: primerItem?.producto_id ?? '',
      pedido_compra_origen_id: '',
      cantidad: String(primerItem?.cantidad ?? 1),
      precio_unitario_usd: primerItem ? String(primerItem.precio_unitario) : '',
      alicuota_iva: String(primerItem?.alicuota_iva ?? 0),
      margen_porcentaje: margenPresupuesto,
      tipo_cambio: String(tcDocumento),
      descripcion,
      notas: f.notas.trim()
        ? f.notas
        : `Importado desde presupuesto ${documento.numero_interno}`,
      items_importados: itemsPedido.length > 0 ? itemsPedido : null,
    }))
    setErrors(e => ({
      ...e,
      cliente_id: undefined,
      producto_id: undefined,
      cantidad: undefined,
      precio_unitario_usd: undefined,
      alicuota_iva: undefined,
      tipo_cambio: undefined,
    }))
  }

  function quitarPresupuestoImportado() {
    setForm(f => ({
      ...f,
      items_importados: null,
      notas: f.notas.startsWith('Importado desde presupuesto ') ? '' : f.notas,
    }))
  }

  const cantidadNum = Number(form.cantidad.replace(',', '.'))
  const precioUnitarioNum = Number(form.precio_unitario_usd.replace(',', '.'))
  const ivaNum = Number(form.alicuota_iva)
  const margenNum = parsePorcentaje(form.margen_porcentaje)
  const tcNum = Number(form.tipo_cambio.replace(',', '.'))
  const itemsImportados = form.items_importados ?? []
  const hayItemsImportados = itemsImportados.length > 0
  const subtotalManualUsd =
    Number.isFinite(cantidadNum) && cantidadNum > 0 && Number.isFinite(precioUnitarioNum) && precioUnitarioNum >= 0
      ? round2(cantidadNum * precioUnitarioNum)
      : 0
  const ivaManualUsd = Number.isFinite(ivaNum) && ivaNum > 0 ? round2(subtotalManualUsd * ivaNum / 100) : 0
  const subtotalUsd = hayItemsImportados
    ? round2(itemsImportados.reduce((acc, item) => acc + Number(item.subtotal ?? 0), 0))
    : subtotalManualUsd
  const ivaUsd = hayItemsImportados
    ? round2(itemsImportados.reduce((acc, item) => acc + Number(item.iva_importe ?? 0), 0))
    : ivaManualUsd
  const totalBaseUsd = hayItemsImportados
    ? round2(itemsImportados.reduce((acc, item) => acc + Number(item.total ?? 0), 0))
    : round2(subtotalManualUsd + ivaManualUsd)
  const margenUsd = round2(totalBaseUsd * margenNum / 100)
  const totalUsd = round2(totalBaseUsd + margenUsd)
  const arsCalculado =
    totalUsd > 0 && Number.isFinite(tcNum) && tcNum > 0
      ? round2(totalUsd * tcNum)
      : 0

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.cliente_id && !form.cliente.trim()) errs.cliente_id = 'Seleccioná un cliente'
    if (!form.fecha) errs.fecha = 'Requerido'
    if (!hayItemsImportados && (!Number.isFinite(cantidadNum) || cantidadNum <= 0)) errs.cantidad = 'Cantidad invalida'
    if (!hayItemsImportados && (!Number.isFinite(precioUnitarioNum) || precioUnitarioNum < 0)) errs.precio_unitario_usd = 'Precio invalido'
    if (!hayItemsImportados && (!Number.isFinite(ivaNum) || ivaNum < 0)) errs.alicuota_iva = 'IVA invalido'
    if (form.margen_porcentaje.trim() && (!Number.isFinite(Number(form.margen_porcentaje.replace(',', '.'))) || Number(form.margen_porcentaje.replace(',', '.')) < 0)) {
      errs.margen_porcentaje = 'Margen invalido'
    }
    if (totalUsd <= 0) errs.precio_unitario_usd = 'El total debe ser mayor a cero'
    if (!Number.isFinite(tcNum) || tcNum <= 0) errs.tipo_cambio = 'Tipo de cambio inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const producto = productos.find(p => p.id === form.producto_id)
      const itemManual: PedidoItem = {
        producto_id: form.producto_id || null,
        codigo: producto?.codigo ?? null,
        descripcion: form.descripcion.trim() || producto?.nombre || 'Pedido de venta',
        cantidad: cantidadNum,
        unidad_medida: producto?.unidad_medida ?? 'unidad',
        precio_unitario: precioUnitarioNum,
        bonificacion: 0,
        alicuota_iva: ivaNum,
        subtotal: subtotalUsd,
        iva_importe: ivaUsd,
        total: totalUsd,
      }
      const items = hayItemsImportados ? itemsImportados : [itemManual]
      const data = {
        numero: pedido ? form.numero.trim() : '',
        cliente: form.cliente.trim(),
        cliente_id: form.cliente_id || null,
        fecha: form.fecha,
        fecha_vencimiento: form.fecha_vencimiento || null,
        estado: (pedido?.estado ?? 'pendiente') as EstadoPedidoVenta,
        monto_total: arsCalculado,
        monto_total_usd: totalUsd,
        tipo_cambio: tcNum,
        descripcion: form.descripcion.trim() || null,
        items,
        notas: form.notas.trim() || null,
      }
      if (pedido) {
        await actualizarPedidoVenta(pedido.id, data)
        toast.success('Pedido actualizado')
      } else {
        await crearPedidoVenta(data)
        toast.success('Pedido de venta creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    <Dialog open={open} onClose={onClose} title={pedido ? 'Editar pedido de venta' : 'Nuevo pedido de venta'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Número"
            placeholder="Se asigna automaticamente al guardar"
            value={pedido ? form.numero : 'Automatico'}
            disabled
            hint={pedido ? 'Numero asignado por el sistema' : 'El sistema generara el proximo PV disponible'}
          />
          <Select
            label="Cliente"
            value={form.cliente_id}
            onChange={e => pickCliente(e.target.value)}
            error={errors.cliente_id}
            required
          >
            <option value="">— Seleccioná un cliente —</option>
            {clientes.map(c => (
              <option key={c.id} value={c.id}>{c.razon_social}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Fecha"
            type="date"
            value={form.fecha}
            onChange={e => set('fecha', e.target.value)}
            error={errors.fecha}
            required
          />
          <Input
            label="Vencimiento (opcional)"
            type="date"
            value={form.fecha_vencimiento}
            onChange={e => set('fecha_vencimiento', e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/70 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-medium text-white">Presupuesto existente</p>
            <p className="text-xs text-muted-foreground">Traer cliente, items y totales desde un presupuesto.</p>
          </div>
          <Button
            type="button"
            variant="secondary"
            className="justify-center"
            onClick={() => setImportPresupuestoOpen(true)}
          >
            <FileText size={16} />
            Traer presupuesto
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Producto / orden"
            value={form.producto_id}
            onChange={e => pickProducto(e.target.value)}
            disabled={hayItemsImportados}
          >
            <option value="">Manual / sin producto</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Select
            label="Importar orden de compra"
            value={form.pedido_compra_origen_id}
            onChange={e => importarPedidoCompra(e.target.value)}
            disabled={hayItemsImportados}
          >
            <option value="">No importar</option>
            {pedidosCompra.map(p => (
              <option key={p.id} value={p.id}>
                {p.numero} - {p.proveedor} - {formatMoney(p.monto_total_usd ?? 0, 'USD')}
              </option>
            ))}
          </Select>
        </div>
        {hayItemsImportados && (
          <div className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-white">
                  Pedido con {itemsImportados.length} item{itemsImportados.length !== 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Se guardan las líneas originales del presupuesto en el pedido.
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={quitarPresupuestoImportado}>
                Quitar
              </Button>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Cantidad"
            type="number"
            min="0"
            step="0.01"
            value={form.cantidad}
            onChange={e => set('cantidad', e.target.value)}
            error={errors.cantidad}
            disabled={hayItemsImportados}
            required
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Input
            label="Precio unitario USD (sin IVA)"
            type="number"
            min="0"
            step="0.01"
            placeholder="USD 0.00"
            value={form.precio_unitario_usd}
            onChange={e => set('precio_unitario_usd', e.target.value)}
            error={errors.precio_unitario_usd}
            hint={`Total ${formatMoney(totalBaseUsd, 'USD')} con IVA`}
            disabled={hayItemsImportados}
            required
          />
          <Select
            label="IVA"
            value={form.alicuota_iva}
            onChange={e => set('alicuota_iva', e.target.value)}
            error={errors.alicuota_iva}
            disabled={hayItemsImportados}
            required
          >
            {ALICUOTAS_IVA.map(a => (
              <option key={a} value={a}>{a}%</option>
            ))}
          </Select>
          <Input
            label="Tipo de cambio"
            type="number"
            min="0"
            step="0.01"
            value={form.tipo_cambio}
            onChange={e => set('tipo_cambio', e.target.value)}
            error={errors.tipo_cambio}
            hint={
              cotizacionGlobal > 0 && tcNum && Math.abs(cotizacionGlobal - tcNum) > 0.001
                ? `Global: ${cotizacionGlobal}`
                : 'Cotización global'
            }
            required
          />
        </div>
        <Input
          label="Descripción (opcional)"
          placeholder="Descripción del pedido"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
        />
        <Input
          label="Margen"
          type="number"
          min="0"
          step="0.01"
          placeholder="0"
          value={form.margen_porcentaje}
          onChange={e => set('margen_porcentaje', e.target.value)}
          error={errors.margen_porcentaje}
          hint={margenUsd > 0 ? `Suma ${formatMoney(margenUsd, 'USD')}` : 'Opcional'}
        />
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total calculado</p>
          <p className="mt-1 font-semibold text-white">{formatMoney(totalUsd, 'USD')}</p>
          <p className="text-xs text-muted-foreground">
            Neto {formatMoney(subtotalUsd, 'USD')} + IVA {formatMoney(ivaUsd, 'USD')}
            {margenUsd > 0 && ` + Margen ${formatMoney(margenUsd, 'USD')}`}
          </p>
          {arsCalculado > 0 && (
            <p className="text-xs text-muted-foreground">ARS {formatMoney(arsCalculado)}</p>
          )}
        </div>
        <Textarea
          label="Notas internas (opcional)"
          placeholder="Observaciones, condiciones, etc."
          value={form.notas}
          onChange={e => set('notas', e.target.value)}
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{pedido ? 'Guardar cambios' : 'Crear pedido'}</Button>
        </div>
      </form>
    </Dialog>
    <ImportarDesdeDocumentoDialog
      open={importPresupuestoOpen}
      tipoOperacion="venta"
      tipoDestino="pedido"
      tipoOrigen="presupuesto"
      contactoId={form.cliente_id || null}
      onClose={() => setImportPresupuestoOpen(false)}
      onImport={importarPresupuesto}
    />
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export function PedidosVenta() {
  const [filtros, setFiltros] = useState<Filtros>({ estado: '', cliente: '', fechaDesde: '', fechaHasta: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<PedidoVenta | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const pedidos = usePedidosVenta({ ...filtros, estado: filtros.estado || undefined })

  const toggleExpand = (id: string) => setExpandido(prev => prev === id ? null : id)

  const handleEdit = (p: PedidoVenta) => {
    setEditando(p)
    setModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    try {
      await eliminarPedidoVenta(id)
      toast.success('Pedido eliminado')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleCancelar = async (p: PedidoVenta) => {
    try {
      await actualizarPedidoVenta(p.id, { estado: 'cancelado' })
      toast.success('Pedido cancelado')
    } catch {
      toast.error('Error al cancelar')
    }
  }

  const setFiltro = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros(f => ({ ...f, [k]: v }))

  const limpiarFiltros = () => setFiltros({ estado: '', cliente: '', fechaDesde: '', fechaHasta: '' })

  const hayFiltros = filtros.estado || filtros.cliente || filtros.fechaDesde || filtros.fechaHasta

  const vencidos = (pedidos ?? []).filter(p =>
    p.estado !== 'cancelado' && p.estado !== 'cobrado_total' && estaVencido(p.fecha_vencimiento)
  ).length

  const proximosAVencer = (pedidos ?? []).filter(p =>
    p.estado !== 'cancelado' && p.estado !== 'cobrado_total' &&
    !estaVencido(p.fecha_vencimiento) && venceProximamente(p.fecha_vencimiento)
  ).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pedidos de venta</h1>
          <p className="text-sm text-muted-foreground">Ventas y cobros a clientes</p>
        </div>
        <Button onClick={() => { setEditando(null); setModalOpen(true) }}>
          <Plus size={16} className="mr-1" /> Nuevo pedido
        </Button>
      </div>

      {/* Alertas de vencimiento */}
      {(vencidos > 0 || proximosAVencer > 0) && (
        <div className="flex gap-3 flex-wrap">
          {vencidos > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle size={14} />
              {vencidos} pedido{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''}
            </div>
          )}
          {proximosAVencer > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <Clock size={14} />
              {proximosAVencer} vence{proximosAVencer > 1 ? 'n' : ''} esta semana
            </div>
          )}
        </div>
      )}

      {/* Filtros */}
      <div className="rounded-xl border border-border bg-surface/90 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Estado" value={filtros.estado} onChange={e => setFiltro('estado', e.target.value as EstadoPedidoVenta | '')}>
            <option value="">Todos</option>
            {(Object.entries(ESTADO_VENTA_CONFIG) as [EstadoPedidoVenta, { label: string }][]).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
          <Input label="Cliente / número" placeholder="Buscar..." value={filtros.cliente} onChange={e => setFiltro('cliente', e.target.value)} />
          <Input label="Desde" type="date" value={filtros.fechaDesde} onChange={e => setFiltro('fechaDesde', e.target.value)} />
          <Input label="Hasta" type="date" value={filtros.fechaHasta} onChange={e => setFiltro('fechaHasta', e.target.value)} />
        </div>
        {hayFiltros && (
          <button onClick={limpiarFiltros} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-border bg-surface/90 overflow-hidden shadow-xl shadow-black/10">
        {pedidos === undefined ? (
          <SkeletonTable rows={5} />
        ) : pedidos.length === 0 ? (
          <EmptyState
            icon={ShoppingCart}
            titulo="Sin pedidos de venta"
            descripcion={hayFiltros ? 'Ningún pedido coincide con los filtros aplicados.' : 'Creá tu primer pedido de venta.'}
          />
        ) : (
          <table className="w-full">
            <thead className="border-b border-border bg-surface-2/50">
              <tr className="text-xs text-muted-foreground">
                <th className="w-8" />
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Cliente</th>
                <th className="px-4 py-3 text-left font-medium">Fecha</th>
                <th className="px-4 py-3 text-left font-medium">Vencimiento</th>
                <th className="px-4 py-3 text-right font-medium">Total USD</th>
                <th className="px-4 py-3 text-right font-medium">Total ARS</th>
                <th className="px-4 py-3 text-left font-medium">Estado</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedidos.map(p => {
                const cfg = ESTADO_VENTA_CONFIG[p.estado] ?? { label: p.estado, color: '#6b7280' }
                const vencido = estaVencido(p.fecha_vencimiento) && p.estado !== 'cancelado' && p.estado !== 'cobrado_total'
                const proxVencer = !vencido && venceProximamente(p.fecha_vencimiento) && p.estado !== 'cancelado' && p.estado !== 'cobrado_total'
                const isExpanded = expandido === p.id

                return (
                  <React.Fragment key={p.id}>
                    <tr
                      className="cursor-pointer hover:bg-surface-2/30 transition-colors"
                      onDoubleClick={() => handleEdit(p)}
                      title="Doble click para editar"
                    >
                      <td className="pl-3">
                        <button
                          type="button"
                          onClick={() => toggleExpand(p.id)}
                          className="text-muted-foreground hover:text-white transition-colors"
                        >
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => handleEdit(p)}
                          className="font-mono text-sm text-white underline-offset-4 hover:text-primary hover:underline"
                          title="Editar pedido"
                        >
                          {p.numero}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-white">{p.cliente}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{formatDate(p.fecha)}</td>
                      <td className="px-4 py-3">
                        {p.fecha_vencimiento ? (
                          <span className={`text-sm flex items-center gap-1 ${vencido ? 'text-danger' : proxVencer ? 'text-warning' : 'text-muted-foreground'}`}>
                            {vencido && <AlertTriangle size={12} />}
                            {proxVencer && <Clock size={12} />}
                            {formatDate(p.fecha_vencimiento)}
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground/40">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-white tabular-nums">
                        {p.monto_total_usd != null ? formatMoney(p.monto_total_usd, 'USD') : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">
                        {formatMoney(p.monto_total)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: cfg.color + '20', color: cfg.color }}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="pr-3">
                        <RowActionsMenu
                          actions={[
                            { id: 'editar', label: 'Editar', icon: Edit2, onClick: () => handleEdit(p) },
                            ...(p.estado !== 'cancelado' ? [{ id: 'cancelar', label: 'Cancelar', icon: X, onClick: () => handleCancelar(p) }] : []),
                            { id: 'eliminar', label: 'Eliminar', icon: Trash2, onClick: () => setConfirmDelete(p.id), tone: 'danger' as const },
                          ]}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-2/20">
                        <td colSpan={9}>
                          <FilaDetalle id={p.id} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <PedidoVentaModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditando(null) }}
        pedido={editando}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Eliminar pedido"
        message="Esta acción eliminará el pedido y todos sus vínculos. No se puede deshacer."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
