import { Wallet, TrendingUp, TrendingDown, Activity } from 'lucide-react'
import { useDashboard } from '@/hooks/useDashboard'
import { useCuentasConSaldo } from '@/hooks/useCuentas'
import { useCategorias } from '@/hooks/useCategorias'
import { useUltimosMovimientos } from '@/hooks/useMovimientos'
import { KPICard } from '@/components/dashboard/KPICard'
import { ChartBarMeses } from '@/components/dashboard/ChartBarMeses'
import { ChartDonutEgresos } from '@/components/dashboard/ChartDonutEgresos'
import { ChartSaldoLinea } from '@/components/dashboard/ChartSaldoLinea'
import { RecentMovimientos } from '@/components/dashboard/RecentMovimientos'
import { SkeletonKPI } from '@/components/ui/Skeleton'
import { formatMoney, getMesActual } from '@/lib/formatters'
import type { Movimiento } from '@/db/schema'

interface Props {
  onEditMovimiento: (m: Movimiento) => void
}

export function Dashboard({ onEditMovimiento }: Props) {
  const data = useDashboard()
  const cuentas = useCuentasConSaldo()
  const categorias = useCategorias()
  const ultimos = useUltimosMovimientos(10)
  const { label: mesLabel } = getMesActual()

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
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Saldo total"
          valor={data.saldoTotal}
          icono={Wallet}
          variante="default"
          subtitulo="Suma de todas las cuentas"
        />
        <KPICard
          titulo={`Ingresos — ${mesLabel}`}
          valor={data.resumenMes.ingresos}
          icono={TrendingUp}
          variante="ingreso"
          subtitulo="Mes actual"
        />
        <KPICard
          titulo={`Egresos — ${mesLabel}`}
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

      {/* Cuentas mini cards */}
      {cuentas && cuentas.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {cuentas.map(c => (
            <div key={c.id} className="bg-surface border border-border rounded-xl px-4 py-3 flex-shrink-0 min-w-[180px]">
              <p className="text-xs text-muted-foreground font-medium truncate">{c.nombre}</p>
              <p className={`text-lg font-bold mt-1 ${c.saldo_actual >= 0 ? 'text-white' : 'text-danger'}`}>
                {formatMoney(c.saldo_actual)}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{c.tipo}</p>
            </div>
          ))}
        </div>
      )}

      {/* Charts */}
      <div className="flex gap-4">
        <ChartBarMeses data={data.chartMeses} />
        <ChartDonutEgresos data={data.egresosPorCategoria} />
      </div>

      <ChartSaldoLinea data={data.chartSaldo} />

      {/* Últimos movimientos */}
      <RecentMovimientos
        movimientos={ultimos ?? []}
        categorias={categorias ?? []}
        onEdit={onEditMovimiento}
      />
    </div>
  )
}
