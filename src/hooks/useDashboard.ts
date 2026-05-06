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
    const fechaAnterior = new Date(anio, mes - 2, 1)
    const anioAnterior = fechaAnterior.getFullYear()
    const mesAnterior = fechaAnterior.getMonth() + 1

    const [resumen, resumenAnterior, saldoTotal, egresosCat, chartMeses, chartSaldo] = await Promise.all([
      getResumenMensual(anio, mes),
      getResumenMensual(anioAnterior, mesAnterior),
      getSaldoTotalARS(),
      getEgresosPorCategoria(anio, mes),
      getIngresosEgresosPorMes(6),
      getSaldoAcumuladoUltimos30Dias(),
    ])

    // saldoHace30Dias = saldoTotal actual menos el resultado neto del mes en curso
    // (aproximación simple, evita una query extra)
    const saldoHace30Dias = saldoTotal - resumen.resultado

    return {
      resumenMes: resumen,
      resumenMesAnterior: resumenAnterior,
      saldoTotal,
      saldoHace30Dias,
      egresosPorCategoria: egresosCat,
      chartMeses,
      chartSaldo,
    }
  }, [], ['movimientos', 'cuentas', 'categorias'])
}
