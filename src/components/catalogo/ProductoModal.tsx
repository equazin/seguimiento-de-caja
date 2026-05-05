import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import { crearProducto, actualizarProducto } from '@/hooks/useCatalogo'
import type { Producto, TipoProducto } from '@/db/schema'

interface ProductoModalProps {
  open: boolean
  onClose: () => void
  producto: Producto | null
}

const ALICUOTAS_IVA = [0, 2.5, 5, 10.5, 21, 27]
const UNIDADES = ['unidad', 'kg', 'g', 'litro', 'ml', 'metro', 'cm', 'caja', 'hora', 'servicio']

interface FormState {
  codigo: string
  nombre: string
  descripcion: string
  tipo: TipoProducto
  unidad_medida: string
  precio_neto: string
  alicuota_iva: string
  stockeable: boolean
  stock_actual: string
  stock_minimo: string
  activo: boolean
}

const EMPTY: FormState = {
  codigo: '',
  nombre: '',
  descripcion: '',
  tipo: 'producto',
  unidad_medida: 'unidad',
  precio_neto: '0',
  alicuota_iva: '21',
  stockeable: true,
  stock_actual: '0',
  stock_minimo: '0',
  activo: true,
}

function fromProducto(p: Producto): FormState {
  return {
    codigo: p.codigo ?? '',
    nombre: p.nombre,
    descripcion: p.descripcion ?? '',
    tipo: p.tipo,
    unidad_medida: p.unidad_medida,
    precio_neto: String(p.precio_neto),
    alicuota_iva: String(p.alicuota_iva),
    stockeable: p.stockeable,
    stock_actual: String(p.stock_actual),
    stock_minimo: String(p.stock_minimo),
    activo: p.activo,
  }
}

function toPayload(form: FormState): Partial<Producto> {
  const precio = Number(form.precio_neto.replace(',', '.'))
  const alicuota = Number(form.alicuota_iva)
  const stockActual = Number(form.stock_actual.replace(',', '.'))
  const stockMin = Number(form.stock_minimo.replace(',', '.'))
  return {
    codigo: form.codigo.trim() || null,
    nombre: form.nombre.trim(),
    descripcion: form.descripcion.trim() || null,
    tipo: form.tipo,
    unidad_medida: form.unidad_medida,
    precio_neto: Number.isFinite(precio) ? precio : 0,
    alicuota_iva: Number.isFinite(alicuota) ? alicuota : 21,
    stockeable: form.stockeable,
    stock_actual: form.stockeable && Number.isFinite(stockActual) ? stockActual : 0,
    stock_minimo: form.stockeable && Number.isFinite(stockMin) ? stockMin : 0,
    activo: form.activo,
  }
}

export function ProductoModal({ open, onClose, producto }: ProductoModalProps) {
  const { empresa } = useAuth()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(producto ? fromProducto(producto) : EMPTY)
    setError(null)
  }, [open, producto])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!empresa) {
      setError('No hay empresa configurada')
      return
    }
    if (!form.nombre.trim()) {
      setError('El nombre es obligatorio')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const payload = toPayload(form)
      if (producto) {
        await actualizarProducto(producto.id, payload)
        toast.success('Producto actualizado')
      } else {
        await crearProducto(empresa.id, payload)
        toast.success('Producto creado')
      }
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo guardar'
      setError(message)
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={producto ? 'Editar producto' : 'Nuevo producto'} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Nombre"
            required
            value={form.nombre}
            onChange={e => update('nombre', e.target.value)}
          />
          <Input
            label="Código"
            value={form.codigo}
            onChange={e => update('codigo', e.target.value)}
          />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={e => {
              const t = e.target.value as TipoProducto
              update('tipo', t)
              if (t === 'servicio') update('stockeable', false)
            }}
          >
            <option value="producto">Producto</option>
            <option value="servicio">Servicio</option>
          </Select>
          <Select
            label="Unidad de medida"
            value={form.unidad_medida}
            onChange={e => update('unidad_medida', e.target.value)}
          >
            {UNIDADES.map(u => (
              <option key={u} value={u}>{u}</option>
            ))}
          </Select>
          <Input
            label="Precio neto"
            type="number"
            step="0.01"
            min="0"
            value={form.precio_neto}
            onChange={e => update('precio_neto', e.target.value)}
          />
          <Select
            label="Alícuota IVA (%)"
            value={form.alicuota_iva}
            onChange={e => update('alicuota_iva', e.target.value)}
          >
            {ALICUOTAS_IVA.map(a => (
              <option key={a} value={a}>{a}%</option>
            ))}
          </Select>
        </div>

        <Textarea
          label="Descripción"
          value={form.descripcion}
          onChange={e => update('descripcion', e.target.value)}
        />

        <div className="flex flex-wrap gap-4 items-center">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.stockeable}
              onChange={e => update('stockeable', e.target.checked)}
              disabled={form.tipo === 'servicio'}
              className="w-4 h-4 rounded border-border bg-surface-2"
            />
            Maneja stock
          </label>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <input
              type="checkbox"
              checked={form.activo}
              onChange={e => update('activo', e.target.checked)}
              className="w-4 h-4 rounded border-border bg-surface-2"
            />
            Activo
          </label>
        </div>

        {form.stockeable && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Stock actual"
              type="number"
              step="0.01"
              value={form.stock_actual}
              onChange={e => update('stock_actual', e.target.value)}
            />
            <Input
              label="Stock mínimo"
              type="number"
              step="0.01"
              value={form.stock_minimo}
              onChange={e => update('stock_minimo', e.target.value)}
            />
          </div>
        )}

        {error && <p className="text-xs text-danger">{error}</p>}

        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? 'Guardando…' : 'Guardar'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
