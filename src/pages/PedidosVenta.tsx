import React, { useState, useEffect } from 'react'
import { Plus, AlertTriangle, Clock, ChevronDown, ChevronRight, Trash2, Edit2, X, ShoppingCart } from 'lucide-react'
import {
  usePedidosVenta,
  crearPedidoVenta,
  actualizarPedidoVenta,
  eliminarPedidoVenta,
  usePedidoVentaDetalle,
} from '@/hooks/usePedidos'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { formatMoney, formatDate } from '@/lib/formatters'
import {
  ESTADO_VENTA_CONFIG,
  calcularSaldoPendiente,
  estaVencido,
  venceProximamente,
} from '@/lib/vinculos'
import { toast } from 'sonner'
import type { EstadoPedidoVenta, PedidoVenta } from '@/db/schema'

// ─── Tipos locales ────────────────────────────────────────────────────────────

interface Filtros {
  estado: EstadoPedidoVenta | ''
  cliente: string
  fechaDesde: string
  fechaHasta: string
}

interface FormState {
  numero: string
  cliente: string
  fecha: string
  fecha_vencimiento: string
  monto_total: string
  monto_total_usd: string
  descripcion: string
  notas: string
}

const INITIAL_FORM: FormState = {
  numero: '',
  cliente: '',
  fecha: new Date().toISOString().split('T')[0],
  fecha_vencimiento: '',
  monto_total: '',
  monto_total_usd: '',
  descripcion: '',
  notas: '',
}

// ─── Sub-componente: fila expandible ─────────────────────────────────────────

function FilaDetalle({ id }: { id: string }) {
  const detalle = usePedidoVentaDetalle(id)
  if (!detalle) return (
    <div className="py-4 text-center text-sm text-muted-foreground">Cargando...</div>
  )
  const { pedido, vinculos } = detalle
  const totalCobrado = vinculos.reduce((s, v) => s + v.monto_aplicado, 0)
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
  const [form, setForm] = useState<FormState>(INITIAL_FORM)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (pedido) {
      setForm({
        numero: pedido.numero,
        cliente: pedido.cliente,
        fecha: pedido.fecha,
        fecha_vencimiento: pedido.fecha_vencimiento ?? '',
        monto_total: String(pedido.monto_total),
        monto_total_usd: pedido.monto_total_usd ? String(pedido.monto_total_usd) : '',
        descripcion: pedido.descripcion ?? '',
        notas: pedido.notas ?? '',
      })
    } else {
      setForm(INITIAL_FORM)
    }
    setErrors({})
  }, [open, pedido?.id])

  const set = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const errs: Partial<Record<keyof FormState, string>> = {}
    if (!form.numero.trim()) errs.numero = 'Requerido'
    if (!form.cliente.trim()) errs.cliente = 'Requerido'
    if (!form.fecha) errs.fecha = 'Requerido'
    if (!form.monto_total || isNaN(Number(form.monto_total)) || Number(form.monto_total) <= 0) {
      errs.monto_total = 'Monto inválido'
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const data = {
        numero: form.numero.trim(),
        cliente: form.cliente.trim(),
        fecha: form.fecha,
        fecha_vencimiento: form.fecha_vencimiento || null,
        estado: (pedido?.estado ?? 'pendiente') as EstadoPedidoVenta,
        monto_total: Number(form.monto_total),
        monto_total_usd: form.monto_total_usd ? Number(form.monto_total_usd) : null,
        descripcion: form.descripcion.trim() || null,
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
    <Dialog open={open} onClose={onClose} title={pedido ? 'Editar pedido de venta' : 'Nuevo pedido de venta'} size="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Número / referencia"
            placeholder="PV-2025-0001"
            value={form.numero}
            onChange={e => set('numero', e.target.value)}
            error={errors.numero}
            required
          />
          <Input
            label="Cliente"
            placeholder="Nombre del cliente"
            value={form.cliente}
            onChange={e => set('cliente', e.target.value)}
            error={errors.cliente}
            required
          />
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
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Monto total (ARS)"
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={form.monto_total}
            onChange={e => set('monto_total', e.target.value)}
            error={errors.monto_total}
            required
          />
          <Input
            label="Monto USD (opcional)"
            type="number"
            min="0"
            step="0.01"
            placeholder="USD 0.00"
            value={form.monto_total_usd}
            onChange={e => set('monto_total_usd', e.target.value)}
          />
        </div>
        <Input
          label="Descripción (opcional)"
          placeholder="Descripción del pedido"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
        />
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
          <SkeletonTable rows={5} cols={5} />
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
                <th className="px-4 py-3 text-right font-medium">Total</th>
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
                    <tr className="hover:bg-surface-2/30 transition-colors">
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
                        <span className="font-mono text-sm text-white">{p.numero}</span>
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
                      <td className="px-4 py-3 text-right text-sm font-semibold text-white">{formatMoney(p.monto_total)}</td>
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
                        <td colSpan={8}>
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
        description="Esta acción eliminará el pedido y todos sus vínculos. No se puede deshacer."
        confirmLabel="Eliminar"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  )
}
