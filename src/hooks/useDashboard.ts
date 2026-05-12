import {
  getResumenMensual,
  getSaldoTotalARS,
  getSaldoTotalUSD,
  getCotizacionUSD,
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
    const fechaAnterior = new Date(anio, mes - 2, 1)
    const anioAnterior = fechaAnterior.getFullYear()
    const mesAnterior = fechaAnterior.getMonth() + 1

    const [
      resumen,
      resumenAnterior,
      saldoArs,
      saldoUsd,
      cotizacion,
      egresosCat,
      chartMeses,
      chartSaldo,
    ] = await Promise.all([
      getResumenMensual(anio, mes),
      getResumenMensual(anioAnterior, mesAnterior),
      getSaldoTotalARS(),
      getSaldoTotalUSD(),
      getCotizacionUSD(),
      getEgresosPorCategoria(anio, mes),
      getIngresosEgresosPorMes(6),
      getSaldoAcumuladoUltimos30Dias(),
    ])

    const saldoConsolidado = saldoArs + (cotizacion > 0 ? saldoUsd * cotizacion : 0)
    const saldoHace30Dias = saldoConsolidado - resumen.resultado

    return {
      resumenMes: resumen,
      resumenMesAnterior: resumenAnterior,
      saldoTotal: saldoConsolidado,
      saldoArs,
      saldoUsd,
      cotizacionUsd: cotizacion,
      saldoHace30Dias,
      egresosPorCategoria: egresosCat,
      chartMeses,
      chartSaldo,
    }
  }, [], ['movimientos', 'cuentas', 'categorias', 'configuracion'])
}
