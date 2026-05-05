import { useMemo, useState } from 'react'
import { Plus, Edit2, Power, Search } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ContactoModal } from './ContactoModal'
import {
  useClientes,
  useProveedores,
  setClienteActivo,
  setProveedorActivo,
} from '@/hooks/useCatalogo'
import type { Cliente, Proveedor } from '@/db/schema'

interface ContactosTabProps {
  tipo: 'cliente' | 'proveedor'
}

type ContactoData = Cliente | Proveedor

const CONDICION_LABEL: Record<string, string> = {
  responsable_inscripto: 'RI',
  monotributo: 'Monotributo',
  exento: 'Exento',
  consumidor_final: 'CF',
  no_categorizado: 'No cat.',
}

export function ContactosTab({ tipo }: ContactosTabProps) {
  const [busqueda, setBusqueda] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editar, setEditar] = useState<ContactoData | null>(null)

  const filtros = useMemo(() => ({ busqueda, soloActivos }), [busqueda, soloActivos])
  const clientesData = useClientes(filtros)
  const proveedoresData = useProveedores(filtros)
  const data = tipo === 'cliente' ? clientesData : proveedoresData
  const loading = data === undefined
  const items = data ?? []

  function abrirNuevo() {
    setEditar(null)
    setModalOpen(true)
  }

  function abrirEditar(c: ContactoData) {
    setEditar(c)
    setModalOpen(true)
  }

  async function toggleActivo(c: ContactoData) {
    try {
      if (tipo === 'cliente') {
        await setClienteActivo(c.id, !c.activo)
      } else {
        await setProveedorActivo(c.id, !c.activo)
      }
      toast.success(c.activo ? 'Marcado inactivo' : 'Reactivado')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={`Buscar ${tipo === 'cliente' ? 'clientes' : 'proveedores'}…`}
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={soloActivos}
            onChange={e => setSoloActivos(e.target.checked)}
            className="w-4 h-4 rounded border-border bg-surface-2"
          />
          Solo activos
        </label>
        <Button onClick={abrirNuevo}>
          <Plus size={16} />
          Nuevo {tipo === 'cliente' ? 'cliente' : 'proveedor'}
        </Button>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No hay {tipo === 'cliente' ? 'clientes' : 'proveedores'} que coincidan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Razón social</th>
                  <th className="text-left px-4 py-3 font-medium">Documento</th>
                  <th className="text-left px-4 py-3 font-medium">Cond. IVA</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Teléfono</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-surface-2/40">
                    <td className="px-4 py-3 text-white">
                      <div className="font-medium">{c.razon_social}</div>
                      {c.nombre_fantasia && (
                        <div className="text-xs text-muted-foreground">{c.nombre_fantasia}</div>
                      )}
                      {!c.activo && (
                        <Badge className="mt-1">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.numero_documento ? (
                        <span className="font-mono text-white">{c.tipo_documento} {c.numero_documento}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {CONDICION_LABEL[c.condicion_iva] ?? c.condicion_iva}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{c.email ?? '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground">{c.telefono ?? '—'}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <button
                          onClick={() => abrirEditar(c)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
                          title="Editar"
                        >
                          <Edit2 size={15} />
                        </button>
                        <button
                          onClick={() => void toggleActivo(c)}
                          className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
                          title={c.activo ? 'Desactivar' : 'Reactivar'}
                        >
                          <Power size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ContactoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        tipo={tipo}
        contacto={editar}
      />
    </div>
  )
}
