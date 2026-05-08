import { useMemo, useState } from 'react'
import { FileText, Search } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { supabaseAfip } from '@/db/schema'
import { useDocumentos } from '@/hooks/useDocumentos'
import { tipoDocumentoLabel, type ItemDraft } from '@/lib/documentos'
import { cn, formatDate, formatMoney } from '@/lib/formatters'
import type {
  Documento,
  DocumentoItem,
  TipoDocumentoComercial,
  TipoOperacion,
} from '@/db/schema'

interface ImportarDesdeDocumentoDialogProps {
  open: boolean
  tipoOperacion: TipoOperacion
  tipoDestino: TipoDocumentoComercial
  tipoOrigen: TipoDocumentoComercial
  contactoId: string | null
  onClose: () => void
  onImport: (
    documento: Documento,
    items: ItemDraft[],
    contactoId: string | null,
  ) => void
}

function documentoMatchesContacto(documento: Documento, tipoOperacion: TipoOperacion, contactoId: string | null): boolean {
  if (!contactoId) return true
  return tipoOperacion === 'venta'
    ? documento.cliente_id === contactoId
    : documento.proveedor_id === contactoId
}

function itemDesdeDocumento(item: DocumentoItem, moneda: 'ARS' | 'USD'): ItemDraft {
  return {
    producto_id: item.producto_id,
    codigo: item.codigo,
    descripcion: item.descripcion,
    cantidad: Number(item.cantidad) || 1,
    unidad_medida: item.unidad_medida,
    precio_unitario:
      moneda === 'USD' && item.precio_unitario_usd != null
        ? Number(item.precio_unitario_usd)
        : Number(item.precio_unitario) || 0,
    bonificacion: Number(item.bonificacion) || 0,
    alicuota_iva: Number(item.alicuota_iva) || 0,
  }
}

async function cargarItems(documento: Documento): Promise<ItemDraft[]> {
  const { data, error } = await supabaseAfip
    .from('documento_items')
    .select('*')
    .eq('documento_id', documento.id)
    .order('orden', { ascending: true })
  if (error) throw error
  return ((data ?? []) as DocumentoItem[]).map(item => itemDesdeDocumento(item, documento.moneda))
}

export function ImportarDesdeDocumentoDialog({
  open,
  tipoOperacion,
  tipoDestino,
  tipoOrigen,
  contactoId,
  onClose,
  onImport,
}: ImportarDesdeDocumentoDialogProps) {
  const [busqueda, setBusqueda] = useState('')
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const documentosRaw = useDocumentos({
    tipoOperacion,
    tipoDocumento: tipoOrigen,
  })
  const loading = documentosRaw === undefined

  const documentos = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return (documentosRaw ?? [])
      .filter(d => d.estado !== 'anulado')
      .filter(d => documentoMatchesContacto(d, tipoOperacion, contactoId))
      .filter(d => {
        if (!q) return true
        return (
          d.numero_interno.toLowerCase().includes(q) ||
          d.observaciones?.toLowerCase().includes(q)
        )
      })
  }, [documentosRaw, busqueda, tipoOperacion, contactoId])

  async function handleImport(documento: Documento) {
    setLoadingId(documento.id)
    try {
      const items = await cargarItems(documento)
      const contacto = tipoOperacion === 'venta'
        ? documento.cliente_id ?? null
        : documento.proveedor_id ?? null
      onImport(documento, items, contacto)
      setBusqueda('')
      onClose()
    } finally {
      setLoadingId(null)
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Importar ${tipoDocumentoLabel(tipoOrigen).toLowerCase()}`}
      size="lg"
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Elegi un {tipoDocumentoLabel(tipoOrigen).toLowerCase()} para crear este {tipoDocumentoLabel(tipoDestino).toLowerCase()}.
          {contactoId && ' Solo se muestran documentos del contacto seleccionado.'}
        </p>

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por numero u observaciones..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={3} />
            </div>
          ) : documentos.length === 0 ? (
            <EmptyState
              icon={FileText}
              titulo={`Sin ${tipoDocumentoLabel(tipoOrigen).toLowerCase()}s disponibles`}
              descripcion={contactoId
                ? 'No hay documentos para este contacto.'
                : 'No hay documentos activos para importar.'}
            />
          ) : (
            <ul className="divide-y divide-border">
              {documentos.map(documento => (
                <li key={documento.id}>
                  <button
                    type="button"
                    onClick={() => void handleImport(documento)}
                    disabled={loadingId === documento.id}
                    className={cn(
                      'flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors',
                      'hover:bg-surface-2 disabled:cursor-wait disabled:opacity-60'
                    )}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-sm font-semibold text-white">
                          {documento.numero_interno}
                        </span>
                        <Badge color="#6b7280" className="text-[10px]">
                          {documento.estado}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatDate(documento.fecha)}
                        </span>
                      </div>
                      {documento.observaciones && (
                        <div className="mt-1 truncate text-xs text-muted-foreground">
                          {documento.observaciones}
                        </div>
                      )}
                    </div>
                    <div className="text-right text-sm">
                      <div className="font-semibold text-white tabular-nums">
                        {documento.moneda === 'USD' && documento.total_usd != null
                          ? formatMoney(documento.total_usd, 'USD')
                          : formatMoney(documento.total, documento.moneda)}
                      </div>
                      {documento.moneda === 'USD' && (
                        <div className="text-xs text-muted-foreground tabular-nums">
                          ARS {formatMoney(documento.total)}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
