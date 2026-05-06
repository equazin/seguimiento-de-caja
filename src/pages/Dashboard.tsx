import { Activity, AlertTriangle, FileCheck2, ShieldCheck, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useCuentasConSaldo } from '@/hooks/useCuentas'
import { useCategorias } from '@/hooks/useCategorias'
import { useUltimosMovimientos } from '@/hooks/useMovimientos'
import { useProductos } from '@/hooks/useCatalogo'
import { KPICard } from '@/components/dashboard/KPICard'
import { ChartBarMeses } from '@/components/dashboard/ChartBarMeses'
import { ChartDonutEgresos } from '@/components/dashboard/ChartDonutEgresos'
import { ChartSaldoLinea } from '@/components/dashboard/ChartSaldoLinea'
import { RecentMovimientos } from '@/components/dashboard/RecentMovimientos'
import { Badge } from '@/components/ui/Badge'
import { SkeletonKPI } from '@/components/ui/Skeleton'
import { useAuth } from '@/lib/auth'
import { formatMoney, getMesActual } from '@/lib/formatters'
import type { Movimiento } from '@/db/schema'

interface Props {
  onEditMovimiento: (m: Movimiento) => void
}

export function Dashboard({ onEditMovimiento }: Props) {
  const { empresa } = useAuth()
  const data = useDashboard()
  const cuentas = useCuentasConSaldo()
  const categorias = useCategorias()
  const ultimos = useUltimosMovimientos(10)
  const productos = useProductos({ soloActivos: true })
  const { label: mesLabel } = getMesActual()
  const productosStockBajo = (productos ?? []).filter(p => p.stockeable && p.stock_actual <= p.stock_minimo)

  if (!data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <SkeletonKPI key={i} />)}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface/90 p-5 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">Cockpit operativo</h2>
              <Badge variant="info">{mesLabel}</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Caja, documentos, stock y fiscalidad en una vista de control diario.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <ShieldCheck size={14} className="text-success" />
                ARCA
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {empresa?.arca_ambiente === 'homologacion' ? 'Homologación activa' : 'Sin configurar'}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <FileCheck2 size={14} className="text-info" />
                Últimos mov.
              </p>
              <p className="mt-1 text-sm font-semibold text-white">{ultimos?.length ?? 0} registros</p>
            </div>
            <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <AlertTriangle size={14} className={productosStockBajo.length > 0 ? 'text-warning' : 'text-success'} />
                Stock
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {productosStockBajo.length > 0 ? `${productosStockBajo.length} alertas` : 'Sin alertas'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Saldo total"
          valor={data.saldoTotal}
          icono={Wallet}
          variante="default"
          subtitulo="Suma de todas las cuentas"
        />
        <KPICard
          titulo={`Ingresos - ${mesLabel}`}
          valor={data.resumenMes.ingresos}
          icono={TrendingUp}
          variante="ingreso"
          subtitulo="Mes actual"
        />
        <KPICard
          titulo={`Egresos - ${mesLabel}`}
          valor={data.resumenMes.egresos}
          icono={TrendingDown}
          variante="egreso"
          subtitulo="Mes actual"
        />
        <KPICard
          titulo="Resultado neto"
          valor={data.resumenMes.resultado}
          icono={Activity}
          variante="neutral"
          subtitulo={mesLabel}
        />
      </div>

      {cuentas && cuentas.length > 0 && (
        <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-white">Cuentas</h2>
            <span className="text-xs text-muted-foreground">{cuentas.length} activas</span>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1">
          {cuentas.map(c => (
            <div key={c.id} className="min-w-[180px] flex-shrink-0 rounded-lg border border-border bg-surface-2 px-4 py-3">
              <p className="text-xs text-muted-foreground font-medium truncate">{c.nombre}</p>
              <p className={`text-lg font-bold mt-1 ${c.saldo_actual >= 0 ? 'text-white' : 'text-danger'}`}>
                {formatMoney(c.saldo_actual)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.tipo}</p>
            </div>
          ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.8fr)]">
        <ChartBarMeses data={data.chartMeses} />
        <ChartDonutEgresos data={data.egresosPorCategoria} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
        <ChartSaldoLinea data={data.chartSaldo} />

        <RecentMovimientos
          movimientos={ultimos ?? []}
          categorias={categorias ?? []}
          onEdit={onEditMovimiento}
        />
      </div>
    </div>
  )
}
