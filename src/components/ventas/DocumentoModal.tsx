import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ClipboardList, Plus, Search, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { getConfiguracion } from '@/db/queries'
import { useAuth } from '@/lib/auth'
import { useClientes, useProductos, useProveedores } from '@/hooks/useCatalogo'
import { useCuentas } from '@/hooks/useCuentas'
import {
  crearDocumento,
  actualizarDocumento,
  useDocumentoItems,
} from '@/hooks/useDocumentos'
import { useMovimiento } from '@/hooks/useMovimientos'
import { calcularTotales, type ItemDraft } from '@/lib/documentos'
import { METODOS_PAGO } from '@/lib/constants'
import { cn, formatDateTime, formatMoney, todayStr } from '@/lib/formatters'
import { ImportarDesdePedidoDialog } from '@/components/ventas/ImportarDesdePedidoDialog'
import type {
  Documento,
  TipoDocumentoComercial,
  EstadoDocumento,
  Cliente,
  MetodoPago,
  Producto,
  Proveedor,
  TipoOperacion,
} from '@/db/schema'

type TipoDocumentoForm = 'presupuesto' | 'pedido' | 'remito' | 'factura' | 'nota_credito' | 'nota_debito'

const TIPOS_DOCUMENTO: { value: TipoDocumentoForm; label: string }[] = [
  { value: 'presupuesto', label: 'Presupuesto' },
  { value: 'pedido', label: 'Pedido' },
  { value: 'remito', label: 'Remito' },
  { value: 'factura', label: 'Factura' },
  { value: 'nota_credito', label: 'Nota de credito' },
  { value: 'nota_debito', label: 'Nota de debito' },
]

const TIPOS_CON_CAJA = new Set<TipoDocumentoForm>(['factura', 'nota_credito', 'nota_debito'])
const TIPOS_DOCUMENTO_BASE = TIPOS_DOCUMENTO.filter(t => !['nota_credito', 'nota_debito'].includes(t.value))

interface DocumentoModalProps {
  open: boolean
  onClose: () => void
  documento: Documento | null
  tipoOperacion?: TipoOperacion
}

interface DocumentoEditorPanelProps {
  documento: Documento | null
  tipoOperacion?: TipoOperacion
  onCancel: () => void
  onSaved?: (documento: Documento | null) => void
  variant?: 'modal' | 'page'
  className?: string
}

interface FormState {
  tipo_documento: TipoDocumentoForm
  contacto_id: string
  fecha: string
  fecha_vencimiento: string
  moneda: 'ARS' | 'USD'
  tipo_cambio: string
  cuenta_id: string
  metodo_pago: MetodoPago
  observaciones: string
  estado: EstadoDocumento
  items: ItemDraft[]
}

function emptyForm(): FormState {
  return {
    tipo_documento: 'presupuesto',
    contacto_id: '',
    fecha: todayStr(),
    fecha_vencimiento: '',
    moneda: 'ARS',
    tipo_cambio: '1',
    cuenta_id: '',
    metodo_pago: 'transferencia',
    observaciones: '',
    estado: 'borrador',
    items: [],
  }
}

function emptyItem(): ItemDraft {
  return {
    producto_id: null,
    codigo: null,
    descripcion: '',
    cantidad: 1,
    unidad_medida: 'unidad',
    precio_unitario: 0,
    bonificacion: 0,
    alicuota_iva: 21,
  }
}

function tituloCaja(tipoDocumento: TipoDocumentoForm, tipoOperacion: TipoOperacion): string {
  if (tipoDocumento === 'nota_credito') {
    return tipoOperacion === 'venta' ? 'Devolucion al cliente' : 'Credito del proveedor'
  }
  if (tipoDocumento === 'nota_debito') {
    return tipoOperacion === 'venta' ? 'Cobro adicional' : 'Pago adicional'
  }
  return tipoOperacion === 'venta' ? 'Cobro de factura' : 'Pago de factura'
}

interface SearchableOption {
  value: string
  label: string
  description?: string | null
}

function SearchableSelect({
  label,
  value,
  options,
  placeholder,
  emptyLabel,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: SearchableOption[]
  placeholder: string
  emptyLabel: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const selected = options.find(option => option.value === value)
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return options.slice(0, 8)
    return options
      .filter(option =>
        option.label.toLowerCase().includes(q) ||
        option.description?.toLowerCase().includes(q)
      )
      .slice(0, 8)
  }, [options, query])

  return (
    <div className="relative flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {label}
      </label>
      <div className="relative">
        <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={open ? query : selected?.label ?? ''}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            setQuery('')
            setOpen(true)
          }}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full rounded-lg border border-border bg-surface-2 px-9 py-2.5 text-sm text-white placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
        />
        {value && !disabled && (
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-surface-3 hover:text-white"
          >
            Limpiar
          </button>
        )}
      </div>
      {open && !disabled && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-lg border border-border bg-surface shadow-xl shadow-black/30">
          <button
            type="button"
            onMouseDown={event => event.preventDefault()}
            onClick={() => {
              onChange('')
              setQuery('')
              setOpen(false)
            }}
            className="w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-surface-2 hover:text-white"
          >
            {emptyLabel}
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-2 text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map(option => (
              <button
                key={option.value}
                type="button"
                onMouseDown={event => event.preventDefault()}
                onClick={() => {
                  onChange(option.value)
                  setQuery('')
                  setOpen(false)
                }}
                className={cn(
                  'w-full px-3 py-2 text-left text-sm transition-colors hover:bg-surface-2',
                  value === option.value ? 'text-primary' : 'text-white'
                )}
              >
                <span className="block font-medium">{option.label}</span>
                {option.description && (
                  <span className="mt-0.5 block text-xs text-muted-foreground">{option.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function DocumentoModal({
  open,
  onClose,
  documento,
  tipoOperacion = 'venta',
}: DocumentoModalProps) {
  const titulo = getDocumentoTitulo(documento, tipoOperacion)

  return (
    <Dialog open={open} onClose={onClose} title={titulo} size="2xl">
      <DocumentoEditorPanel
        documento={documento}
        tipoOperacion={tipoOperacion}
        onCancel={onClose}
        onSaved={() => onClose()}
      />
    </Dialog>
  )
}

export function getDocumentoTitulo(documento: Documento | null, tipoOperacion: TipoOperacion) {
  return documento
    ? `Editar ${documento.tipo_documento} ${documento.numero_interno}`
    : `Nuevo documento de ${tipoOperacion === 'venta' ? 'venta' : 'compra'}`
}

export function DocumentoEditorPanel({
  documento,
  tipoOperacion = 'venta',
  onCancel,
  onSaved,
  variant = 'modal',
  className,
}: DocumentoEditorPanelProps) {
  const { empresa } = useAuth()
  const clientes = useClientes({ soloActivos: true })
  const proveedores = useProveedores({ soloActivos: true })
  const productos = useProductos({ soloActivos: true })
  const cuentas = useCuentas()
  const documentoItems = useDocumentoItems(documento?.id ?? null)
  const movimientoCaja = useMovimiento(documento?.movimiento_id ?? null)
  const contactos = tipoOperacion === 'venta' ? clientes : proveedores

  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cotizacionUsdUpdatedAt, setCotizacionUsdUpdatedAt] = useState<string | null>(null)
  const [importPedidoOpen, setImportPedidoOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      getConfiguracion('cotizacion_usd'),
      getConfiguracion('cotizacion_usd_updated_at'),
    ]).then(([cotizacion, updatedAt]) => {
      if (!documento && cotizacion) {
        setForm(prev => prev.tipo_cambio === '1' ? { ...prev, tipo_cambio: cotizacion } : prev)
      }
      if (updatedAt) setCotizacionUsdUpdatedAt(updatedAt)
    }).catch(error => {
      console.error('No se pudo cargar cotizacion USD', error)
    })
  }, [documento?.id])

  useEffect(() => {
    if (documento) {
      setForm({
        tipo_documento: documento.tipo_documento as TipoDocumentoForm,
        contacto_id: documento.cliente_id ?? documento.proveedor_id ?? '',
        fecha: documento.fecha,
        fecha_vencimiento: documento.fecha_vencimiento ?? '',
        moneda: documento.moneda,
        tipo_cambio: String(documento.tipo_cambio),
        cuenta_id: documento.cuenta_id ?? '',
        metodo_pago: movimientoCaja?.metodo_pago ?? 'transferencia',
        observaciones: documento.observaciones ?? '',
        estado: documento.estado,
        items: [],  // los carga el effect siguiente cuando llegan
      })
    } else {
      setForm(emptyForm())
    }
    setError(null)
  }, [documento?.id, tipoOperacion])

  useEffect(() => {
    if (!documento || !movimientoCaja) return
    setForm(prev => ({
      ...prev,
      cuenta_id: movimientoCaja.cuenta_id,
      metodo_pago: movimientoCaja.metodo_pago,
    }))
  }, [documento?.id, movimientoCaja?.id])

  // Cargar items existentes en el form al editar
  useEffect(() => {
    if (!documento || !documentoItems) return
    setForm(prev => ({
      ...prev,
      items: documentoItems.map(it => ({
        producto_id: it.producto_id,
        codigo: it.codigo,
        descripcion: it.descripcion,
        cantidad: it.cantidad,
        unidad_medida: it.unidad_medida,
        precio_unitario: it.precio_unitario,
        bonificacion: it.bonificacion,
        alicuota_iva: it.alicuota_iva,
      })),
    }))
  }, [documento?.id, documentoItems?.length])

  const productosMap = useMemo(
    () => new Map((productos ?? []).map(p => [p.id, p])),
    [productos]
  )
  const contactoOptions = useMemo(
    () => (contactos ?? []).map((c: Cliente | Proveedor) => ({
      value: c.id,
      label: c.razon_social,
      description: [c.numero_documento, c.email].filter(Boolean).join(' - '),
    })),
    [contactos]
  )
  const productoOptions = useMemo(
    () => (productos ?? []).map(p => ({
      value: p.id,
      label: p.nombre,
      description: [p.codigo, formatMoney(p.precio_neto)].filter(Boolean).join(' - '),
    })),
    [productos]
  )
  const tiposDocumentoDisponibles = useMemo(() => {
    if (documento?.tipo_documento === 'nota_credito' || documento?.tipo_documento === 'nota_debito') {
      return TIPOS_DOCUMENTO
    }
    return TIPOS_DOCUMENTO_BASE
  }, [documento?.tipo_documento])

  const totales = useMemo(() => calcularTotales(form.items).totales, [form.items])
  const esNota = form.tipo_documento === 'nota_credito' || form.tipo_documento === 'nota_debito'

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function updateItem(idx: number, patch: Partial<ItemDraft>) {
    setForm(prev => ({
      ...prev,
      items: prev.items.map((it, i) => (i === idx ? { ...it, ...patch } : it)),
    }))
  }

  function pickProducto(idx: number, productoId: string) {
    if (!productoId) {
      updateItem(idx, { producto_id: null })
      return
    }
    const p = productosMap.get(productoId)
    if (!p) return
    updateItem(idx, {
      producto_id: p.id,
      codigo: p.codigo,
      descripcion: p.nombre,
      unidad_medida: p.unidad_medida,
      precio_unitario: p.precio_neto,
      alicuota_iva: p.alicuota_iva,
    })
  }

  function addItem(producto?: Producto) {
    const base = emptyItem()
    if (producto) {
      base.producto_id = producto.id
      base.codigo = producto.codigo
      base.descripcion = producto.nombre
      base.unidad_medida = producto.unidad_medida
      base.precio_unitario = producto.precio_neto
      base.alicuota_iva = producto.alicuota_iva
    }
    setForm(prev => ({ ...prev, items: [...prev.items, base] }))
  }

  function removeItem(idx: number) {
    setForm(prev => ({ ...prev, items: prev.items.filter((_, i) => i !== idx) }))
  }

  function handleImportFromPedido(itemsImportados: ItemDraft[], contactoId: string | null) {
    setForm(prev => ({
      ...prev,
      contacto_id: prev.contacto_id || (contactoId ?? prev.contacto_id),
      items: [...prev.items, ...itemsImportados],
    }))
  }

  async function submitDocumento(estadoFinal: EstadoDocumento) {
    if (!empresa) {
      setError('No hay empresa configurada')
      return
    }
    if (form.items.length === 0) {
      setError('Agregá al menos un item')
      return
    }
    if (!form.fecha) {
      setError('La fecha es obligatoria')
      return
    }
    if (form.fecha_vencimiento && form.fecha_vencimiento < form.fecha) {
      setError('El vencimiento no puede ser anterior a la fecha')
      return
    }
    if (form.items.some(it => !it.descripcion.trim())) {
      setError('Todos los items necesitan descripción')
      return
    }
    if (form.items.some(it => Number(it.cantidad) <= 0)) {
      setError('Todos los items necesitan cantidad mayor a cero')
      return
    }
    if (form.items.some(it => Number(it.precio_unitario) < 0)) {
      setError('Los precios no pueden ser negativos')
      return
    }
    if (form.items.some(it => Number(it.bonificacion) < 0 || Number(it.bonificacion) > 100)) {
      setError('Las bonificaciones deben estar entre 0 y 100')
      return
    }
    const tipoCambio = Number(form.tipo_cambio.replace(',', '.'))
    if (form.moneda === 'USD' && (!Number.isFinite(tipoCambio) || tipoCambio <= 0)) {
      setError('El tipo de cambio debe ser mayor a cero')
      return
    }
    if ((form.tipo_documento === 'nota_credito' || form.tipo_documento === 'nota_debito') && !form.contacto_id) {
      setError(`La ${form.tipo_documento === 'nota_credito' ? 'nota de credito' : 'nota de debito'} necesita ${contactoLabel.toLowerCase()}`)
      return
    }
    if ((form.tipo_documento === 'nota_credito' || form.tipo_documento === 'nota_debito') && totales.total <= 0) {
      setError('La nota necesita un total mayor a cero')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const payload = {
        clienteId: tipoOperacion === 'venta' ? form.contacto_id || null : null,
        proveedorId: tipoOperacion === 'compra' ? form.contacto_id || null : null,
        fecha: form.fecha,
        fechaVencimiento: form.fecha_vencimiento || null,
        moneda: form.moneda,
        tipoCambio: Number.isFinite(tipoCambio) && tipoCambio > 0 ? tipoCambio : 1,
        observaciones: form.observaciones.trim() || null,
        cuentaId: TIPOS_CON_CAJA.has(form.tipo_documento) ? form.cuenta_id || null : null,
        metodoPago: form.metodo_pago,
        estado: estadoFinal,
        items: form.items,
      }
      if (documento) {
        await actualizarDocumento({ id: documento.id, ...payload })
        toast.success('Documento actualizado')
        onSaved?.(documento)
      } else {
        const creado = await crearDocumento({
          empresaId: empresa.id,
          tipoOperacion,
          tipoDocumento: form.tipo_documento as TipoDocumentoComercial,
          ...payload,
        })
        toast.success('Documento creado')
        onSaved?.(creado)
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>, estadoFinal: EstadoDocumento) {
    event.preventDefault()
    await submitDocumento(estadoFinal)
  }

  const editable = !documento || documento.estado === 'borrador'
  const contactoLabel = tipoOperacion === 'venta' ? 'Cliente' : 'Proveedor'
  const contactoEmpty = tipoOperacion === 'venta' ? 'Consumidor final' : 'Sin proveedor'
  const cajaLabel = tipoOperacion === 'venta' ? 'Cuenta de cobro' : 'Cuenta de pago'
  const footerClass = variant === 'modal'
    ? '-mx-6 -mb-5 bg-surface/95 px-6'
    : '-mx-4 -mb-4 bg-background/95 px-4 sm:-mx-6 sm:-mb-6 sm:px-6'

  useEffect(() => {
    if (!editable || submitting) return

    function onKeyDown(event: KeyboardEvent) {
      const withModifier = event.ctrlKey || event.metaKey
      if (!withModifier) return

      const key = event.key.toLowerCase()
      if (key === 's') {
        event.preventDefault()
        void submitDocumento('borrador')
      } else if (key === 'enter') {
        event.preventDefault()
        void submitDocumento('confirmado')
      } else if (key === 'i') {
        event.preventDefault()
        addItem()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [editable, submitting, form, empresa, tipoOperacion, documento?.id])

  return (
    <>
      <form className={cn('space-y-5', className)} onSubmit={e => onSubmit(e, form.estado)}>
        {!editable && (
          <div className="rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-sm text-info">
            Este documento esta confirmado o cerrado. Los datos se muestran en modo solo lectura.
          </div>
        )}
        <div className="rounded-xl border border-border bg-surface-2/70 p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Encabezado</p>
              <h3 className="text-sm font-semibold text-white">{tipoOperacion === 'venta' ? 'Documento de venta' : 'Documento de compra'}</h3>
            </div>
            <span className="rounded-md border border-border bg-surface px-2 py-1 text-xs font-medium text-muted-foreground">
              {documento?.estado ?? 'nuevo'}
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <Select
              label="Tipo"
              value={form.tipo_documento}
              onChange={e => update('tipo_documento', e.target.value as TipoDocumentoForm)}
              disabled={!!documento}
            >
              {tiposDocumentoDisponibles.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
            <SearchableSelect
              label={contactoLabel}
              value={form.contacto_id}
              options={contactoOptions}
              placeholder={`Buscar ${contactoLabel.toLowerCase()}...`}
              emptyLabel={contactoEmpty}
              disabled={!editable || esNota}
              onChange={value => update('contacto_id', value)}
            />
            <Input
              label="Fecha"
              type="date"
              value={form.fecha}
              onChange={e => update('fecha', e.target.value)}
              disabled={!editable}
              required
            />
            <Input
              label="Vencimiento"
              type="date"
              value={form.fecha_vencimiento}
              onChange={e => update('fecha_vencimiento', e.target.value)}
              disabled={!editable}
            />
            <Select
              label="Moneda"
              value={form.moneda}
              onChange={e => update('moneda', e.target.value as 'ARS' | 'USD')}
              disabled={!editable || esNota}
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </Select>
            {form.moneda === 'USD' && (
              <Input
                label="Tipo de cambio"
                type="number"
                step="0.01"
                min="0"
                value={form.tipo_cambio}
                onChange={e => update('tipo_cambio', e.target.value)}
                disabled={!editable || esNota}
                hint={cotizacionUsdUpdatedAt
                  ? `Cotizacion actualizada ${formatDateTime(cotizacionUsdUpdatedAt)}`
                  : 'Cotizacion sin fecha de actualizacion'}
              />
            )}
          </div>
        </div>

        {TIPOS_CON_CAJA.has(form.tipo_documento) && (
          <div className="rounded-xl border border-border bg-surface-2/70 p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Caja</p>
                <h3 className="text-sm font-semibold text-white">
                  {tituloCaja(form.tipo_documento, tipoOperacion)}
                </h3>
              </div>
              {documento?.movimiento_id && (
                <span className="rounded-md border border-success/30 bg-success/10 px-2 py-1 text-xs font-medium text-success">
                  Registrado
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Select
                label={cajaLabel}
                value={form.cuenta_id}
                onChange={e => update('cuenta_id', e.target.value)}
                disabled={!editable}
              >
                <option value="">Sin registrar en caja</option>
                {(cuentas ?? []).map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </Select>
              <Select
                label="Metodo"
                value={form.metodo_pago}
                onChange={e => update('metodo_pago', e.target.value as MetodoPago)}
                disabled={!editable || !form.cuenta_id}
              >
                {METODOS_PAGO.map(m => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>
        )}

        <div className="rounded-xl border border-border bg-surface-2/70 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-white">Items</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setImportPedidoOpen(true)}
                disabled={!editable}
              >
                <ClipboardList size={14} />
                Importar de orden
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => addItem()}
                disabled={!editable}
              >
                <Plus size={14} />
                Agregar item
              </Button>
            </div>
          </div>

          {form.items.length === 0 ? (
            <div className="bg-surface-2 border border-dashed border-border rounded-lg p-6 text-center text-sm text-muted-foreground">
              No hay items. Agregá al menos uno.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Producto / descripción</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Cant.</th>
                    <th className="text-right px-3 py-2 font-medium w-28">P. unit.</th>
                    <th className="text-right px-3 py-2 font-medium w-20">Bonif. %</th>
                    <th className="text-right px-3 py-2 font-medium w-20">IVA %</th>
                    <th className="text-right px-3 py-2 font-medium w-28">Subtotal</th>
                    <th className="text-right px-3 py-2 font-medium w-10"></th>
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((it, idx) => {
                    const subtotal = it.cantidad * it.precio_unitario * (1 - it.bonificacion / 100)
                    return (
                      <tr key={idx} className="border-t border-border align-top">
                        <td className="px-3 py-2">
                          <SearchableSelect
                            label="Producto"
                            value={it.producto_id ?? ''}
                            options={productoOptions}
                            placeholder="Buscar producto..."
                            emptyLabel="Manual"
                            disabled={!editable}
                            onChange={value => pickProducto(idx, value)}
                          />
                          <input
                            value={it.descripcion}
                            onChange={e => updateItem(idx, { descripcion: e.target.value })}
                            placeholder="Descripción"
                            disabled={!editable}
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-xs text-white"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.cantidad}
                            onChange={e => updateItem(idx, { cantidad: Number(e.target.value) || 0 })}
                            disabled={!editable}
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-xs text-white text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={it.precio_unitario}
                            onChange={e => updateItem(idx, { precio_unitario: Number(e.target.value) || 0 })}
                            disabled={!editable}
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-xs text-white text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={it.bonificacion}
                            onChange={e => updateItem(idx, { bonificacion: Number(e.target.value) || 0 })}
                            disabled={!editable}
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-xs text-white text-right"
                          />
                        </td>
                        <td className="px-3 py-2 text-right">
                          <select
                            value={it.alicuota_iva}
                            onChange={e => updateItem(idx, { alicuota_iva: Number(e.target.value) })}
                            disabled={!editable}
                            className="w-full bg-surface border border-border rounded-md px-2 py-1 text-xs text-white text-right"
                          >
                            {[0, 2.5, 5, 10.5, 21, 27].map(a => (
                              <option key={a} value={a}>{a}%</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right text-white text-xs">
                          {formatMoney(subtotal, form.moneda)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => removeItem(idx)}
                            disabled={!editable}
                            className="p-1 rounded text-muted-foreground hover:text-danger transition-colors disabled:opacity-30"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_320px]">
          <Textarea
            label="Observaciones"
            value={form.observaciones}
            onChange={e => update('observaciones', e.target.value)}
            disabled={!editable}
          />
          <div className="space-y-2 rounded-xl border border-border bg-surface-2/70 p-4 text-sm">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal neto</span>
              <span className="text-white">{formatMoney(totales.subtotal, form.moneda)}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span>
              <span className="text-white">{formatMoney(totales.iva_total, form.moneda)}</span>
            </div>
            {totales.exento > 0 && (
              <div className="flex justify-between text-muted-foreground">
                <span>Exento</span>
                <span className="text-white">{formatMoney(totales.exento, form.moneda)}</span>
              </div>
            )}
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span className="text-white">Total</span>
              <span className="text-white">{formatMoney(totales.total, form.moneda)}</span>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger">
            {error}
          </div>
        )}

        <div className={cn('sticky bottom-0 flex flex-col justify-end gap-2 border-t border-border py-4 backdrop-blur sm:flex-row', footerClass)}>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={submitting || !editable}
            onClick={() => void submitDocumento('borrador')}
          >
            Guardar borrador
          </Button>
          <Button
            type="button"
            disabled={submitting || !editable}
            onClick={() => void submitDocumento('confirmado')}
          >
            {submitting ? 'Guardando…' : 'Confirmar'}
          </Button>
        </div>
      </form>
      <ImportarDesdePedidoDialog
        open={importPedidoOpen}
        tipoOperacion={tipoOperacion}
        contactoId={form.contacto_id || null}
        onClose={() => setImportPedidoOpen(false)}
        onImport={(_pedido, items, contactoId) => handleImportFromPedido(items, contactoId)}
      />
    </>
  )
}
