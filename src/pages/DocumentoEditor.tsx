import { ArrowLeft, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  DocumentoEditorPanel,
  getDocumentoTitulo,
} from '@/components/ventas/DocumentoModal'
import { useDocumento, useDocumentoRelaciones } from '@/hooks/useDocumentos'
import { useAuth } from '@/lib/auth'
import { formatDate, formatMoney } from '@/lib/formatters'
import { tipoDocumentoLabel } from '@/lib/documentos'
import type { Documento, TipoOperacion } from '@/db/schema'
import type { TipoDocumentoComercial } from '@/db/schema'

interface DocumentoEditorProps {
  tipoOperacion: TipoOperacion
}

const TIPOS_NUEVO_DOCUMENTO: TipoDocumentoComercial[] = ['presupuesto', 'pedido', 'remito', 'factura']

function parseTipoDocumento(value: string | null): TipoDocumentoComercial | undefined {
  return TIPOS_NUEVO_DOCUMENTO.includes(value as TipoDocumentoComercial)
    ? value as TipoDocumentoComercial
    : undefined
}

export function DocumentoEditor({ tipoOperacion }: DocumentoEditorProps) {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const basePath = tipoOperacion === 'venta' ? '/ventas' : '/compras'
  const documento = useDocumento(id ?? null)
  const relaciones = useDocumentoRelaciones(id ?? null)
  const isNuevo = !id
  const initialTipoDocumento = isNuevo ? parseTipoDocumento(searchParams.get('tipo')) : undefined

  function volver() {
    navigate(basePath)
  }

  if (!empresa) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Configura una empresa en Fiscal antes de cargar documentos.
      </div>
    )
  }

  if (!isNuevo && documento === undefined) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  if (!isNuevo && (!documento || documento.tipo_operacion !== tipoOperacion)) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <FileText size={32} className="mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-white">Documento no encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El comprobante no existe o pertenece a otro circuito.
        </p>
        <Button className="mt-5" variant="secondary" onClick={volver}>
          <ArrowLeft size={16} />
          Volver
        </Button>
      </div>
    )
  }

  const documentoActual = (isNuevo ? null : documento) as Documento | null
  if (documentoActual && documentoActual.estado !== 'borrador') {
    return <Navigate replace to={`${basePath}/${documentoActual.id}/detalle`} />
  }

  const titulo = getDocumentoTitulo(documentoActual, tipoOperacion)

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={volver} aria-label="Volver">
              <ArrowLeft size={16} />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tipoOperacion === 'venta' ? 'Ventas' : 'Compras'}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">{titulo}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {documentoActual
                  ? `${tipoDocumentoLabel(documentoActual.tipo_documento)} ${documentoActual.numero_interno}`
                  : 'Documento nuevo en borrador'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-end">
            <HeaderStat label="Estado">
              <Badge variant={documentoActual?.estado === 'borrador' ? 'borrador' : 'confirmado'}>
                {documentoActual?.estado ?? 'nuevo'}
              </Badge>
            </HeaderStat>
            <HeaderStat label="Total">
              <span className="text-white">
                {documentoActual ? formatMoney(documentoActual.total, documentoActual.moneda) : formatMoney(0)}
              </span>
            </HeaderStat>
          </div>
        </div>
      </div>

      {documentoActual && relaciones && relaciones.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Relaciones
          </p>
          <div className="mt-3 grid gap-2 md:grid-cols-2">
            {relaciones.map(relacion => {
              const relacionado = relacion.relacionado
              const href = relacionado
                ? `${relacionado.tipo_operacion === 'venta' ? '/ventas' : '/compras'}/${relacionado.id}`
                : basePath
              return (
                <button
                  key={relacion.id}
                  type="button"
                  onClick={() => navigate(href)}
                  className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-left transition-colors hover:bg-surface-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      {relacion.direccion === 'origen' ? 'Origen' : 'Destino'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {relacion.tipo_relacion}
                    </span>
                  </div>
                  <div className="mt-1 text-sm font-semibold text-white">
                    {relacionado
                      ? `${tipoDocumentoLabel(relacionado.tipo_documento)} ${relacionado.numero_interno}`
                      : 'Documento no disponible'}
                  </div>
                  {relacionado && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {formatDate(relacionado.fecha)} - {formatMoney(relacionado.total, relacionado.moneda)}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-6">
        <DocumentoEditorPanel
          documento={documentoActual}
          tipoOperacion={tipoOperacion}
          initialTipoDocumento={initialTipoDocumento}
          onCancel={volver}
          onSaved={volver}
          variant="page"
        />
      </div>
    </div>
  )
}

function HeaderStat({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="min-w-28 rounded-lg border border-border bg-surface-2 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="mt-1 text-sm font-semibold">{children}</div>
    </div>
  )
}
