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
  producto_id: string
  cantidad: string
  precio_unitario_usd: string
  alicuota_iva: string
  tipo_cambio: string
  descripcion: string
  notas: string
}

const INITIAL_FORM: FormState = {
  numero: '',
  proveedor_id: '',
  proveedor: '',
  fecha: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
  producto_id: '',
  cantidad: '1',
  precio_unitario_usd: '',
  alicuota_iva: '21',
  tipo_cambio: '',
  descripcion: '',
  notas: '',
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
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

  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    setErrors({})
    if (pedido) {
      const proveedorId = pedido.proveedor_id ?? ''
      const tcPedido = pedido.tipo_cambio
      const item = pedido.items?.[0]
      const ivaFallback = 0
      const totalUsd = Number(pedido.monto_total_usd ?? 0)
      const precioFallback = totalUsd > 0 ? totalUsd : 0
      setForm({
        numero: pedido.numero,
        proveedor_id: proveedorId,
        proveedor: pedido.proveedor ?? '',
        fecha: pedido.fecha,
        fecha_vencimiento: pedido.fecha_vencimiento ?? '',
        producto_id: item?.producto_id ?? '',
        cantidad: String(item?.cantidad ?? 1),
        precio_unitario_usd: String(item?.precio_unitario ?? (precioFallback || '')),
        alicuota_iva: String(item?.alicuota_iva ?? ivaFallback),
        tipo_cambio: tcPedido != null ? String(tcPedido) : String(cotizacionGlobal || ''),
        descripcion: item?.descripcion ?? pedido.descripcion ?? '',
        notas: pedido.notas ?? '',
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

  function pickProveedor(id: string) {
    const proveedor = proveedores.find(p => p.id === id)
    setForm(f => ({
      ...f,
      proveedor_id: id,
      proveedor: proveedor ? proveedor.razon_social : f.proveedor,
    }))
    setErrors(e => ({ ...e, proveedor: undefined, proveedor_id: undefined }))
  }

  function pickProducto(id: string) {
    const producto = productos.find(p => p.id === id)
    setForm(f => ({
      ...f,
      producto_id: id,
      descripcion: producto ? producto.nombre : f.descripcion,
      precio_unitario_usd: producto ? String(producto.precio_neto) : f.precio_unitario_usd,
      alicuota_iva: producto ? String(producto.alicuota_iva) : f.alicuota_iva,
    }))
    setErrors(e => ({ ...e, producto_id: undefined, precio_unitario_usd: undefined, alicuota_iva: undefined }))
  }

  const cantidadNum = Number(form.cantidad.replace(',', '.'))
  const precioUnitarioNum = Number(form.precio_unitario_usd.replace(',', '.'))
  const ivaNum = Number(form.alicuota_iva)
  const tcNum = Number(form.tipo_cambio.replace(',', '.'))
  const subtotalUsd =
    Number.isFinite(cantidadNum) && cantidadNum > 0 && Number.isFinite(precioUnitarioNum) && precioUnitarioNum >= 0
      ? round2(cantidadNum * precioUnitarioNum)
      : 0
  const ivaUsd = Number.isFinite(ivaNum) && ivaNum > 0 ? round2(subtotalUsd * ivaNum / 100) : 0
  const totalUsd = round2(subtotalUsd + ivaUsd)
  const arsCalculado =
    totalUsd > 0 && Number.isFinite(tcNum) && tcNum > 0
      ? round2(totalUsd * tcNum)
      : 0

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.numero.trim()) errs.numero = 'Requerido'
    if (!form.proveedor_id && !form.proveedor.trim()) errs.proveedor_id = 'Seleccioná un proveedor'
    if (!form.fecha) errs.fecha = 'Requerido'
    if (!Number.isFinite(cantidadNum) || cantidadNum <= 0) errs.cantidad = 'Cantidad invalida'
    if (!Number.isFinite(precioUnitarioNum) || precioUnitarioNum < 0) errs.precio_unitario_usd = 'Precio invalido'
    if (!Number.isFinite(ivaNum) || ivaNum < 0) errs.alicuota_iva = 'IVA invalido'
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
      const item: PedidoItem = {
        producto_id: form.producto_id || null,
        codigo: producto?.codigo ?? null,
        descripcion: form.descripcion.trim() || producto?.nombre || `Orden ${form.numero.trim()}`,
        cantidad: cantidadNum,
        unidad_medida: producto?.unidad_medida ?? 'unidad',
        precio_unitario: precioUnitarioNum,
        bonificacion: 0,
        alicuota_iva: ivaNum,
        subtotal: subtotalUsd,
        iva_importe: ivaUsd,
        total: totalUsd,
      }
      const data = {
        numero: form.numero.trim(),
        proveedor: form.proveedor.trim(),
        proveedor_id: form.proveedor_id || null,
        fecha: form.fecha,
        fecha_vencimiento: form.fecha_vencimiento || null,
        estado: (pedido?.estado ?? 'pendiente') as EstadoPedidoCompra,
        monto_total: arsCalculado,
        monto_total_usd: totalUsd,
        tipo_cambio: tcNum,
        descripcion: form.descripcion.trim() || null,
        items: [item],
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
    <Dialog open={open} onClose={onClose} title={pedido ? 'Editar pedido de compra' : 'Nuevo pedido de compra'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input label="Número / referencia" placeholder="OC-2025-0001" value={form.numero} onChange={e => set('numero', e.target.value)} error={errors.numero} required />
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
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Producto / orden"
            value={form.producto_id}
            onChange={e => pickProducto(e.target.value)}
          >
            <option value="">Manual / sin producto</option>
            {productos.map(p => (
              <option key={p.id} value={p.id}>{p.nombre}</option>
            ))}
          </Select>
          <Input
            label="Cantidad"
            type="number"
            min="0"
            step="0.01"
            value={form.cantidad}
            onChange={e => set('cantidad', e.target.value)}
            error={errors.cantidad}
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
            hint={`Total ${formatMoney(totalUsd, 'USD')} con IVA`}
            required
          />
          <Select
            label="IVA"
            value={form.alicuota_iva}
            onChange={e => set('alicuota_iva', e.target.value)}
            error={errors.alicuota_iva}
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
        <Input label="Descripción (opcional)" placeholder="Descripción del pedido" value={form.descripcion} onChange={e => set('descripcion', e.target.value)} />
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
