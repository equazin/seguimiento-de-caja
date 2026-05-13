import { useState, useEffect, useRef } from 'react'
import { ChevronDown, ChevronUp, Plus, Trash2, Link, Split } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useCategorias } from '@/hooks/useCategorias'
import { useCuentas } from '@/hooks/useCuentas'
import { crearMovimiento, actualizarMovimiento } from '@/hooks/useMovimientos'
import { usePedidosCompra, usePedidosVenta, reemplazarVinculosMovimiento, useVinculos } from '@/hooks/usePedidos'
import { getContactosUsados } from '@/db/queries'
import {
  extraerSplitId,
  limpiarNotaRetencion,
  limpiarNotaSplit,
  obtenerRetencionGanancias,
  serializarNotaRetencion,
  serializarNotaSplit,
  validarVinculos,
} from '@/lib/vinculos'
import { METODOS_PAGO } from '@/lib/constants'
import { todayStr, formatMoney } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Movimiento, TipoMovimiento, MetodoPago, MovimientoVinculo, MonedaCuenta } from '@/db/schema'

interface Props {
  open: boolean
  onClose: () => void
  movimiento?: Movimiento | null
}

interface FormState {
  fecha: string
  tipo: TipoMovimiento
  monto_ars: string
  monto_usd: string
  tipo_cambio: string
  categoria_id: string
  subcategoria: string
  descripcion: string
  contacto: string
  metodo_pago: MetodoPago
  cuenta_id: string
  notas: string
}

interface SplitForm {
  cuenta_id: string
  monto_ars: string
  monto_usd: string
  metodo_pago: MetodoPago
}

const SPLIT_INITIAL: SplitForm = {
  cuenta_id: '',
  monto_ars: '',
  monto_usd: '',
  metodo_pago: 'efectivo',
}

interface VinculoForm {
  pedido_compra_id: string | null
  pedido_venta_id: string | null
  monto_aplicado: string
  retencion_ganancias: string
  notas: string
}

const INITIAL: FormState = {
  fecha: todayStr(),
  tipo: 'egreso',
  monto_ars: '',
  monto_usd: '',
  tipo_cambio: '',
  categoria_id: '',
  subcategoria: '',
  descripcion: '',
  contacto: '',
  metodo_pago: 'transferencia',
  cuenta_id: '',
  notas: '',
}

const VINCULO_VACIO: VinculoForm = {
  pedido_compra_id: null,
  pedido_venta_id: null,
  monto_aplicado: '',
  retencion_ganancias: '',
  notas: '',
}

// ─── Sección de vínculos ──────────────────────────────────────────────────────

interface VinculosSectionProps {
  tipo: TipoMovimiento
  moneda: MonedaCuenta
  montoTotal: number
  vinculos: VinculoForm[]
  onChange: (vinculos: VinculoForm[]) => void
  busqueda: string
  onBusquedaChange: (v: string) => void
}

function VinculosSection({ tipo, moneda, montoTotal, vinculos, onChange, busqueda, onBusquedaChange }: VinculosSectionProps) {
  const pedidosCompra = usePedidosCompra(tipo === 'egreso' ? { proveedor: busqueda } : undefined)
  const pedidosVenta = usePedidosVenta(tipo === 'ingreso' ? { cliente: busqueda } : undefined)

  const pedidosFiltrados = tipo === 'egreso'
    ? (pedidosCompra ?? []).filter(p => p.estado !== 'cancelado' && p.estado !== 'pagado_total')
    : (pedidosVenta ?? []).filter(p => p.estado !== 'cancelado' && p.estado !== 'cobrado_total')

  const agregarVinculo = () => onChange([...vinculos, { ...VINCULO_VACIO }])

  const actualizarVinculo = (i: number, key: keyof VinculoForm, value: string | null) => {
    onChange(vinculos.map((v, idx) => idx === i ? { ...v, [key]: value } : v))
  }

  const eliminarVinculo = (i: number) => onChange(vinculos.filter((_, idx) => idx !== i))

  const validacion = validarVinculos(montoTotal, vinculos.map(v => ({ monto_aplicado: Number(v.monto_aplicado) || 0 })), moneda)
  const sumaVinculos = vinculos.reduce((s, v) => s + (Number(v.monto_aplicado) || 0), 0)
  const sumaRetenciones = vinculos.reduce((s, v) => s + (Number(v.retencion_ganancias) || 0), 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Input
          placeholder={tipo === 'egreso' ? 'Buscar proveedor...' : 'Buscar cliente...'}
          value={busqueda}
          onChange={e => onBusquedaChange(e.target.value)}
        />
        <Button type="button" variant="secondary" onClick={agregarVinculo}>
          <Plus size={14} className="mr-1" /> Vincular
        </Button>
      </div>

      {vinculos.length > 0 && (
        <div className="space-y-2">
          {vinculos.map((v, i) => (
            <div key={i} className="rounded-lg border border-border bg-surface-2 p-3 space-y-2">
              <div className="flex gap-2 items-start">
                <div className="flex-1">
                  <Select
                    label={tipo === 'egreso' ? 'Pedido de compra' : 'Pedido de venta'}
                    value={tipo === 'egreso' ? (v.pedido_compra_id ?? '') : (v.pedido_venta_id ?? '')}
                    onChange={e => {
                      const val = e.target.value || null
                      if (tipo === 'egreso') actualizarVinculo(i, 'pedido_compra_id', val)
                      else actualizarVinculo(i, 'pedido_venta_id', val)
                    }}
                  >
                    <option value="">Seleccionar pedido...</option>
                    {pedidosFiltrados.map(p => {
                      const totalPedido = moneda === 'USD' && p.monto_total_usd != null
                        ? p.monto_total_usd
                        : p.monto_total
                      return (
                        <option key={p.id} value={p.id}>
                          {p.numero} — {tipo === 'egreso' ? (p as any).proveedor : (p as any).cliente} ({formatMoney(totalPedido, moneda)})
                        </option>
                      )
                    })}
                  </Select>
                </div>
                <button
                  type="button"
                  onClick={() => eliminarVinculo(i)}
                  className="mt-6 text-muted-foreground hover:text-danger transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <Input
                  label="Monto aplicado"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={v.monto_aplicado}
                  onChange={e => actualizarVinculo(i, 'monto_aplicado', e.target.value)}
                />
                {tipo === 'ingreso' && (
                  <Input
                    label="Retencion ganancias"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={v.retencion_ganancias}
                    onChange={e => actualizarVinculo(i, 'retencion_ganancias', e.target.value)}
                  />
                )}
                <Input
                  label="Notas (opcional)"
                  placeholder="Referencia, cuota, etc."
                  value={v.notas}
                  onChange={e => actualizarVinculo(i, 'notas', e.target.value)}
                />
              </div>
            </div>
          ))}

          <div className="flex items-center justify-between text-xs px-1">
            <span className="text-muted-foreground">
              Suma vinculada: <span className="text-white font-semibold">{formatMoney(sumaVinculos, moneda)}</span>
              {' '}/{' '}
              <span className="text-muted-foreground">{formatMoney(montoTotal, moneda)}</span>
              {sumaRetenciones > 0 && (
                <span className="text-warning"> + retenciones {formatMoney(sumaRetenciones, moneda)}</span>
              )}
            </span>
            {!validacion.valido && (
              <span className="text-danger">{validacion.error}</span>
            )}
          </div>
        </div>
      )}

      {vinculos.length === 0 && (
        <p className="text-xs text-muted-foreground italic">
          Sin vínculos. Hacé clic en "Vincular" para asociar este movimiento a un pedido.
        </p>
      )}
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────

export function MovimientoModal({ open, onClose, movimiento }: Props) {
  const [form, setForm] = useState<FormState>(INITIAL)
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
  const [loading, setLoading] = useState(false)
  const [contactosSugeridos, setContactosSugeridos] = useState<string[]>([])
  const [showSugerencias, setShowSugerencias] = useState(false)
  const [mostrarVinculos, setMostrarVinculos] = useState(false)
  const [vinculosForm, setVinculosForm] = useState<VinculoForm[]>([])
  const [busquedaVinculo, setBusquedaVinculo] = useState('')
  const [splitActivo, setSplitActivo] = useState(false)
  const [splitForm, setSplitForm] = useState<SplitForm>(SPLIT_INITIAL)
  const contactoRef = useRef<HTMLInputElement>(null)

  const categorias = useCategorias()
  const cuentas = useCuentas()
  const vinculosExistentes = useVinculos(movimiento?.id ?? null)

  const categoriasFiltered = categorias?.filter(c => c.tipo === form.tipo) ?? []
  const cuentaSeleccionada = cuentas?.find(c => c.id === form.cuenta_id)
  const monedaPrincipal: MonedaCuenta = cuentaSeleccionada?.moneda ?? 'ARS'
  const esUSD = monedaPrincipal === 'USD'
  const montoPrincipal = esUSD ? form.monto_usd : form.monto_ars
  const montoPrincipalNum = Number(montoPrincipal) || 0

  const cuentaSplit = cuentas?.find(c => c.id === splitForm.cuenta_id)
  const monedaSplit: MonedaCuenta = cuentaSplit?.moneda ?? 'ARS'
  const splitEsUSD = monedaSplit === 'USD'
  const montoSplit = splitEsUSD ? splitForm.monto_usd : splitForm.monto_ars
  const montoSplitNum = Number(montoSplit) || 0
  const edicionEsSplit = movimiento ? extraerSplitId(movimiento.notas) !== null : false

  useEffect(() => {
    if (!open) return
    if (movimiento) {
      setForm({
        fecha: movimiento.fecha,
        tipo: movimiento.tipo,
        monto_ars: String(movimiento.monto_ars),
        monto_usd: movimiento.monto_usd ? String(movimiento.monto_usd) : '',
        tipo_cambio: movimiento.tipo_cambio ? String(movimiento.tipo_cambio) : '',
        categoria_id: movimiento.categoria_id,
        subcategoria: movimiento.subcategoria ?? '',
        descripcion: movimiento.descripcion,
        contacto: movimiento.contacto ?? '',
        metodo_pago: movimiento.metodo_pago,
        cuenta_id: movimiento.cuenta_id,
        notas: limpiarNotaSplit(movimiento.notas),
      })
    } else {
      setForm(f => ({
        ...INITIAL,
        fecha: todayStr(),
        cuenta_id: cuentas?.[0]?.id ?? '',
      }))
    }
    setErrors({})
    setMostrarVinculos(false)
    setVinculosForm([])
    setBusquedaVinculo('')
    setSplitActivo(false)
    setSplitForm(SPLIT_INITIAL)
    getContactosUsados().then(setContactosSugeridos)
  }, [open, movimiento])

  // Cargar vínculos existentes al editar
  useEffect(() => {
    if (movimiento && vinculosExistentes && mostrarVinculos) {
      setVinculosForm(vinculosExistentes.map(v => ({
        pedido_compra_id: v.pedido_compra_id ?? null,
        pedido_venta_id: v.pedido_venta_id ?? null,
        monto_aplicado: String(v.monto_aplicado),
        retencion_ganancias: obtenerRetencionGanancias(v) > 0 ? String(obtenerRetencionGanancias(v)) : '',
        notas: limpiarNotaRetencion(v.notas),
      })))
    }
  }, [vinculosExistentes, mostrarVinculos])

  useEffect(() => {
    if (!movimiento && cuentas?.length && !form.cuenta_id) {
      setForm(f => ({ ...f, cuenta_id: cuentas[0].id }))
    }
  }, [cuentas])

  useEffect(() => {
    if (categoriasFiltered.length && !movimiento) {
      setForm(f => ({ ...f, categoria_id: categoriasFiltered[0]?.id ?? '' }))
    }
  }, [form.tipo])

  const set = (key: keyof FormState, value: string) => {
    setForm(f => ({ ...f, [key]: value }))
    setErrors(e => ({ ...e, [key]: undefined }))
  }

  const validate = (): boolean => {
    const errs: typeof errors = {}
    if (!form.fecha) errs.fecha = 'Requerido'
    if (esUSD) {
      if (!form.monto_usd || isNaN(Number(form.monto_usd)) || Number(form.monto_usd) <= 0) {
        errs.monto_usd = 'Monto USD inválido'
      }
    } else {
      if (!form.monto_ars || isNaN(Number(form.monto_ars)) || Number(form.monto_ars) <= 0) {
        errs.monto_ars = 'Monto inválido'
      }
    }
    if (!form.descripcion.trim()) errs.descripcion = 'Requerido'
    if (!form.categoria_id) errs.categoria_id = 'Requerido'
    if (!form.cuenta_id) errs.cuenta_id = 'Requerido'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    const montoArs = Number(form.monto_ars)
    const montoUsd = Number(form.monto_usd)
    const montoBaseVinculos = esUSD ? montoUsd : montoArs

    if (splitActivo && !movimiento) {
      if (!splitForm.cuenta_id) {
        toast.error('Seleccioná la segunda cuenta para el pago dividido')
        return
      }
      if (splitForm.cuenta_id === form.cuenta_id) {
        toast.error('La segunda cuenta debe ser distinta a la principal')
        return
      }
      if (montoSplitNum <= 0) {
        toast.error('Ingresá el monto de la segunda cuenta')
        return
      }
    }

    if (mostrarVinculos && vinculosForm.length > 0) {
      const validacion = validarVinculos(montoBaseVinculos, vinculosForm.map(v => ({ monto_aplicado: Number(v.monto_aplicado) || 0 })), monedaPrincipal)
      if (!validacion.valido) {
        toast.error(validacion.error)
        return
      }
      const retencionInvalida = vinculosForm.some(v => {
        const value = Number(v.retencion_ganancias)
        return v.retencion_ganancias.trim() && (!Number.isFinite(value) || value < 0)
      })
      if (retencionInvalida) {
        toast.error('La retencion de ganancias debe ser mayor o igual a cero')
        return
      }
    }

    setLoading(true)
    try {
      const splitId = splitActivo && !movimiento ? uuidv4() : null
      const notasBase = form.notas.trim() || null
      const notasMovimientoPrincipal = splitId
        ? serializarNotaSplit(notasBase, splitId, 1)
        : (notasBase || undefined)

      const data = {
        fecha: form.fecha,
        tipo: form.tipo,
        monto_ars: esUSD ? (form.monto_ars ? montoArs : 0) : montoArs,
        monto_usd: esUSD ? montoUsd : (form.monto_usd ? Number(form.monto_usd) : undefined),
        tipo_cambio: form.tipo_cambio ? Number(form.tipo_cambio) : undefined,
        moneda_principal: monedaPrincipal,
        categoria_id: form.categoria_id,
        subcategoria: form.subcategoria || undefined,
        descripcion: form.descripcion.trim(),
        contacto: form.contacto.trim() || undefined,
        metodo_pago: form.metodo_pago,
        cuenta_id: form.cuenta_id,
        notas: notasMovimientoPrincipal ?? undefined,
      }

      let movimientoId: string
      if (movimiento) {
        await actualizarMovimiento(movimiento.id, data)
        movimientoId = movimiento.id
        toast.success('Movimiento actualizado')
      } else {
        const created = await crearMovimiento(data)
        movimientoId = created.id
        toast.success(splitId ? 'Movimientos creados' : 'Movimiento creado')
      }

      let movimientoSplitId: string | null = null
      if (splitId) {
        const splitMontoArs = splitEsUSD ? 0 : Number(splitForm.monto_ars)
        const splitMontoUsd = splitEsUSD ? Number(splitForm.monto_usd) : undefined
        const splitData = {
          fecha: form.fecha,
          tipo: form.tipo,
          monto_ars: splitMontoArs,
          monto_usd: splitMontoUsd,
          tipo_cambio: form.tipo_cambio ? Number(form.tipo_cambio) : undefined,
          moneda_principal: monedaSplit,
          categoria_id: form.categoria_id,
          subcategoria: form.subcategoria || undefined,
          descripcion: form.descripcion.trim(),
          contacto: form.contacto.trim() || undefined,
          metodo_pago: splitForm.metodo_pago,
          cuenta_id: splitForm.cuenta_id,
          notas: serializarNotaSplit(notasBase, splitId, 2) ?? undefined,
        }
        const createdSplit = await crearMovimiento(splitData)
        movimientoSplitId = createdSplit.id
      }

      if (mostrarVinculos) {
        const nuevosVinculos = vinculosForm
          .filter(v => (
            v.pedido_compra_id ||
            v.pedido_venta_id
          ) && (Number(v.monto_aplicado) > 0 || Number(v.retencion_ganancias) > 0))
          .map(v => ({
            pedido_compra_id: v.pedido_compra_id,
            pedido_venta_id: v.pedido_venta_id,
            monto_aplicado: Number(v.monto_aplicado),
            notas: serializarNotaRetencion(
              v.notas.trim() || null,
              Number(v.retencion_ganancias) || 0
            ),
          }))
        await reemplazarVinculosMovimiento(movimientoId, nuevosVinculos)

        // Si hay split, replicamos vínculo al pedido en el segundo movimiento por el monto del split
        if (movimientoSplitId && nuevosVinculos.length > 0) {
          const splitVinculos = nuevosVinculos.map(v => ({
            pedido_compra_id: v.pedido_compra_id,
            pedido_venta_id: v.pedido_venta_id,
            monto_aplicado: montoSplitNum,
            notas: v.notas,
          }))
          await reemplazarVinculosMovimiento(movimientoSplitId, splitVinculos)
        }
      }

      onClose()
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoading(false)
    }
  }

  const sugerenciasFiltradas = contactosSugeridos.filter(c =>
    c.toLowerCase().includes(form.contacto.toLowerCase()) && form.contacto
  )

  const tieneVinculosExistentes = (vinculosExistentes?.length ?? 0) > 0

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={movimiento ? 'Editar movimiento' : 'Nuevo movimiento'}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Tipo */}
        <div className="flex gap-2">
          {(['egreso', 'ingreso'] as TipoMovimiento[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => set('tipo', t)}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold border transition-all ${
                form.tipo === t
                  ? t === 'ingreso'
                    ? 'bg-success/15 border-success/40 text-success'
                    : 'bg-danger/15 border-danger/40 text-danger'
                  : 'border-border text-muted-foreground hover:bg-surface-2'
              }`}
            >
              {t === 'ingreso' ? '↓ Ingreso' : '↑ Egreso'}
            </button>
          ))}
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
          {esUSD ? (
            <Input
              label="Monto USD"
              type="number"
              min="0"
              step="0.01"
              placeholder="USD 0.00"
              value={form.monto_usd}
              onChange={e => set('monto_usd', e.target.value)}
              error={errors.monto_usd}
              required
            />
          ) : (
            <Input
              label="Monto ARS"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.monto_ars}
              onChange={e => set('monto_ars', e.target.value)}
              error={errors.monto_ars}
              required
            />
          )}
        </div>

        <Input
          label="Descripción"
          placeholder="Descripción del movimiento"
          value={form.descripcion}
          onChange={e => set('descripcion', e.target.value)}
          error={errors.descripcion}
          required
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Categoría"
            value={form.categoria_id}
            onChange={e => set('categoria_id', e.target.value)}
            error={errors.categoria_id}
            required
          >
            <option value="">Seleccionar...</option>
            {categoriasFiltered.map(c => (
              <option key={c.id} value={c.id}>{c.icono} {c.nombre}</option>
            ))}
          </Select>
          <Input
            label="Subcategoría"
            placeholder="Ej: Combustible - GNC"
            value={form.subcategoria}
            onChange={e => set('subcategoria', e.target.value)}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Cuenta"
            value={form.cuenta_id}
            onChange={e => set('cuenta_id', e.target.value)}
            error={errors.cuenta_id}
            required
          >
            <option value="">Seleccionar...</option>
            {cuentas?.map(c => (
              <option key={c.id} value={c.id}>{c.nombre}</option>
            ))}
          </Select>
          <Select
            label="Método de pago"
            value={form.metodo_pago}
            onChange={e => set('metodo_pago', e.target.value as MetodoPago)}
          >
            {METODOS_PAGO.map(m => (
              <option key={m.value} value={m.value}>{m.icono} {m.label}</option>
            ))}
          </Select>
        </div>

        {/* Split: pagar con segunda cuenta */}
        {!movimiento && (
          <div className="rounded-lg border border-border overflow-hidden">
            <button
              type="button"
              onClick={() => setSplitActivo(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:bg-surface-2 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Split size={14} />
                Dividir pago en 2 cuentas
              </span>
              {splitActivo ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            {splitActivo && (
              <div className="border-t border-border p-4 space-y-3">
                <p className="text-xs text-muted-foreground">
                  Se crearán 2 movimientos vinculados con la misma descripción/fecha/contacto.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Segunda cuenta"
                    value={splitForm.cuenta_id}
                    onChange={e => setSplitForm(f => ({ ...f, cuenta_id: e.target.value }))}
                  >
                    <option value="">Seleccionar...</option>
                    {cuentas?.filter(c => c.id !== form.cuenta_id).map(c => (
                      <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
                    ))}
                  </Select>
                  <Select
                    label="Método de pago"
                    value={splitForm.metodo_pago}
                    onChange={e => setSplitForm(f => ({ ...f, metodo_pago: e.target.value as MetodoPago }))}
                  >
                    {METODOS_PAGO.map(m => (
                      <option key={m.value} value={m.value}>{m.icono} {m.label}</option>
                    ))}
                  </Select>
                </div>
                <Input
                  label={`Monto ${monedaSplit}`}
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder={splitEsUSD ? 'USD 0.00' : '0.00'}
                  value={splitEsUSD ? splitForm.monto_usd : splitForm.monto_ars}
                  onChange={e => setSplitForm(f => splitEsUSD
                    ? { ...f, monto_usd: e.target.value }
                    : { ...f, monto_ars: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Total pagado: <span className="text-white font-semibold">
                    {formatMoney(montoPrincipalNum, monedaPrincipal)}
                  </span> + <span className="text-white font-semibold">
                    {formatMoney(montoSplitNum, monedaSplit)}
                  </span>
                </p>
              </div>
            )}
          </div>
        )}
        {edicionEsSplit && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-xs text-muted-foreground flex items-center gap-2">
            <Split size={13} className="text-primary" />
            Este movimiento es parte de un pago dividido. La división se edita eliminando ambos movimientos.
          </div>
        )}

        {/* Contacto con autocompletado */}
        <div className="relative">
          <Input
            ref={contactoRef}
            label="Contacto (cliente/proveedor)"
            placeholder="Nombre del cliente o proveedor"
            value={form.contacto}
            onChange={e => set('contacto', e.target.value)}
            onFocus={() => setShowSugerencias(true)}
            onBlur={() => setTimeout(() => setShowSugerencias(false), 150)}
          />
          {showSugerencias && sugerenciasFiltradas.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-surface-2 border border-border rounded-lg shadow-xl z-10 overflow-hidden">
              {sugerenciasFiltradas.slice(0, 5).map(s => (
                <button
                  key={s}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm text-white hover:bg-surface-3 transition-colors"
                  onClick={() => { set('contacto', s); setShowSugerencias(false) }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversion opcional segun moneda principal */}
        <div className="grid grid-cols-2 gap-4">
          {esUSD ? (
            <Input
              label="Monto ARS (referencia)"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={form.monto_ars}
              onChange={e => set('monto_ars', e.target.value)}
            />
          ) : (
            <Input
              label="Monto USD (opcional)"
              type="number"
              min="0"
              step="0.01"
              placeholder="USD 0.00"
              value={form.monto_usd}
              onChange={e => set('monto_usd', e.target.value)}
            />
          )}
          <Input
            label="Tipo de cambio"
            type="number"
            min="0"
            placeholder="Ej: 1280"
            value={form.tipo_cambio}
            onChange={e => set('tipo_cambio', e.target.value)}
          />
        </div>

        <Textarea
          label="Notas adicionales"
          placeholder="Observaciones, referencias, etc."
          value={form.notas}
          onChange={e => set('notas', e.target.value)}
        />

        {/* Sección vínculos */}
        <div className="rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => setMostrarVinculos(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 text-sm text-muted-foreground hover:bg-surface-2 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Link size={14} />
              Vincular a pedido
              {tieneVinculosExistentes && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-medium">
                  {vinculosExistentes!.length}
                </span>
              )}
            </span>
            {mostrarVinculos ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {mostrarVinculos && (
            <div className="border-t border-border p-4">
              <VinculosSection
                tipo={form.tipo}
                moneda={monedaPrincipal}
                montoTotal={montoPrincipalNum}
                vinculos={vinculosForm}
                onChange={setVinculosForm}
                busqueda={busquedaVinculo}
                onBusquedaChange={setBusquedaVinculo}
              />
            </div>
          )}
        </div>

        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" loading={loading}>
            {movimiento ? 'Guardar cambios' : 'Crear movimiento'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
