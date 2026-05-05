import {
  getResumenMensual,
  getSaldoTotalARS,
  getEgresosPorCategoria,
  getIngresosEgresosPorMes,
  getSaldoAcumuladoUltimos30Dias,
} from '@/db/queries'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'

export function useDashboard() {
  return useSupabaseQuery(async () => {
    const hoy = new Date()
    const anio = hoy.getFullYear()
    const mes = hoy.getMonth() + 1

    const [resumen, saldoTotal, egresosCat, chartMeses, chartSaldo] = await Promise.all([
      getResumenMensual(anio, mes),
      getSaldoTotalARS(),
      getEgresosPorCategoria(anio, mes),
      getIngresosEgresosPorMes(6),
      getSaldoAcumuladoUltimos30Dias(),
    ])

    return {
      resumenMes: resumen,
      saldoTotal,
      egresosPorCategoria: egresosCat,
      chartMeses,
      chartSaldo,
    }
  }, [], ['movimientos', 'cuentas', 'categorias'])
}
