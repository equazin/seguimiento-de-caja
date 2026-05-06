import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Edit2, Trash2, Search, FileText, CheckCircle2, XCircle, Download, RotateCcw, Truck, ArrowRightLeft, FileMinus, FilePlus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowActionsMenu, type RowAction } from '@/components/ui/RowActionsMenu'
import { useProveedores } from '@/hooks/useCatalogo'
import {
  useDocumentos,
  cambiarEstadoDocumento,
  convertirDocumento,
  crearNotaDesdeDocumento,
  eliminarDocumento,
  siguienteTipoConvertible,
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
  return <Badge variant="confirmado">{ESTADOS_LABEL[estado]}</Badge>
}

export function Compras() {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const [tipoDocumento, setTipoDocumento] = useState<TipoDocumentoComercial | ''>('')
  const [estado, setEstado] = useState<EstadoDocumento | ''>('')
  const [busqueda, setBusqueda] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<Documento | null>(null)

  const filtros = useMemo(
    () => ({
      tipoOperacion: 'compra' as const,
      tipoDocumento,
      estado,
      busqueda,
    }),
    [tipoDocumento, estado, busqueda]
  )

  const documentos = useDocumentos(filtros)
  const proveedores = useProveedores({ soloActivos: false })
  const proveedoresMap = useMemo(
    () => new Map((proveedores ?? []).map(p => [p.id, p])),
    [proveedores]
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
  const sinFiltros = !tipoDocumento && !estado && !busqueda
  const sinDocumentos = !loading && items.length === 0 && sinFiltros
  const resumen = {
    total: items.length,
    borradores: items.filter(d => d.estado === 'borrador').length,
    confirmados: items.filter(d => d.estado === 'confirmado').length,
    anulados: items.filter(d => d.estado === 'anulado').length,
    importe: items.reduce((acc, d) => acc + Number(d.total ?? 0), 0),
  }

  function abrirNuevo() {
    navigate('/compras/nuevo')
  }

  function abrirEditar(d: Documento) {
    navigate(`/compras/${d.id}`)
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

  async function descargarPdf(d: Documento) {
    try {
      await descargarDocumentoPdf(d.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo generar el PDF'
      toast.error(message)
    }
  }

  async function convertir(d: Documento) {
    try {
      const destino = await convertirDocumento(d.id)
      toast.success(`Convertido a ${tipoDocumentoLabel(destino.tipo_documento)}`)
      navigate(`/compras/${destino.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo convertir'
      toast.error(message)
    }
  }

  async function crearNota(d: Documento, tipoNota: 'nota_credito' | 'nota_debito') {
    try {
      const nota = await crearNotaDesdeDocumento(d.id, tipoNota)
      toast.success(`${tipoDocumentoLabel(nota.tipo_documento)} creada`)
      navigate(`/compras/${nota.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo crear la nota'
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

  if (sinDocumentos) {
    return (
      <div className="rounded-xl border border-border bg-surface/90 shadow-xl shadow-black/10">
        <EmptyState
          icon={Truck}
          titulo="Todavía no cargaste compras"
          descripcion="Cargá facturas, remitos y notas de tus proveedores. Los items confirmados suman stock automáticamente."
          action={
            <Button onClick={abrirNuevo}>
              <Plus size={16} />
              Cargar primer comprobante
            </Button>
          }
          hint="Tip: cargá primero el proveedor en Catálogo para autocompletar los datos."
        />
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryTile label="Documentos" value={resumen.total} />
        <SummaryTile label="Borradores" value={resumen.borradores} />
        <SummaryTile label="Confirmados" value={resumen.confirmados} tone="info" />
        <SummaryTile label="Anulados" value={resumen.anulados} tone={resumen.anulados > 0 ? 'danger' : 'default'} />
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
            placeholder="N° interno u observaciones..."
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
          <option value="pedido">Pedido</option>
          <option value="remito">Remito</option>
          <option value="factura">Factura</option>
          <option value="nota_credito">Nota de credito</option>
          <option value="nota_debito">Nota de debito</option>
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
              No hay compras que coincidan con los filtros aplicados.
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
                  <th className="text-left px-4 py-3 font-medium">Proveedor</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                  <th className="text-right px-4 py-3 font-medium">Total</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(d => {
                  const proveedor = d.proveedor_id ? proveedoresMap.get(d.proveedor_id) : null
                  const destinoConversion = siguienteTipoConvertible(d.tipo_documento)
                  return (
                    <tr key={d.id} className="border-t border-border transition-colors hover:bg-surface-2/60">
                      <td className="px-4 py-3 text-white font-mono text-xs">
                        {d.numero_interno}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {tipoDocumentoLabel(d.tipo_documento)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatDate(d.fecha)}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {proveedor?.razon_social ?? <span className="text-muted-foreground">Sin proveedor</span>}
                      </td>
                      <td className="px-4 py-3">{badgeForEstado(d.estado)}</td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {formatMoney(d.total, d.moneda)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <RowActionsMenu
                          ariaLabel={`Acciones de ${d.numero_interno}`}
                          actions={accionesCompra({
                            documento: d,
                            onEditar: () => abrirEditar(d),
                            onConfirmar: () => void confirmar(d),
                            onAnular: () => void anular(d),
                            onReactivar: () => void reactivar(d),
                            onConvertir: () => void convertir(d),
                            onNotaCredito: () => void crearNota(d, 'nota_credito'),
                            onNotaDebito: () => void crearNota(d, 'nota_debito'),
                            destinoConversionLabel: destinoConversion ? tipoDocumentoLabel(destinoConversion) : null,
                            onEliminar: () => setConfirmDelete(d),
                            onDescargarPdf: () => void descargarPdf(d),
                          })}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

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

interface AccionesCompraOpts {
  documento: Documento
  onEditar: () => void
  onConfirmar: () => void
  onAnular: () => void
  onReactivar: () => void
  onConvertir: () => void
  onNotaCredito: () => void
  onNotaDebito: () => void
  destinoConversionLabel: string | null
  onEliminar: () => void
  onDescargarPdf: () => void
}

function accionesCompra({
  documento,
  onEditar,
  onConfirmar,
  onAnular,
  onReactivar,
  onConvertir,
  onNotaCredito,
  onNotaDebito,
  destinoConversionLabel,
  onEliminar,
  onDescargarPdf,
}: AccionesCompraOpts): RowAction[] {
  const esBorrador = documento.estado === 'borrador'
  const esConfirmado = documento.estado === 'confirmado'
  const esAnulado = documento.estado === 'anulado'
  const puedeConvertir = !!destinoConversionLabel && !esBorrador && !esAnulado
  const puedeCrearNotas = documento.tipo_documento === 'factura' && !esBorrador && !esAnulado

  return [
    { id: 'ver', label: esBorrador ? 'Editar' : 'Ver detalle', icon: Edit2, onClick: onEditar },
    {
      id: 'convertir',
      label: destinoConversionLabel ? `Convertir a ${destinoConversionLabel}` : 'Convertir',
      icon: ArrowRightLeft,
      hidden: !puedeConvertir,
      onClick: onConvertir,
    },
    {
      id: 'nota_credito',
      label: 'Nota de credito',
      icon: FileMinus,
      hidden: !puedeCrearNotas,
      onClick: onNotaCredito,
    },
    {
      id: 'nota_debito',
      label: 'Nota de debito',
      icon: FilePlus,
      hidden: !puedeCrearNotas,
      onClick: onNotaDebito,
    },
    { id: 'pdf', label: 'Descargar PDF', icon: Download, hidden: esBorrador, onClick: onDescargarPdf },
    {
      id: 'confirmar',
      label: 'Confirmar',
      icon: CheckCircle2,
      tone: 'success',
      hidden: !esBorrador,
      onClick: onConfirmar,
    },
    {
      id: 'anular',
      label: 'Anular',
      icon: XCircle,
      tone: 'danger',
      hidden: !esConfirmado,
      onClick: onAnular,
    },
    {
      id: 'reactivar',
      label: 'Volver a borrador',
      icon: RotateCcw,
      hidden: !esAnulado,
      onClick: onReactivar,
    },
    {
      id: 'eliminar',
      label: 'Eliminar',
      icon: Trash2,
      tone: 'danger',
      hidden: !esBorrador,
      onClick: onEliminar,
    },
  ]
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
  tone?: 'default' | 'danger' | 'info'
  align?: 'left' | 'right'
  className?: string
}) {
  const toneClass = {
    default: 'text-white',
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
