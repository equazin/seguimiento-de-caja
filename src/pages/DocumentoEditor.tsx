import { ArrowLeft, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import {
  DocumentoEditorPanel,
  getDocumentoTitulo,
} from '@/components/ventas/DocumentoModal'
import { useDocumento } from '@/hooks/useDocumentos'
import { useAuth } from '@/lib/auth'
import { formatMoney } from '@/lib/formatters'
import { tipoDocumentoLabel } from '@/lib/documentos'
import type { Documento, TipoOperacion } from '@/db/schema'

interface DocumentoEditorProps {
  tipoOperacion: TipoOperacion
}

export function DocumentoEditor({ tipoOperacion }: DocumentoEditorProps) {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const basePath = tipoOperacion === 'venta' ? '/ventas' : '/compras'
  const documento = useDocumento(id ?? null)
  const isNuevo = !id

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

      <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-6">
        <DocumentoEditorPanel
          documento={documentoActual}
          tipoOperacion={tipoOperacion}
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
