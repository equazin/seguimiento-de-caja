import { db } from './schema'
import type { Movimiento, Categoria, Cuenta } from './schema'

export async function getSaldoCuenta(cuentaId: string): Promise<number> {
  const cuenta = await db.cuentas.get(cuentaId)
  if (!cuenta) return 0

  const movimientos = await db.movimientos
    .where('cuenta_id')
    .equals(cuentaId)
    .toArray()

  const totalIngresos = movimientos
    .filter(m => m.tipo === 'ingreso')
    .reduce((sum, m) => sum + m.monto_ars, 0)

  const totalEgresos = movimientos
    .filter(m => m.tipo === 'egreso')
    .reduce((sum, m) => sum + m.monto_ars, 0)

  return cuenta.saldo_inicial + totalIngresos - totalEgresos
}

export async function getSaldoTotalARS(): Promise<number> {
  const cuentas = await db.cuentas.where('activa').equals(1).toArray()
  const saldos = await Promise.all(cuentas.map(c => getSaldoCuenta(c.id)))
  return saldos.reduce((sum, s) => sum + s, 0)
}

export async function getMovimientosByMes(anio: number, mes: number): Promise<Movimiento[]> {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = `${anio}-${String(mes).padStart(2, '0')}-31`
  return db.movimientos
    .where('fecha')
    .between(inicio, fin, true, true)
    .toArray()
}

export async function getResumenMensual(anio: number, mes: number) {
  const movimientos = await getMovimientosByMes(anio, mes)
  const ingresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
  const egresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)
  return { ingresos, egresos, resultado: ingresos - egresos, movimientos }
}

export async function getEgresosPorCategoria(anio: number, mes: number) {
  const movimientos = await getMovimientosByMes(anio, mes)
  const categorias = await db.categorias.toArray()

  const mapa = new Map<string, number>()
  movimientos
    .filter(m => m.tipo === 'egreso')
    .forEach(m => {
      const actual = mapa.get(m.categoria_id) ?? 0
      mapa.set(m.categoria_id, actual + m.monto_ars)
    })

  return Array.from(mapa.entries()).map(([catId, total]) => {
    const cat = categorias.find(c => c.id === catId)
    return {
      categoria: cat?.nombre ?? 'Sin categoría',
      color: cat?.color ?? '#6366f1',
      icono: cat?.icono ?? '📦',
      total,
    }
  }).sort((a, b) => b.total - a.total)
}

export async function getIngresosEgresosPorMes(meses: number = 6) {
  const resultado = []
  const hoy = new Date()

  for (let i = meses - 1; i >= 0; i--) {
    const fecha = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1)
    const anio = fecha.getFullYear()
    const mes = fecha.getMonth() + 1
    const resumen = await getResumenMensual(anio, mes)
    resultado.push({
      mes: `${String(mes).padStart(2, '0')}/${anio}`,
      mesCorto: fecha.toLocaleDateString('es-AR', { month: 'short' }),
      ingresos: resumen.ingresos,
      egresos: resumen.egresos,
    })
  }

  return resultado
}

export async function getContactosUsados(): Promise<string[]> {
  const movimientos = await db.movimientos.toArray()
  const contactos = movimientos
    .map(m => m.contacto)
    .filter((c): c is string => Boolean(c))
  return [...new Set(contactos)].sort()
}

export async function getConfiguracion(clave: string): Promise<string | null> {
  const config = await db.configuracion.where('clave').equals(clave).first()
  return config?.valor ?? null
}

export async function setConfiguracion(clave: string, valor: string): Promise<void> {
  const existing = await db.configuracion.where('clave').equals(clave).first()
  if (existing) {
    await db.configuracion.update(existing.id, { valor })
  } else {
    await db.configuracion.add({ id: crypto.randomUUID(), clave, valor })
  }
}

export async function exportarDB() {
  const [movimientos, categorias, cuentas, presupuestos, configuracion] = await Promise.all([
    db.movimientos.toArray(),
    db.categorias.toArray(),
    db.cuentas.toArray(),
    db.presupuestos.toArray(),
    db.configuracion.toArray(),
  ])
  return { movimientos, categorias, cuentas, presupuestos, configuracion, exportado_en: new Date().toISOString() }
}

export async function importarDB(data: Awaited<ReturnType<typeof exportarDB>>) {
  await db.transaction('rw', [db.movimientos, db.categorias, db.cuentas, db.presupuestos, db.configuracion], async () => {
    await db.movimientos.clear()
    await db.categorias.clear()
    await db.cuentas.clear()
    await db.presupuestos.clear()
    await db.configuracion.clear()

    await db.movimientos.bulkAdd(data.movimientos)
    await db.categorias.bulkAdd(data.categorias)
    await db.cuentas.bulkAdd(data.cuentas)
    await db.presupuestos.bulkAdd(data.presupuestos)
    await db.configuracion.bulkAdd(data.configuracion)
  })
}

export async function getSaldoAcumuladoUltimos30Dias() {
  const hoy = new Date()
  const hace30 = new Date(hoy)
  hace30.setDate(hace30.getDate() - 30)

  const todos = await db.movimientos.toArray()
  const saldoInicial = await getSaldoTotalARS()

  const resultado: { fecha: string; saldo: number }[] = []
  let saldoAcum = saldoInicial

  for (let i = 30; i >= 0; i--) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - i)
    const fechaStr = fecha.toISOString().split('T')[0]

    const del_dia = todos.filter(m => m.fecha === fechaStr)
    const ingresos_dia = del_dia.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
    const egresos_dia = del_dia.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)

    if (i === 30) {
      saldoAcum = saldoInicial - ingresos_dia + egresos_dia
    } else {
      saldoAcum = saldoAcum + ingresos_dia - egresos_dia
    }

    resultado.push({
      fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      saldo: saldoAcum,
    })
  }

  return resultado
}
