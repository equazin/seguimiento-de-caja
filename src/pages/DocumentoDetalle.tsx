import { ArrowLeft, Edit2, FileText } from 'lucide-react'
import type { ReactNode } from 'react'
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { useClientes, useProveedores } from '@/hooks/useCatalogo'
import {
  useDocumento,
  useDocumentoItems,
  useDocumentoRelaciones,
} from '@/hooks/useDocumentos'
import { useAuth } from '@/lib/auth'
import { formatDate, formatMoney } from '@/lib/formatters'
import { tipoDocumentoLabel } from '@/lib/documentos'
import type { Documento, EstadoDocumento, TipoOperacion } from '@/db/schema'

interface DocumentoDetalleProps {
  tipoOperacion: TipoOperacion
}

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

export function DocumentoDetalle({ tipoOperacion }: DocumentoDetalleProps) {
  const { empresa } = useAuth()
  const navigate = useNavigate()
  const { id } = useParams()
  const basePath = tipoOperacion === 'venta' ? '/ventas' : '/compras'
  const documento = useDocumento(id ?? null)
  const items = useDocumentoItems(id ?? null)
  const relaciones = useDocumentoRelaciones(id ?? null)
  const clientes = useClientes({ soloActivos: false })
  const proveedores = useProveedores({ soloActivos: false })

  const contactosMap = useMemo(() => {
    const contactos = tipoOperacion === 'venta' ? clientes : proveedores
    return new Map((contactos ?? []).map(contacto => [contacto.id, contacto]))
  }, [clientes, proveedores, tipoOperacion])

  if (!empresa) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center text-sm text-muted-foreground">
        Configura una empresa en Fiscal antes de consultar documentos.
      </div>
    )
  }

  if (documento === undefined || items === undefined) {
    return <Skeleton className="h-96 w-full rounded-xl" />
  }

  if (!documento || documento.tipo_operacion !== tipoOperacion) {
    return (
      <div className="rounded-xl border border-border bg-surface p-8 text-center">
        <FileText size={32} className="mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-white">Documento no encontrado</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          El comprobante no existe o pertenece a otro circuito.
        </p>
        <Button className="mt-5" variant="secondary" onClick={() => navigate(basePath)}>
          <ArrowLeft size={16} />
          Volver
        </Button>
      </div>
    )
  }

  const contactoId = tipoOperacion === 'venta' ? documento.cliente_id : documento.proveedor_id
  const contacto = contactoId ? contactosMap.get(contactoId) : null
  const contactoFallback = tipoOperacion === 'venta' ? 'Consumidor final' : 'Sin proveedor'
  const puedeEditar = documento.estado === 'borrador' || (
    documento.tipo_documento === 'presupuesto' && documento.estado !== 'anulado'
  )

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => navigate(basePath)} aria-label="Volver">
              <ArrowLeft size={16} />
            </Button>
            <div className="min-w-0">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {tipoOperacion === 'venta' ? 'Ventas' : 'Compras'}
              </p>
              <h1 className="mt-1 text-xl font-bold text-white sm:text-2xl">
                {tipoDocumentoLabel(documento.tipo_documento)} {documento.numero_interno}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Detalle del comprobante
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {puedeEditar && (
              <Button type="button" variant="secondary" onClick={() => navigate(`${basePath}/${documento.id}`)}>
                <Edit2 size={16} />
                Editar
              </Button>
            )}
            <HeaderStat label="Estado">{badgeForEstado(documento.estado)}</HeaderStat>
            <HeaderStat label="Total">
              <div className="text-right">
                {documento.total_usd != null && (
                  <div className="text-white">{formatMoney(documento.total_usd, 'USD')}</div>
                )}
                <div className={documento.total_usd != null ? 'text-[11px] text-muted-foreground' : 'text-white'}>
                  {formatMoney(documento.total)}
                </div>
              </div>
            </HeaderStat>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Items</h2>
            <div className="mt-4 overflow-x-auto rounded-lg border border-border bg-surface">
              <table className="w-full text-sm">
                <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Descripcion</th>
                    <th className="px-3 py-2 text-right font-medium">Cant.</th>
                    <th className="px-3 py-2 text-right font-medium">P. unit. USD</th>
                    <th className="px-3 py-2 text-right font-medium">P. unit. ARS</th>
                    <th className="px-3 py-2 text-right font-medium">IVA</th>
                    <th className="px-3 py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => (
                    <tr key={item.id} className="border-t border-border">
                      <td className="px-3 py-3 text-white">
                        <div>{item.descripcion}</div>
                        {item.codigo && (
                          <div className="mt-1 text-xs text-muted-foreground">{item.codigo}</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {Number(item.cantidad).toLocaleString('es-AR')}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {item.precio_unitario_usd != null ? formatMoney(item.precio_unitario_usd, 'USD') : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground tabular-nums">
                        {formatMoney(item.precio_unitario)}
                      </td>
                      <td className="px-3 py-3 text-right text-muted-foreground">
                        {Number(item.alicuota_iva).toLocaleString('es-AR')}%
                      </td>
                      <td className="px-3 py-3 text-right font-medium text-white tabular-nums">
                        <div>{item.total_usd != null ? formatMoney(item.total_usd, 'USD') : formatMoney(item.total)}</div>
                        {item.total_usd != null && (
                          <div className="text-[11px] font-normal text-muted-foreground">
                            ≈ {formatMoney(item.total)}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          {documento.observaciones && (
            <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
              <h2 className="text-sm font-semibold text-white">Observaciones</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm text-muted-foreground">
                {documento.observaciones}
              </p>
            </section>
          )}

          {relaciones && relaciones.length > 0 && (
            <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
              <h2 className="text-sm font-semibold text-white">Relaciones</h2>
              <div className="mt-3 grid gap-2 md:grid-cols-2">
                {relaciones.map(relacion => {
                  const relacionado = relacion.relacionado
                  const href = relacionado ? documentoHref(relacionado) : basePath
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
                        <span className="text-xs text-muted-foreground">{relacion.tipo_relacion}</span>
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
            </section>
          )}
        </div>

        <aside className="space-y-5">
          <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Encabezado</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label={tipoOperacion === 'venta' ? 'Cliente' : 'Proveedor'}>
                {contacto?.razon_social ?? contactoFallback}
              </DetailRow>
              <DetailRow label="Fecha">{formatDate(documento.fecha)}</DetailRow>
              <DetailRow label="Vencimiento">
                {documento.fecha_vencimiento ? formatDate(documento.fecha_vencimiento) : 'Sin vencimiento'}
              </DetailRow>
              <DetailRow label="Moneda">{documento.moneda}</DetailRow>
              {documento.moneda === 'USD' && (
                <DetailRow label="Tipo de cambio">
                  {Number(documento.tipo_cambio).toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </DetailRow>
              )}
            </dl>
          </section>

          <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:p-5">
            <h2 className="text-sm font-semibold text-white">Totales</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <DetailRow label="Subtotal">
                <DualMoney usd={documento.subtotal_usd} ars={documento.subtotal} />
              </DetailRow>
              <DetailRow label="IVA">
                <DualMoney usd={documento.iva_total_usd} ars={documento.iva_total} />
              </DetailRow>
              {Number(documento.exento) > 0 && (
                <DetailRow label="Exento">
                  <DualMoney usd={documento.exento_usd} ars={documento.exento} />
                </DetailRow>
              )}
              {Number(documento.no_gravado) > 0 && (
                <DetailRow label="No gravado">
                  <DualMoney usd={documento.no_gravado_usd} ars={documento.no_gravado} />
                </DetailRow>
              )}
              {Number(documento.percepciones) > 0 && (
                <DetailRow label="Percepciones">
                  <DualMoney usd={documento.percepciones_usd} ars={documento.percepciones} />
                </DetailRow>
              )}
              <div className="border-t border-border pt-3">
                <DetailRow label="Total">
                  <DualMoney
                    usd={documento.total_usd}
                    ars={documento.total}
                    primaryClassName="text-base font-semibold text-white"
                  />
                </DetailRow>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </div>
  )
}

function DualMoney({
  usd,
  ars,
  primaryClassName = 'text-white',
}: {
  usd: number | null
  ars: number
  primaryClassName?: string
}) {
  if (usd == null) {
    return <span className={primaryClassName}>{formatMoney(ars)}</span>
  }
  return (
    <div className="text-right">
      <div className={primaryClassName}>{formatMoney(usd, 'USD')}</div>
      <div className="text-[11px] font-normal text-muted-foreground">≈ {formatMoney(ars)}</div>
    </div>
  )
}

function documentoHref(documento: Documento): string {
  const base = documento.tipo_operacion === 'venta' ? '/ventas' : '/compras'
  const editable = documento.estado === 'borrador' || (
    documento.tipo_documento === 'presupuesto' && documento.estado !== 'anulado'
  )
  return editable
    ? `${base}/${documento.id}`
    : `${base}/${documento.id}/detalle`
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

function DetailRow({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right text-white">{children}</dd>
    </div>
  )
}
