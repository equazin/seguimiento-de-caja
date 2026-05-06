import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Edit2, Trash2, Search, FileText, CheckCircle2, XCircle, Download, Send } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { DocumentoModal } from '@/components/ventas/DocumentoModal'
import { useClientes } from '@/hooks/useCatalogo'
import {
  useDocumentos,
  useArcaComprobantes,
  cambiarEstadoDocumento,
  eliminarDocumento,
  emitirDocumentoArca,
} from '@/hooks/useDocumentos'
import { useAuth } from '@/lib/auth'
import { formatMoney, formatDate } from '@/lib/formatters'
import { tipoDocumentoLabel } from '@/lib/documentos'
import { descargarDocumentoPdf } from '@/lib/facturaPdf'
import type {
  Documento,
  TipoDocumentoComercial,
  EstadoDocumento,
} from '@/db/schema'

const ESTADOS_LABEL: Record<EstadoDocumento, string> = {
  borrador: 'Borrador',
  confirmado: 'Confirmado',
  emitido: 'Emitido',
  anulado: 'Anulado',
  facturado: 'Facturado',
  facturado_parcial: 'Facturado parcial',
  remitido: 'Remitido',
  remitido_parcial: 'Remitido parcial',
}

function badgeForEstado(estado: EstadoDocumento) {
  if (estado === 'borrador') return <Badge variant="borrador">{ESTADOS_LABEL[estado]}</Badge>
  if (estado === 'anulado') return <Badge variant="anulado">{ESTADOS_LABEL[estado]}</Badge>
  if (estado === 'emitido') return <Badge variant="emitido">{ESTADOS_LABEL[estado]}</Badge>
  return <Badge variant="confirmado">{ESTADOS_LABEL[estado]}</Badge>
}

export function Ventas() {
  const { empresa } = useAuth()
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoComercial | ''>('')
  const [estado, setEstado] = useState<EstadoDocumento | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editar, setEditar] = useState<Documento | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Documento | null>(null)

  const filtros = useMemo(
    () => ({
      tipoOperacion: 'venta' as const,
      tipoDocumento,
      estado,
      busqueda,
    }),
    [tipoDocumento, estado, busqueda]
  )

  const documentos = useDocumentos(filtros)
  const arcaComprobantes = useArcaComprobantes()
  const clientes = useClientes({ soloActivos: false })

  const clientesMap = useMemo(
    () => new Map((clientes ?? []).map(c => [c.id, c])),
    [clientes]
  )
  const arcaMap = useMemo(
    () => new Map((arcaComprobantes ?? []).map(c => [c.documento_id, c])),
    [arcaComprobantes]
  )

  if (!empresa) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        Configurá una empresa en Fiscal antes de cargar documentos.
      </div>
    )
  }

  const loading = documentos === undefined
  const items = documentos ?? []
  const resumen = {
    total: items.length,
    confirmados: items.filter(d => d.estado === 'confirmado').length,
    emitidos: items.filter(d => d.estado === 'emitido').length,
    rechazados: items.filter(d => arcaMap.get(d.id)?.resultado === 'R').length,
    importe: items.reduce((acc, d) => acc + Number(d.total ?? 0), 0),
  }

  function abrirNuevo() {
    setEditar(null)
    setModalOpen(true)
  }

  function abrirEditar(d: Documento) {
    setEditar(d)
    setModalOpen(true)
  }

  async function anular(d: Documento) {
    try {
      await cambiarEstadoDocumento(d.id, 'anulado')
      toast.success('Documento anulado')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo anular'
      toast.error(message)
    }
  }

  async function reactivar(d: Documento) {
    try {
      await cambiarEstadoDocumento(d.id, 'borrador')
      toast.success('Vuelto a borrador')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo reactivar'
      toast.error(message)
    }
  }

  async function confirmar(d: Documento) {
    try {
      await cambiarEstadoDocumento(d.id, 'confirmado')
      toast.success('Confirmado')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo confirmar'
      toast.error(message)
    }
  }

  async function emitir(d: Documento) {
    try {
      await emitirDocumentoArca(d.id)
      toast.success('Comprobante emitido')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo emitir'
      toast.error(message)
    }
  }

  async function descargarPdf(d: Documento) {
    try {
      await descargarDocumentoPdf(d.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo generar el PDF'
      toast.error(message)
    }
  }

  async function confirmarEliminacion() {
    if (!confirmDelete) return
    try {
      await eliminarDocumento(confirmDelete.id)
      toast.success('Documento eliminado')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo eliminar'
      toast.error(message)
    }
    setConfirmDelete(null)
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryTile label="Documentos" value={resumen.total} />
        <SummaryTile label="Confirmados" value={resumen.confirmados} tone="info" />
        <SummaryTile label="Emitidos" value={resumen.emitidos} tone="success" />
        <SummaryTile label="Rechazos ARCA" value={resumen.rechazados} tone={resumen.rechazados > 0 ? 'danger' : 'default'} />
        <SummaryTile label="Total filtrado" value={formatMoney(resumen.importe)} align="right" className="col-span-2 lg:col-span-1" />
      </div>

      <PageToolbar
        actions={
          <Button onClick={abrirNuevo}>
            <Plus size={16} />
            Nuevo documento
          </Button>
        }
      >
        <div className="md:col-span-2 relative">
          <Search size={16} className="absolute left-3 top-9 text-muted-foreground" />
          <Input
            label="Buscar"
            placeholder="N° interno u observaciones…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select
          label="Tipo"
          value={tipoDocumento}
          onChange={e => setTipoDocumento(e.target.value as TipoDocumentoComercial | '')}
        >
          <option value="">Todos</option>
          <option value="presupuesto">Presupuesto</option>
          <option value="pedido">Pedido</option>
          <option value="remito">Remito</option>
          <option value="factura">Factura</option>
        </Select>
        <Select
          label="Estado"
          value={estado}
          onChange={e => setEstado(e.target.value as EstadoDocumento | '')}
        >
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="confirmado">Confirmado</option>
          <option value="anulado">Anulado</option>
        </Select>
      </PageToolbar>

      <div className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-xl shadow-black/10">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <FileText size={32} className="mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              No hay documentos que coincidan.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Número</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-left px-4 py-3 font-medium">Fecha</th>
                  <th className="text-left px-4 py-3 font-medium">Cliente</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => {
                  const cliente = d.cliente_id ? clientesMap.get(d.cliente_id) : null
                  const arca = arcaMap.get(d.id)
                  return (
                    <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-2/60">
                      <td className="px-4 py-3 text-white font-mono text-xs">
                        <div>{d.numero_interno}</div>
                        {arca?.cae && (
                          <div className="mt-1 text-[11px] font-sans text-muted-foreground">
                            CAE {arca.cae}
                          </div>
                        )}
                        {arca?.resultado === 'R' && (
                          <div className="mt-1 text-[11px] font-sans text-danger">
                            {arca.errores ? `Rechazado: ${JSON.stringify(arca.errores).slice(0, 90)}` : 'Rechazado ARCA'}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tipoDocumentoLabel(d.tipo_documento)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(d.fecha)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {cliente?.razon_social ?? <span className="text-muted-foreground">Consumidor final</span>}
                      </td>
                      <td className="px-4 py-3">{badgeForEstado(d.estado)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {formatMoney(d.total, d.moneda)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <button
                            onClick={() => abrirEditar(d)}
                            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
                            title="Ver / editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          {(d.estado === 'emitido' || arca?.cae) && (
                            <button
                              onClick={() => void descargarPdf(d)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
                              title="Descargar PDF"
                            >
                              <Download size={15} />
                            </button>
                          )}
                          {arca?.resultado === 'R' && d.estado === 'confirmado' && (
                            <button
                              onClick={() => void emitir(d)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-success"
                              title="Reintentar ARCA"
                            >
                              <Send size={15} />
                            </button>
                          )}
                          {d.estado === 'borrador' && (
                            <>
                              <button
                                onClick={() => void confirmar(d)}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-success"
                                title="Confirmar"
                              >
                                <CheckCircle2 size={15} />
                              </button>
                              <button
                                onClick={() => setConfirmDelete(d)}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-danger"
                                title="Eliminar"
                              >
                                <Trash2 size={15} />
                              </button>
                            </>
                          )}
                          {d.estado === 'confirmado' && (
                            <>
                              {d.tipo_documento === 'factura' && (
                                <button
                                  onClick={() => void emitir(d)}
                                  className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-success"
                                  title="Emitir en ARCA"
                                >
                                  <Send size={15} />
                                </button>
                              )}
                              <button
                                onClick={() => void anular(d)}
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-danger"
                                title="Anular"
                              >
                                <XCircle size={15} />
                              </button>
                            </>
                          )}
                          {d.estado === 'anulado' && (
                            <button
                              onClick={() => void reactivar(d)}
                              className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
                              title="Volver a borrador"
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <DocumentoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        documento={editar}
        tipoOperacion="venta"
      />

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={confirmarEliminacion}
        title="Eliminar documento"
        message={`Vas a eliminar ${confirmDelete?.numero_interno ?? ''}. Esta acción no se puede deshacer.`}
        confirmLabel="Eliminar"
        danger
      />
    </div>
  )
}

function SummaryTile({
  label,
  value,
  tone = 'default',
  align = 'left',
  className,
}: {
  label: string
  value: ReactNode
  tone?: 'default' | 'success' | 'danger' | 'info'
  align?: 'left' | 'right'
  className?: string
}) {
  const toneClass = {
    default: 'text-white',
    success: 'text-success',
    danger: 'text-danger',
    info: 'text-info',
  }[tone]

  return (
    <div className={`rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 ${className ?? ''}`}>
      <p className={`text-xs font-medium uppercase tracking-wide text-muted-foreground ${align === 'right' ? 'text-right' : ''}`}>
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold ${toneClass} ${align === 'right' ? 'text-right' : ''}`}>
        {value}
      </p>
    </div>
  )
}
