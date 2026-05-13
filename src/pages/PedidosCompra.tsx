import React, { useMemo, useState, useEffect } from 'react'
import { Plus, AlertTriangle, Clock, ChevronDown, ChevronRight, Trash2, Edit2, X, Truck } from 'lucide-react'
import {
  usePedidosCompra,
  crearPedidoCompra,
  actualizarPedidoCompra,
  eliminarPedidoCompra,
  usePedidoCompraDetalle,
} from '@/hooks/usePedidos'
import { useProductos, useProveedores } from '@/hooks/useCatalogo'
import { useCotizacionUSD } from '@/hooks/useCotizacionUSD'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { formatMoney, formatDate } from '@/lib/formatters'
import {
  ESTADO_COMPRA_CONFIG,
  calcularSaldoPendiente,
  estaVencido,
  venceProximamente,
} from '@/lib/vinculos'
import { toast } from 'sonner'
import type { EstadoPedidoCompra, PedidoCompra, PedidoItem } from '@/db/schema'

const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27]

interface Filtros {
  estado: EstadoPedidoCompra | ''
  proveedor: string
  fechaDesde: string
  fechaHasta: string
}

interface FormState {
  numero: string
  proveedor_id: string
  proveedor: string  // texto libre como fallback si no hay seleccion
  fecha: string
  fecha_vencimiento: string
  tipo_cambio: string
  descripcion: string
  items: FormItemState[]
  notas: string
}

interface FormItemState {
  uid: string
  producto_id: string
  cantidad: string
  precio_unitario_usd: string
  alicuota_iva: string
  descripcion: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function parseDecimal(value: string): number {
  return Number(value.replace(',', '.'))
}

function newItem(partial: Partial<FormItemState> = {}): FormItemState {
  const uid = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
  return {
    uid,
    producto_id: '',
    cantidad: '1',
    precio_unitario_usd: '',
    alicuota_iva: '21',
    descripcion: '',
    ...partial,
  }
}

function newForm(): FormState {
  return {
    numero: '',
    proveedor_id: '',
    proveedor: '',
    fecha: new Date().toISOString().split('T')[0],
    fecha_vencimiento: '',
    tipo_cambio: '',
    descripcion: '',
    items: [newItem()],
    notas: '',
  }
}

// ─── Detalle expandible ───────────────────────────────────────────────────────

function FilaDetalle({ id }: { id: string }) {
  const detalle = usePedidoCompraDetalle(id)
  if (!detalle) return (
    <div className="py-4 text-center text-sm text-muted-foreground">Cargando...</div>
  )
  const { pedido, vinculos } = detalle
  const totalPagado = vinculos.reduce((s, v) => s + v.monto_aplicado, 0)
  const saldo = calcularSaldoPendiente(pedido, vinculos)
  return (
    <div className="px-6 pb-4 pt-2 space-y-3">
      {pedido.descripcion && <p className="text-sm text-muted-foreground">{pedido.descripcion}</p>}
      <div className="flex gap-6 text-sm">
        <div><p className="text-xs text-muted-foreground">Total</p><p className="font-semibold text-white">{formatMoney(pedido.monto_total)}</p></div>
        <div><p className="text-xs text-muted-foreground">Pagado</p><p className="font-semibold text-success">{formatMoney(totalPagado)}</p></div>
        <div><p className="text-xs text-muted-foreground">Saldo</p><p className={`font-semibold ${saldo > 0 ? 'text-warning' : 'text-success'}`}>{formatMoney(saldo)}</p></div>
      </div>
      {!!pedido.items?.length && (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-surface-2 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Item</th>
                <th className="px-3 py-2 text-right font-medium">Cantidad</th>
                <th className="px-3 py-2 text-right font-medium">Precio USD</th>
                <th className="px-3 py-2 text-right font-medium">IVA</th>
                <th className="px-3 py-2 text-right font-medium">Total USD</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {pedido.items.map((item, idx) => (
                <tr key={`${item.producto_id ?? item.descripcion}-${idx}`} className="hover:bg-surface-2/50">
                  <td className="px-3 py-2 text-white">{item.descripcion}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{Number(item.cantidad).toLocaleString('es-AR')}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{formatMoney(Number(item.precio_unitario), 'USD')}</td>
                  <td className="px-3 py-2 text-right text-muted-foreground">{Number(item.alicuota_iva ?? 0)}%</td>
                  <td className="px-3 py-2 text-right text-white">{formatMoney(Number(item.total ?? 0), 'USD')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {vinculos.length === 0
        ? <p className="text-xs text-muted-foreground italic">Sin pagos vinculados</p>
        : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-surface-2 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Movimiento</th>
                  <th className="px-3 py-2 text-right font-medium">Monto aplicado</th>
                  <th className="px-3 py-2 text-left font-medium">Notas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vinculos.map(v => (
                  <tr key={v.id} className="hover:bg-surface-2/50">
                    <td className="px-3 py-2 text-muted-foreground font-mono">{v.movimiento_id.slice(0, 8)}…</td>
                    <td className="px-3 py-2 text-right text-white">{formatMoney(v.monto_aplicado)}</td>
                    <td className="px-3 py-2 text-muted-foreground">{v.notas ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    </div>
  )
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean
  onClose: () => void
  pedido: PedidoCompra | null
}

function PedidoCompraModal({ open, onClose, pedido }: ModalProps) {
  const proveedoresData = useProveedores({ soloActivos: true })
  const productosData = useProductos({ soloActivos: true })
  const proveedores = useMemo(() => proveedoresData ?? [], [proveedoresData])
  const productos = useMemo(() => productosData ?? [], [productosData])
  const cotizacion = useCotizacionUSD()
  const cotizacionGlobal = cotizacion?.cotizacion ?? 0

  const [form, setForm] = useState<FormState>(() => newForm())
  const [errors, setErrors] = useState<Record<string, string | undefined>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (pedido) {
      const proveedorId = pedido.proveedor_id ?? ''
      const tcPedido = pedido.tipo_cambio
      const items = pedido.items?.length
        ? pedido.items.map(item => newItem({
            producto_id: item.producto_id ?? '',
            cantidad: String(item.cantidad ?? 1),
            precio_unitario_usd: String(item.precio_unitario ?? ''),
            alicuota_iva: String(item.alicuota_iva ?? 0),
            descripcion: item.descripcion ?? '',
          }))
        : [newItem()]
      const totalUsd = Number(pedido.monto_total_usd ?? 0)
      if (!pedido.items?.length && totalUsd > 0) {
        items[0] = newItem({
          cantidad: '1',
          precio_unitario_usd: String(totalUsd),
          alicuota_iva: '0',
          descripcion: pedido.descripcion ?? '',
        })
      }
      setForm({
        numero: pedido.numero,
        proveedor_id: proveedorId,
        proveedor: pedido.proveedor ?? '',
        fecha: pedido.fecha,
        fecha_vencimiento: pedido.fecha_vencimiento ?? '',
        tipo_cambio: tcPedido != null ? String(tcPedido) : String(cotizacionGlobal || ''),
        descripcion: pedido.descripcion ?? '',
        items,
        notas: pedido.notas ?? '',
      })
    } else {
      setForm({
        ...newForm(),
        fecha: new Date().toISOString().split('T')[0],
        tipo_cambio: cotizacionGlobal > 0 ? String(cotizacionGlobal) : '',
      })
    }
  }, [open, pedido?.id, cotizacionGlobal])

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const itemErrorKey = (uid: string, key: keyof FormItemState) => `item.${uid}.${key}`

  const setItem = (uid: string, patch: Partial<FormItemState>) => {
    setForm(f => ({
      ...f,
      items: f.items.map(item => item.uid === uid ? { ...item, ...patch } : item),
    }))
    setErrors(e => {
      const next = { ...e }
      Object.keys(patch).forEach(key => {
        next[itemErrorKey(uid, key as keyof FormItemState)] = undefined
      })
      next.items = undefined
      return next
    })
  }

  function pickProveedor(id: string) {
    const proveedor = proveedores.find(p => p.id === id)
    setForm(f => ({
      ...f,
      proveedor_id: id,
      proveedor: proveedor ? proveedor.razon_social : f.proveedor,
    }))
    setErrors(e => ({ ...e, proveedor: undefined, proveedor_id: undefined }))
  }

  function pickProducto(uid: string, id: string) {
    const producto = productos.find(p => p.id === id)
    if (!producto) {
      setItem(uid, { producto_id: id })
      return
    }
    setItem(uid, {
      producto_id: id,
      descripcion: producto.nombre,
      precio_unitario_usd: String(producto.precio_neto),
      alicuota_iva: String(producto.alicuota_iva),
    })
  }

  function addItem() {
    setForm(f => ({ ...f, items: [...f.items, newItem()] }))
    setErrors(e => ({ ...e, items: undefined }))
  }

  function removeItem(uid: string) {
    setForm(f => ({
      ...f,
      items: f.items.length > 1 ? f.items.filter(item => item.uid !== uid) : f.items,
    }))
    setErrors(e => {
      const next = { ...e }
      Object.keys(next).forEach(key => {
        if (key.startsWith(`item.${uid}.`)) delete next[key]
      })
      return next
    })
  }

  const tcNum = parseDecimal(form.tipo_cambio)
  const itemsCalculados = useMemo(() => {
    return form.items.map(item => {
      const cantidad = parseDecimal(item.cantidad)
      const precioUnitario = parseDecimal(item.precio_unitario_usd)
      const iva = parseDecimal(item.alicuota_iva)
      const cantidadValida = Number.isFinite(cantidad) && cantidad > 0
      const precioValido = Number.isFinite(precioUnitario) && precioUnitario >= 0
      const subtotal = cantidadValida && precioValido ? round2(cantidad * precioUnitario) : 0
      const ivaImporte = Number.isFinite(iva) && iva > 0 ? round2(subtotal * iva / 100) : 0
      return {
        cantidad,
        precioUnitario,
        iva,
        subtotal,
        ivaImporte,
        total: round2(subtotal + ivaImporte),
      }
    })
  }, [form.items])

  const subtotalUsd = round2(itemsCalculados.reduce((sum, item) => sum + item.subtotal, 0))
  const ivaUsd = round2(itemsCalculados.reduce((sum, item) => sum + item.ivaImporte, 0))
  const totalUsd = round2(itemsCalculados.reduce((sum, item) => sum + item.total, 0))
  const arsCalculado =
    totalUsd > 0 && Number.isFinite(tcNum) && tcNum > 0
      ? round2(totalUsd * tcNum)
      : 0

  const validate = (): boolean => {
    const errs: Record<string, string> = {}
    if (!form.proveedor_id && !form.proveedor.trim()) errs.proveedor_id = 'Seleccioná un proveedor'
    if (!form.fecha) errs.fecha = 'Requerido'
    if (form.items.length === 0) errs.items = 'Agrega al menos un item'
    form.items.forEach((item, idx) => {
      const calc = itemsCalculados[idx]
      if (!Number.isFinite(calc.cantidad) || calc.cantidad <= 0) {
        errs[itemErrorKey(item.uid, 'cantidad')] = 'Cantidad invalida'
      }
      if (!Number.isFinite(calc.precioUnitario) || calc.precioUnitario < 0) {
        errs[itemErrorKey(item.uid, 'precio_unitario_usd')] = 'Precio invalido'
      }
      if (!Number.isFinite(calc.iva) || calc.iva < 0) {
        errs[itemErrorKey(item.uid, 'alicuota_iva')] = 'IVA invalido'
      }
    })
    if (totalUsd <= 0) errs.items = 'El total debe ser mayor a cero'
    if (!Number.isFinite(tcNum) || tcNum <= 0) errs.tipo_cambio = 'Tipo de cambio inválido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const items: PedidoItem[] = form.items.map((item, idx) => {
        const producto = productos.find(p => p.id === item.producto_id)
        const calc = itemsCalculados[idx]
        return {
          producto_id: item.producto_id || null,
          codigo: producto?.codigo ?? null,
          descripcion: item.descripcion.trim() || producto?.nombre || `Item ${idx + 1}`,
          cantidad: calc.cantidad,
          unidad_medida: producto?.unidad_medida ?? 'unidad',
          precio_unitario: calc.precioUnitario,
          bonificacion: 0,
          alicuota_iva: calc.iva,
          subtotal: calc.subtotal,
          iva_importe: calc.ivaImporte,
          total: calc.total,
        }
      })
      const data = {
        numero: pedido ? form.numero.trim() : '',
        proveedor: form.proveedor.trim(),
        proveedor_id: form.proveedor_id || null,
        fecha: form.fecha,
        fecha_vencimiento: form.fecha_vencimiento || null,
        estado: (pedido?.estado ?? 'pendiente') as EstadoPedidoCompra,
        monto_total: arsCalculado,
        monto_total_usd: totalUsd,
        tipo_cambio: tcNum,
        descripcion: form.descripcion.trim() || null,
        items,
        notas: form.notas.trim() || null,
      }
      if (pedido) {
        await actualizarPedidoCompra(pedido.id, data)
        toast.success('Pedido actualizado')
      } else {
        await crearPedidoCompra(data)
        toast.success('Pedido creado')
      }
      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={pedido ? 'Editar pedido de compra' : 'Nuevo pedido de compra'} size="xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Numero"
            placeholder="Se asigna automaticamente al guardar"
            value={pedido ? form.numero : 'Automatico'}
            disabled
            hint={pedido ? 'Numero asignado por el sistema' : 'El sistema generara la proxima OC disponible'}
          />
          <Select
            label="Proveedor"
            value={form.proveedor_id}
            onChange={e => pickProveedor(e.target.value)}
            error={errors.proveedor_id}
            required
          >
            <option value="">— Seleccioná un proveedor —</option>
            {proveedores.map(p => (
              <option key={p.id} value={p.id}>{p.razon_social}</option>
            ))}
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <Input label="Fecha" type="date" value={form.fecha} onChange={e => set('fecha', e.target.value)} error={errors.fecha} required />
          <Input label="Vencimiento (opcional)" type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} />
        </div>
        <div className="grid grid-cols-[1fr_220px] gap-4">
          <div>
          <Input label="Descripcion (opcional)" placeholder="Descripcion del pedido" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
          </div>
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
                : 'Cotizacion global'
            }
            required
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Items</p>
            <Button type="button" size="sm" variant="secondary" onClick={addItem}>
              <Plus size={14} /> Agregar item
            </Button>
          </div>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[840px] text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Producto / descripcion</th>
                  <th className="px-3 py-2 text-right font-medium w-24">Cantidad</th>
                  <th className="px-3 py-2 text-right font-medium w-36">Precio USD</th>
                  <th className="px-3 py-2 text-right font-medium w-28">IVA</th>
                  <th className="px-3 py-2 text-right font-medium w-32">Total</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {form.items.map((item, idx) => {
                  const calc = itemsCalculados[idx]
                  return (
                    <tr key={item.uid} className="align-top">
                      <td className="px-3 py-3">
                        <div className="space-y-2">
                          <Select
                            aria-label="Producto"
                            value={item.producto_id}
                            onChange={e => pickProducto(item.uid, e.target.value)}
                          >
                            <option value="">Manual / sin producto</option>
                            {productos.map(p => (
                              <option key={p.id} value={p.id}>{p.nombre}</option>
                            ))}
                          </Select>
                          <Input
                            aria-label="Descripcion"
                            placeholder="Descripcion del item"
                            value={item.descripcion}
                            onChange={e => setItem(item.uid, { descripcion: e.target.value })}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          aria-label="Cantidad"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.cantidad}
                          onChange={e => setItem(item.uid, { cantidad: e.target.value })}
                          error={errors[itemErrorKey(item.uid, 'cantidad')]}
                          required
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Input
                          aria-label="Precio unitario USD"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={item.precio_unitario_usd}
                          onChange={e => setItem(item.uid, { precio_unitario_usd: e.target.value })}
                          error={errors[itemErrorKey(item.uid, 'precio_unitario_usd')]}
                          required
                        />
                      </td>
                      <td className="px-3 py-3">
                        <Select
                          aria-label="IVA"
                          value={item.alicuota_iva}
                          onChange={e => setItem(item.uid, { alicuota_iva: e.target.value })}
                          error={errors[itemErrorKey(item.uid, 'alicuota_iva')]}
                          required
                        >
                          {ALICUOTAS_IVA.map(a => (
                            <option key={a} value={a}>{a}%</option>
                          ))}
                        </Select>
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-white tabular-nums">
                        {formatMoney(calc.total, 'USD')}
                      </td>
                      <td className="px-2 py-3">
                        <button
                          type="button"
                          onClick={() => removeItem(item.uid)}
                          disabled={form.items.length === 1}
                          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger disabled:cursor-not-allowed disabled:opacity-30"
                          aria-label="Eliminar item"
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {errors.items && <p className="text-xs text-danger">{errors.items}</p>}
        </div>
        <div className="hidden">
          <Select
            label="IVA"
            value={form.items[0]?.alicuota_iva ?? '21'}
            onChange={e => form.items[0] && setItem(form.items[0].uid, { alicuota_iva: e.target.value })}
            error={form.items[0] ? errors[itemErrorKey(form.items[0].uid, 'alicuota_iva')] : undefined}
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
        <div className="hidden">
          <Input label="Descripción (opcional)" placeholder="Descripción del pedido" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
        </div>
        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total calculado</p>
          <p className="mt-1 font-semibold text-white">{formatMoney(totalUsd, 'USD')}</p>
          <p className="text-xs text-muted-foreground">
            Neto {formatMoney(subtotalUsd, 'USD')} + IVA {formatMoney(ivaUsd, 'USD')}
          </p>
          {arsCalculado > 0 && (
            <p className="text-xs text-muted-foreground">ARS {formatMoney(arsCalculado)}</p>
          )}
        </div>
        <Textarea label="Notas internas (opcional)" placeholder="Observaciones, condiciones, etc." value={form.notas} onChange={e => set('notas', e.target.value)} />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>{pedido ? 'Guardar cambios' : 'Crear pedido'}</Button>
        </div>
      </form>
    </Dialog>
  )
}

// ─── Página ───────────────────────────────────────────────────────────────────

export function PedidosCompra() {
  const [filtros, setFiltros] = useState<Filtros>({ estado: '', proveedor: '', fechaDesde: '', fechaHasta: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const [editando, setEditando] = useState<PedidoCompra | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [expandido, setExpandido] = useState<string | null>(null)

  const pedidos = usePedidosCompra({
    estado: filtros.estado || undefined,
    proveedor: filtros.proveedor || undefined,
    fechaDesde: filtros.fechaDesde || undefined,
    fechaHasta: filtros.fechaHasta || undefined,
  })

  const setFiltro = <K extends keyof Filtros>(k: K, v: Filtros[K]) =>
    setFiltros(f => ({ ...f, [k]: v }))

  const hayFiltros = !!(filtros.estado || filtros.proveedor || filtros.fechaDesde || filtros.fechaHasta)

  const lista = pedidos ?? []

  const vencidos = lista.filter(p =>
    p.estado !== 'cancelado' && p.estado !== 'pagado_total' && estaVencido(p.fecha_vencimiento)
  ).length

  const proximos = lista.filter(p =>
    p.estado !== 'cancelado' && p.estado !== 'pagado_total' &&
    !estaVencido(p.fecha_vencimiento) && venceProximamente(p.fecha_vencimiento)
  ).length

  const handleDelete = async (id: string) => {
    try {
      await eliminarPedidoCompra(id)
      toast.success('Pedido eliminado')
    } catch {
      toast.error('Error al eliminar')
    } finally {
      setConfirmDelete(null)
    }
  }

  const handleCancelar = async (p: PedidoCompra) => {
    try {
      await actualizarPedidoCompra(p.id, { estado: 'cancelado' })
      toast.success('Pedido cancelado')
    } catch {
      toast.error('Error al cancelar')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">Pedidos de compra</h1>
          <p className="text-sm text-muted-foreground">Órdenes de compra y pagos a proveedores</p>
        </div>
        <Button onClick={() => { setEditando(null); setModalOpen(true) }}>
          <Plus size={16} className="mr-1" /> Nuevo pedido
        </Button>
      </div>

      {(vencidos > 0 || proximos > 0) && (
        <div className="flex gap-3 flex-wrap">
          {vencidos > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-danger">
              <AlertTriangle size={14} />
              {vencidos} pedido{vencidos > 1 ? 's' : ''} vencido{vencidos > 1 ? 's' : ''}
            </div>
          )}
          {proximos > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
              <Clock size={14} />
              {proximos} vence{proximos > 1 ? 'n' : ''} esta semana
            </div>
          )}
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface/90 p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select label="Estado" value={filtros.estado} onChange={e => setFiltro('estado', e.target.value as EstadoPedidoCompra | '')}>
            <option value="">Todos</option>
            {(Object.keys(ESTADO_COMPRA_CONFIG) as EstadoPedidoCompra[]).map(k => (
              <option key={k} value={k}>{ESTADO_COMPRA_CONFIG[k].label}</option>
            ))}
          </Select>
          <Input label="Proveedor / número" placeholder="Buscar..." value={filtros.proveedor} onChange={e => setFiltro('proveedor', e.target.value)} />
          <Input label="Desde" type="date" value={filtros.fechaDesde} onChange={e => setFiltro('fechaDesde', e.target.value)} />
          <Input label="Hasta" type="date" value={filtros.fechaHasta} onChange={e => setFiltro('fechaHasta', e.target.value)} />
        </div>
        {hayFiltros && (
          <button onClick={() => setFiltros({ estado: '', proveedor: '', fechaDesde: '', fechaHasta: '' })} className="mt-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-white transition-colors">
            <X size={12} /> Limpiar filtros
          </button>
        )}
      </div>

      <div className="rounded-xl border border-border bg-surface/90 overflow-hidden shadow-xl shadow-black/10">
        {pedidos === undefined ? (
          <SkeletonTable rows={5} />
        ) : pedidos.length === 0 ? (
          <EmptyState
            icon={Truck}
            titulo="Sin pedidos de compra"
            descripcion={hayFiltros ? 'Ningún pedido coincide con los filtros.' : 'Creá tu primer pedido de compra.'}
          />
        ) : (
          <table className="w-full">
            <thead className="border-b border-border bg-surface-2/50">
              <tr className="text-xs text-muted-foreground">
                <th className="w-8" />
                <th className="px-4 py-3 text-left font-medium">Número</th>
                <th className="px-4 py-3 text-left font-medium">Proveedor</th>
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
                const cfg = ESTADO_COMPRA_CONFIG[p.estado] ?? { label: p.estado, color: '#6b7280' }
                const vencido = estaVencido(p.fecha_vencimiento) && p.estado !== 'cancelado' && p.estado !== 'pagado_total'
                const proxVencer = !vencido && venceProximamente(p.fecha_vencimiento) && p.estado !== 'cancelado' && p.estado !== 'pagado_total'
                const isExpanded = expandido === p.id
                return (
                  <React.Fragment key={p.id}>
                    <tr className="hover:bg-surface-2/30 transition-colors">
                      <td className="pl-3">
                        <button type="button" onClick={() => setExpandido(prev => prev === p.id ? null : p.id)} className="text-muted-foreground hover:text-white transition-colors">
                          {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>
                      </td>
                      <td className="px-4 py-3"><span className="font-mono text-sm text-white">{p.numero}</span></td>
                      <td className="px-4 py-3 text-sm text-white">{p.proveedor}</td>
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
                            { id: 'editar', label: 'Editar', icon: Edit2, onClick: () => { setEditando(p); setModalOpen(true) } },
                            ...(p.estado !== 'cancelado' ? [{ id: 'cancelar', label: 'Cancelar', icon: X, onClick: () => handleCancelar(p) }] : []),
                            { id: 'eliminar', label: 'Eliminar', icon: Trash2, onClick: () => setConfirmDelete(p.id), tone: 'danger' as const },
                          ]}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="bg-surface-2/20">
                        <td colSpan={9}><FilaDetalle id={p.id} /></td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <PedidoCompraModal
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
        onConfirm={() => { if (confirmDelete) handleDelete(confirmDelete) }}
        onClose={() => setConfirmDelete(null)}
      />
    </div>
  )
}
