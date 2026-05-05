import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/lib/auth'
import {
  crearCliente,
  actualizarCliente,
  crearProveedor,
  actualizarProveedor,
} from '@/hooks/useCatalogo'
import type {
  Cliente,
  Proveedor,
  CondicionIvaContacto,
  TipoDocumentoFiscal,
} from '@/db/schema'

type ContactoTipo = 'cliente' | 'proveedor'
type ContactoData = Cliente | Proveedor

interface ContactoModalProps {
  open: boolean
  onClose: () => void
  tipo: ContactoTipo
  contacto: ContactoData | null
}

const TIPOS_DOCUMENTO: TipoDocumentoFiscal[] = [
  'CUIT',
  'CUIL',
  'DNI',
  'CDI',
  'LE',
  'LC',
  'PASAPORTE',
  'OTRO',
]

const CONDICIONES_IVA: { value: CondicionIvaContacto; label: string }[] = [
  { value: 'consumidor_final', label: 'Consumidor final' },
  { value: 'responsable_inscripto', label: 'Responsable inscripto' },
  { value: 'monotributo', label: 'Monotributo' },
  { value: 'exento', label: 'Exento' },
  { value: 'no_categorizado', label: 'No categorizado' },
]

interface FormState {
  razon_social: string
  nombre_fantasia: string
  tipo_documento: TipoDocumentoFiscal
  numero_documento: string
  condicion_iva: CondicionIvaContacto
  email: string
  telefono: string
  domicilio: string
  localidad: string
  provincia: string
  codigo_postal: string
  notas: string
  activo: boolean
}

function emptyForm(tipo: ContactoTipo): FormState {
  return {
    razon_social: '',
    nombre_fantasia: '',
    tipo_documento: 'CUIT',
    numero_documento: '',
    condicion_iva: tipo === 'cliente' ? 'consumidor_final' : 'responsable_inscripto',
    email: '',
    telefono: '',
    domicilio: '',
    localidad: '',
    provincia: '',
    codigo_postal: '',
    notas: '',
    activo: true,
  }
}

function fromContacto(c: ContactoData): FormState {
  return {
    razon_social: c.razon_social,
    nombre_fantasia: c.nombre_fantasia ?? '',
    tipo_documento: c.tipo_documento,
    numero_documento: c.numero_documento ?? '',
    condicion_iva: c.condicion_iva,
    email: c.email ?? '',
    telefono: c.telefono ?? '',
    domicilio: c.domicilio ?? '',
    localidad: c.localidad ?? '',
    provincia: c.provincia ?? '',
    codigo_postal: c.codigo_postal ?? '',
    notas: c.notas ?? '',
    activo: c.activo,
  }
}

function toPayload(form: FormState): Partial<ContactoData> {
  return {
    razon_social: form.razon_social.trim(),
    nombre_fantasia: form.nombre_fantasia.trim() || null,
    tipo_documento: form.tipo_documento,
    numero_documento: form.numero_documento.trim() || null,
    condicion_iva: form.condicion_iva,
    email: form.email.trim() || null,
    telefono: form.telefono.trim() || null,
    domicilio: form.domicilio.trim() || null,
    localidad: form.localidad.trim() || null,
    provincia: form.provincia.trim() || null,
    codigo_postal: form.codigo_postal.trim() || null,
    notas: form.notas.trim() || null,
    activo: form.activo,
  }
}

export function ContactoModal({ open, onClose, tipo, contacto }: ContactoModalProps) {
  const { empresa } = useAuth()
  const [form, setForm] = useState<FormState>(() => emptyForm(tipo))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setForm(contacto ? fromContacto(contacto) : emptyForm(tipo))
    setError(null)
  }, [open, contacto, tipo])

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!empresa) {
      setError('No hay empresa configurada')
      return
    }
    if (!form.razon_social.trim()) {
      setError('La razón social es obligatoria')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const payload = toPayload(form)
      if (tipo === 'cliente') {
        if (contacto) {
          await actualizarCliente(contacto.id, payload as Partial<Cliente>)
        } else {
          await crearCliente(empresa.id, payload as Partial<Cliente>)
        }
        toast.success(contacto ? 'Cliente actualizado' : 'Cliente creado')
      } else {
        if (contacto) {
          await actualizarProveedor(contacto.id, payload as Partial<Proveedor>)
        } else {
          await crearProveedor(empresa.id, payload as Partial<Proveedor>)
        }
        toast.success(contacto ? 'Proveedor actualizado' : 'Proveedor creado')
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

  const titulo = contacto
    ? `Editar ${tipo === 'cliente' ? 'cliente' : 'proveedor'}`
    : `Nuevo ${tipo === 'cliente' ? 'cliente' : 'proveedor'}`

  return (
    <Dialog open={open} onClose={onClose} title={titulo} size="lg">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Razón social"
            required
            value={form.razon_social}
            onChange={e => update('razon_social', e.target.value)}
          />
          <Input
            label="Nombre fantasía"
            value={form.nombre_fantasia}
            onChange={e => update('nombre_fantasia', e.target.value)}
          />
          <Select
            label="Tipo documento"
            value={form.tipo_documento}
            onChange={e => update('tipo_documento', e.target.value as TipoDocumentoFiscal)}
          >
            {TIPOS_DOCUMENTO.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Input
            label="Número documento"
            value={form.numero_documento}
            onChange={e => update('numero_documento', e.target.value)}
          />
          <Select
            label="Condición IVA"
            value={form.condicion_iva}
            onChange={e => update('condicion_iva', e.target.value as CondicionIvaContacto)}
          >
            {CONDICIONES_IVA.map(c => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </Select>
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={e => update('email', e.target.value)}
          />
          <Input
            label="Teléfono"
            value={form.telefono}
            onChange={e => update('telefono', e.target.value)}
          />
          <Input
            label="Domicilio"
            value={form.domicilio}
            onChange={e => update('domicilio', e.target.value)}
          />
          <Input
            label="Localidad"
            value={form.localidad}
            onChange={e => update('localidad', e.target.value)}
          />
          <Input
            label="Provincia"
            value={form.provincia}
            onChange={e => update('provincia', e.target.value)}
          />
          <Input
            label="Código postal"
            value={form.codigo_postal}
            onChange={e => update('codigo_postal', e.target.value)}
          />
        </div>

        <Textarea
          label="Notas"
          value={form.notas}
          onChange={e => update('notas', e.target.value)}
        />

        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={form.activo}
            onChange={e => update('activo', e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface-2"
          />
          Activo
        </label>

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
