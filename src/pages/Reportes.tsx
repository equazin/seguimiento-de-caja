import { useState, useMemo } from 'react'
import { FileSpreadsheet, FileText, TrendingUp, TrendingDown } from 'lucide-react'
import { useMovimientos } from '@/hooks/useMovimientos'
import { useCategorias } from '@/hooks/useCategorias'
import { useCuentas } from '@/hooks/useCuentas'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { exportToExcel, exportToPDF } from '@/lib/exporters'
import { formatMoney, formatDate, getPrimerDiaMes, getUltimoDiaMes } from '@/lib/formatters'
import { toast } from 'sonner'

export function Reportes() {
  const hoy = new Date()
  const [fechaDesde, setFechaDesde] = useState(getPrimerDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
  const [fechaHasta, setFechaHasta] = useState(getUltimoDiaMes(hoy.getFullYear(), hoy.getMonth() + 1))
  const [exporting, setExporting] = useState(false)

  const movimientos = useMovimientos({ fechaDesde, fechaHasta })
  const categorias = useCategorias()
  const cuentas = useCuentas()

  const catMap = useMemo(() => new Map((categorias ?? []).map(c => [c.id, c])), [categorias])

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
