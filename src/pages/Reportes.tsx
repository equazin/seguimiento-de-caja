import { useState, useMemo } from 'react'
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { useMovimientos } from '@/hooks/useMovimientos'
import { useCategorias } from '@/hooks/useCategorias'
import { useCuentas } from '@/hooks/useCuentas'
import { useClientes, useProductos } from '@/hooks/useCatalogo'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { supabaseAfip } from '@/db/schema'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { exportToExcel, exportToPDF } from '@/lib/exporters'
import { formatMoney, formatDate, getPrimerDiaMes, getUltimoDiaMes } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Cliente, Documento, DocumentoItem, Producto } from '@/db/schema'

type DocumentoReporte = Pick<
  Documento,
  | 'id'
  | 'tipo_operacion'
  | 'tipo_documento'
  | 'estado'
  | 'cliente_id'
  | 'fecha'
  | 'subtotal'
  | 'iva_total'
  | 'total'
  | 'moneda'
  | 'tipo_cambio'
  | 'subtotal_usd'
  | 'iva_total_usd'
  | 'total_usd'
>

type DocumentoItemReporte = Pick<
  DocumentoItem,
  'documento_id' | 'producto_id' | 'descripcion' | 'cantidad' | 'total' | 'total_usd'
>

const TIPOS_REPORTE = ['factura', 'nota_credito', 'nota_debito']
const ESTADOS_REPORTE = ['confirmado', 'emitido']

export function Reportes() {
  const hoy = new Date()
  const [fechaDesde, setFechaDesde] = useState(getPrimerDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
  const [fechaHasta, setFechaHasta] = useState(getUltimoDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
  const [exporting, setExporting] = useState(false)

  const movimientos = useMovimientos({ fechaDesde, fechaHasta })
  const categorias = useCategorias()
  const cuentas = useCuentas()
  const clientes = useClientes({ soloActivos: false })
  const productos = useProductos({ soloActivos: false })
  const documentos = useDocumentosReporte(fechaDesde, fechaHasta)
  const documentoIds = useMemo(() => documentos?.map(d => d.id) ?? [], [documentos])
  const documentoItems = useDocumentoItemsReporte(documentoIds)

  const catMap = useMemo(() => new Map((categorias ?? []).map(c => [c.id, c])), [categorias])
  const clientesMap = useMemo(() => new Map((clientes ?? []).map(c => [c.id, c])), [clientes])
  const productosMap = useMemo(() => new Map((productos ?? []).map(p => [p.id, p])), [productos])

  const resumen = useMemo(() => {
    if (!movimientos) return null
    const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
    const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)

    const porCategoria = new Map<string, { nombre: string; color: string; icono: string; total: number; cantidad: number }>()
    movimientos.forEach(m => {
      const cat = catMap.get(m.categoria_id)
      if (!cat) return
      const prev = porCategoria.get(m.categoria_id) ?? { nombre: cat.nombre, color: cat.color, icono: cat.icono, total: 0, cantidad: 0 }
      porCategoria.set(m.categoria_id, {
        ...prev,
        total: prev.total + m.monto_ars,
        cantidad: prev.cantidad + 1,
      })
    })

    return {
      ingresos,
      egresos,
      resultado: ingresos - egresos,
      total: movimientos.length,
      porCategoria: [...porCategoria.values()].sort((a, b) => b.total - a.total),
    }
  }, [movimientos, catMap])

  const reporteFiscal = useMemo(() => {
    if (!documentos || !documentoItems) return null

    const ventas = aggregateIva(documentos, 'venta')
    const compras = aggregateIva(documentos, 'compra')
    const clientesRanking = buildClientesRanking(documentos, clientesMap)
    const productosRanking = buildProductosRanking(documentos, documentoItems, productosMap)

    return {
      ventas,
      compras,
      clientesRanking,
      productosRanking,
    }
  }, [documentos, documentoItems, clientesMap, productosMap])

  const titulo = `Bartez Tecnología — Reporte ${fechaDesde} al ${fechaHasta}`
  const periodo = `${formatDate(fechaDesde)} al ${formatDate(fechaHasta)}`

  const handleExcelExport = async () => {
    if (!movimientos || !categorias || !cuentas) return
    setExporting(true)
    try {
      await exportToExcel(movimientos, categorias, cuentas, titulo)
      toast.success('Excel generado')
    } catch {
      toast.error('Error al exportar Excel')
    } finally {
      setExporting(false)
    }
  }

  const handlePDFExport = async () => {
    if (!movimientos || !categorias || !cuentas) return
    setExporting(true)
    try {
      await exportToPDF(movimientos, categorias, cuentas, 'Reporte de movimientos', periodo)
      toast.success('PDF generado')
    } catch {
      toast.error('Error al exportar PDF')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        titulo="Reportes"
        subtitulo="Análisis y exportación"
      />
      {/* Filtros */}
      <Card>
        <div className="flex flex-wrap items-end gap-4">
          <Input
            label="Desde"
            type="date"
            value={fechaDesde}
            onChange={e => setFechaDesde(e.target.value)}
            className="w-40"
          />
          <Input
            label="Hasta"
            type="date"
            value={fechaHasta}
            onChange={e => setFechaHasta(e.target.value)}
            className="w-40"
          />
          <div className="flex gap-2 pb-0.5">
            <Button variant="secondary" size="sm" onClick={() => {
              setFechaDesde(getPrimerDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
              setFechaHasta(getUltimoDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
            }}>Este mes</Button>
            <Button variant="secondary" size="sm" onClick={() => {
              const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1)
              setFechaDesde(getPrimerDiaMes(prev.getFullYear(), prev.getMonth() + 1))
              setFechaHasta(getUltimoDiaMes(prev.getFullYear(), prev.getMonth() + 1))
            }}>Mes anterior</Button>
            <Button variant="secondary" size="sm" onClick={() => {
              setFechaDesde(`${hoy.getFullYear()}-01-01`)
              setFechaHasta(`${hoy.getFullYear()}-12-31`)
            }}>Este año</Button>
          </div>
          <div className="flex gap-2 ml-auto pb-0.5">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExcelExport}
              loading={exporting}
              disabled={!movimientos?.length}
            >
              <FileSpreadsheet size={14} /> Exportar Excel
            </Button>
            <Button
              size="sm"
              onClick={handlePDFExport}
              loading={exporting}
              disabled={!movimientos?.length}
            >
              <FileText size={14} /> Exportar PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* KPIs resumen */}
      {resumen && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={16} className="text-success" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total ingresos</p>
            </div>
            <p className="text-2xl font-bold text-success">{formatMoney(resumen.ingresos)}</p>
          </div>
          <div className="bg-surface border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown size={16} className="text-danger" />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total egresos</p>
            </div>
            <p className="text-2xl font-bold text-danger">{formatMoney(resumen.egresos)}</p>
          </div>
          <div className={`bg-surface border rounded-xl p-5 ${resumen.resultado >= 0 ? 'border-success/30' : 'border-danger/30'}`}>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Resultado neto</p>
            <p className={`text-2xl font-bold ${resumen.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
              {formatMoney(resumen.resultado)}
            </p>
          </div>
        </div>
      )}

      {reporteFiscal && (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>IVA ventas / compras</CardTitle>
              <span className="text-xs text-muted-foreground">{documentos?.length ?? 0} documentos</span>
            </CardHeader>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <IvaSummary title="Ventas" data={reporteFiscal.ventas} />
              <IvaSummary title="Compras" data={reporteFiscal.compras} />
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ranking de clientes</CardTitle>
            </CardHeader>
            <RankingTable
              emptyLabel="Sin ventas confirmadas en el periodo"
              rows={reporteFiscal.clientesRanking}
              valueLabel="Total"
            />
          </Card>

          <Card className="xl:col-span-2">
            <CardHeader>
              <CardTitle>Productos mas vendidos</CardTitle>
            </CardHeader>
            <RankingTable
              emptyLabel="Sin productos vendidos en el periodo"
              rows={reporteFiscal.productosRanking}
              valueLabel="Vendido"
              secondaryLabel="Cantidad"
            />
          </Card>
        </div>
      )}

      {/* Tabla movimientos */}
      <Card>
        <CardHeader>
          <CardTitle>Movimientos del período</CardTitle>
          <span className="text-xs text-muted-foreground">{movimientos?.length ?? 0} registros</span>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Fecha</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Categoría</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Contacto</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Monto</th>
              </tr>
            </thead>
            <tbody>
              {!movimientos && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Cargando...</td></tr>
              )}
              {movimientos?.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sin movimientos en el período</td></tr>
              )}
              {movimientos?.map((m, i) => {
                const cat = catMap.get(m.categoria_id)
                const esIngreso = m.tipo === 'ingreso'
                return (
                  <tr key={m.id} className={`border-b border-border/40 hover:bg-surface-2/40 ${i % 2 ? 'bg-surface-2/10' : ''}`}>
                    <td className="px-3 py-2.5 text-muted-foreground whitespace-nowrap">{formatDate(m.fecha)}</td>
                    <td className="px-3 py-2.5">
                      <Badge variant={esIngreso ? 'ingreso' : 'egreso'}>{esIngreso ? 'Ingreso' : 'Egreso'}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-white max-w-xs truncate">{m.descripcion}</td>
                    <td className="px-3 py-2.5">
                      {cat && <Badge color={cat.color}>{cat.icono} {cat.nombre}</Badge>}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">{m.contacto ?? '—'}</td>
                    <td className={`px-3 py-2.5 text-right font-semibold ${esIngreso ? 'text-success' : 'text-danger'}`}>
                      {esIngreso ? '+' : '-'}{formatMoney(m.monto_ars)}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {resumen && movimientos && movimientos.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-border">
                  <td colSpan={5} className="px-3 py-3 text-sm font-bold text-white text-right">Total neto:</td>
                  <td className={`px-3 py-3 text-right font-bold ${resumen.resultado >= 0 ? 'text-success' : 'text-danger'}`}>
                    {formatMoney(resumen.resultado)}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </Card>

      {/* Resumen por categoría */}
      {resumen && resumen.porCategoria.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Desglose por categoría</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            {resumen.porCategoria.map(cat => (
              <div key={cat.nombre} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-surface-2">
                <span className="text-lg">{cat.icono}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm text-white font-medium">{cat.nombre}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{cat.cantidad} mov.</span>
                      <span className="text-sm font-semibold text-white">{formatMoney(cat.total)}</span>
                    </div>
                  </div>
                  {resumen.ingresos + resumen.egresos > 0 && (
                    <div className="h-1.5 rounded-full bg-surface-2 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(cat.total / Math.max(resumen.ingresos, resumen.egresos)) * 100}%`,
                          backgroundColor: cat.color,
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function useDocumentosReporte(fechaDesde: string, fechaHasta: string) {
  return useSupabaseQuery(
    async () => {
      const { data, error } = await supabaseAfip
        .from('documentos')
        .select('id,tipo_operacion,tipo_documento,estado,cliente_id,fecha,subtotal,iva_total,total,moneda,tipo_cambio,subtotal_usd,iva_total_usd,total_usd')
        .gte('fecha', fechaDesde)
        .lte('fecha', fechaHasta)
        .in('tipo_documento', TIPOS_REPORTE)
        .in('estado', ESTADOS_REPORTE)
      if (error) throw error
      return (data ?? []) as DocumentoReporte[]
    },
    [fechaDesde, fechaHasta],
    ['documentos']
  )
}

function useDocumentoItemsReporte(documentoIds: string[]) {
  const idsKey = documentoIds.join(',')
  return useSupabaseQuery(
    async () => {
      if (documentoIds.length === 0) return [] as DocumentoItemReporte[]
      const { data, error } = await supabaseAfip
        .from('documento_items')
        .select('documento_id,producto_id,descripcion,cantidad,total,total_usd')
        .in('documento_id', documentoIds)
      if (error) throw error
      return (data ?? []) as DocumentoItemReporte[]
    },
    [idsKey],
    ['documento_items']
  )
}

function aggregateIva(documentos: DocumentoReporte[], tipoOperacion: 'venta' | 'compra') {
  return documentos
    .filter(documento => documento.tipo_operacion === tipoOperacion)
    .reduce(
      (acc, documento) => {
        const sign = documentoSign(documento)
        acc.neto += sign * amountArs(documento.subtotal)
        acc.iva += sign * amountArs(documento.iva_total)
        acc.total += sign * amountArs(documento.total)
        acc.cantidad += 1
        return acc
      },
      { neto: 0, iva: 0, total: 0, cantidad: 0 }
    )
}

function buildClientesRanking(
  documentos: DocumentoReporte[],
  clientesMap: Map<string, Cliente>
) {
  const grouped = new Map<string, { label: string; value: number; secondary: number }>()

  documentos
    .filter(documento => documento.tipo_operacion === 'venta')
    .forEach(documento => {
      const key = documento.cliente_id ?? 'sin-cliente'
      const cliente = documento.cliente_id ? clientesMap.get(documento.cliente_id) : null
      const prev = grouped.get(key) ?? {
        label: cliente?.razon_social ?? 'Consumidor final',
        value: 0,
        secondary: 0,
      }
      grouped.set(key, {
        ...prev,
        value: prev.value + documentoSign(documento) * amountArs(documento.total),
        secondary: prev.secondary + 1,
      })
    })

  return [...grouped.values()]
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
}

function buildProductosRanking(
  documentos: DocumentoReporte[],
  items: DocumentoItemReporte[],
  productosMap: Map<string, Producto>
) {
  const documentosMap = new Map(documentos.map(documento => [documento.id, documento]))
  const grouped = new Map<string, { label: string; value: number; secondary: number }>()

  items.forEach(item => {
    const documento = documentosMap.get(item.documento_id)
    if (!documento || documento.tipo_operacion !== 'venta') return
    const key = item.producto_id ?? item.descripcion
    const producto = item.producto_id ? productosMap.get(item.producto_id) : null
    const prev = grouped.get(key) ?? {
      label: producto?.nombre ?? item.descripcion,
      value: 0,
      secondary: 0,
    }
    const sign = documentoSign(documento)
    grouped.set(key, {
      ...prev,
      value: prev.value + sign * amountArs(item.total),
      secondary: prev.secondary + sign * Number(item.cantidad),
    })
  })

  return [...grouped.values()]
    .filter(row => row.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
}

function documentoSign(documento: DocumentoReporte): number {
  return documento.tipo_documento === 'nota_credito' ? -1 : 1
}

function amountArs(value: number): number {
  const amount = Number(value)
  return Number.isFinite(amount) ? amount : 0
}

function IvaSummary({
  title,
  data,
}: {
  title: string
  data: { neto: number; iva: number; total: number; cantidad: number }
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-white">{title}</p>
        <span className="text-xs text-muted-foreground">{data.cantidad} docs</span>
      </div>
      <div className="space-y-2 text-sm">
        <MetricRow label="Neto" value={formatMoney(data.neto)} />
        <MetricRow label="IVA" value={formatMoney(data.iva)} />
        <MetricRow label="Total" value={formatMoney(data.total)} strong />
      </div>
    </div>
  )
}

function MetricRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? 'font-semibold text-white' : 'text-white'}>{value}</span>
    </div>
  )
}

function RankingTable({
  rows,
  emptyLabel,
  valueLabel,
  secondaryLabel = 'Docs',
}: {
  rows: Array<{ label: string; value: number; secondary: number }>
  emptyLabel: string
  valueLabel: string
  secondaryLabel?: string
}) {
  if (rows.length === 0) {
    return <div className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</div>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase text-muted-foreground">
          <tr className="border-b border-border">
            <th className="px-2 py-2 text-left font-medium">Nombre</th>
            <th className="px-2 py-2 text-right font-medium">{secondaryLabel}</th>
            <th className="px-2 py-2 text-right font-medium">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label} className="border-b border-border/40">
              <td className="px-2 py-2 text-white">{row.label}</td>
              <td className="px-2 py-2 text-right text-muted-foreground">
                {row.secondary.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
              </td>
              <td className="px-2 py-2 text-right font-semibold text-white">
                {formatMoney(row.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
