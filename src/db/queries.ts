import { supabase } from './supabase'
import type { Categoria, Configuracion, Cuenta, Movimiento } from './supabase'
import { notifyDataChanged } from '@/hooks/useSupabaseQuery'

async function clearAllTables() {
  const movimientos = await supabase.from('movimientos').delete().not('id', 'is', null)
  if (movimientos.error) throw movimientos.error

  const categorias = await supabase.from('categorias').delete().not('id', 'is', null)
  if (categorias.error) throw categorias.error

  const cuentas = await supabase.from('cuentas').delete().not('id', 'is', null)
  if (cuentas.error) throw cuentas.error

  const configuracion = await supabase.from('configuracion').delete().not('id', 'is', null)
  if (configuracion.error) throw configuracion.error
}

export async function getSaldoCuenta(cuentaId: string): Promise<number> {
  const { data: cuenta } = await supabase
    .from('cuentas')
    .select('saldo_inicial, moneda')
    .eq('id', cuentaId)
    .maybeSingle()

  if (!cuenta) return 0

  const { data: movimientos } = await supabase
    .from('movimientos')
    .select('tipo, monto_ars, monto_usd, moneda_principal')
    .eq('cuenta_id', cuentaId)

  if (!movimientos) return cuenta.saldo_inicial

  const esUsd = cuenta.moneda === 'USD'
  const valor = (m: { monto_ars: number; monto_usd?: number | null }) =>
    esUsd ? Number(m.monto_usd ?? 0) : Number(m.monto_ars ?? 0)

  const totalIngresos = movimientos.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + valor(m), 0)
  const totalEgresos = movimientos.filter(m => m.tipo === 'egreso').reduce((s, m) => s + valor(m), 0)
  return cuenta.saldo_inicial + totalIngresos - totalEgresos
}

const CUENTAS_VIRTUALES_IDS = ['cuenta-echeqs-ars']

export async function getSaldoTotalARS(): Promise<number> {
  const { data: cuentas } = await supabase.from('cuentas').select('id, moneda').eq('activa', true)
  if (!cuentas) return 0
  const cuentasArs = cuentas.filter(c => c.moneda === 'ARS' && !CUENTAS_VIRTUALES_IDS.includes(c.id))
  const saldos = await Promise.all(cuentasArs.map(c => getSaldoCuenta(c.id)))
  return saldos.reduce((s, v) => s + v, 0)
}

export async function getSaldoTotalUSD(): Promise<number> {
  const { data: cuentas } = await supabase.from('cuentas').select('id, moneda').eq('activa', true)
  if (!cuentas) return 0
  const cuentasUsd = cuentas.filter(c => c.moneda === 'USD' && !CUENTAS_VIRTUALES_IDS.includes(c.id))
  const saldos = await Promise.all(cuentasUsd.map(c => getSaldoCuenta(c.id)))
  return saldos.reduce((s, v) => s + v, 0)
}

export async function getCotizacionUSD(): Promise<number> {
  const valor = await getConfiguracion('cotizacion_usd')
  const num = Number(valor)
  return Number.isFinite(num) && num > 0 ? num : 0
}

export interface EcheqsEnCartera {
  ingresosArs: number
  egresosArs: number
  ingresosUsd: number
  egresosUsd: number
  countIngresos: number
  countEgresos: number
}

export async function getEcheqsEnCartera(): Promise<EcheqsEnCartera> {
  const { data: echeqs } = await supabase
    .from('echeqs')
    .select('monto, movimiento_id')
    .eq('estado', 'pendiente')

  if (!echeqs || echeqs.length === 0) {
    return { ingresosArs: 0, egresosArs: 0, ingresosUsd: 0, egresosUsd: 0, countIngresos: 0, countEgresos: 0 }
  }

  const ids = [...new Set(echeqs.map(e => e.movimiento_id))]
  const { data: movs } = await supabase
    .from('movimientos')
    .select('id, tipo, moneda_principal')
    .in('id', ids)

  const movMap = new Map((movs ?? []).map(m => [m.id, m]))
  const acc: EcheqsEnCartera = {
    ingresosArs: 0, egresosArs: 0, ingresosUsd: 0, egresosUsd: 0, countIngresos: 0, countEgresos: 0,
  }
  for (const e of echeqs) {
    const m = movMap.get(e.movimiento_id)
    if (!m) continue
    const moneda = m.moneda_principal === 'USD' ? 'USD' : 'ARS'
    const monto = Number(e.monto) || 0
    if (m.tipo === 'ingreso') {
      acc.countIngresos += 1
      if (moneda === 'USD') acc.ingresosUsd += monto
      else acc.ingresosArs += monto
    } else {
      acc.countEgresos += 1
      if (moneda === 'USD') acc.egresosUsd += monto
      else acc.egresosArs += monto
    }
  }
  return acc
}

export async function getSaldoTotalConsolidadoARS(): Promise<{ ars: number; usd: number; consolidado: number; cotizacion: number }> {
  const [ars, usd, cotizacion] = await Promise.all([
    getSaldoTotalARS(),
    getSaldoTotalUSD(),
    getCotizacionUSD(),
  ])
  return {
    ars,
    usd,
    cotizacion,
    consolidado: ars + (cotizacion > 0 ? usd * cotizacion : 0),
  }
}

export async function getMovimientosByMes(anio: number, mes: number): Promise<Movimiento[]> {
  const inicio = `${anio}-${String(mes).padStart(2, '0')}-01`
  const fin = `${anio}-${String(mes).padStart(2, '0')}-31`
  const { data } = await supabase
    .from('movimientos')
    .select('*')
    .gte('fecha', inicio)
    .lte('fecha', fin)
    .order('fecha', { ascending: false })
    .order('created_at', { ascending: false })
  return data ?? []
}

export async function getResumenMensual(anio: number, mes: number) {
  const movimientos = await getMovimientosByMes(anio, mes)
  const arsOnly = movimientos.filter(m => (m.moneda_principal ?? 'ARS') === 'ARS')
  const ingresos = arsOnly.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
  const egresos = arsOnly.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)
  return { ingresos, egresos, resultado: ingresos - egresos, movimientos }
}

export async function getEgresosPorCategoria(anio: number, mes: number) {
  const movimientos = await getMovimientosByMes(anio, mes)
  const { data: categorias } = await supabase.from('categorias').select('*')

  const mapa = new Map<string, number>()
  movimientos
    .filter(m => m.tipo === 'egreso' && (m.moneda_principal ?? 'ARS') === 'ARS')
    .forEach(m => {
      if (!m.categoria_id) return
      mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + m.monto_ars)
    })

  return Array.from(mapa.entries()).map(([catId, total]) => {
    const cat = (categorias ?? []).find(c => c.id === catId)
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
  const { data } = await supabase.from('movimientos').select('contacto').not('contacto', 'is', null)
  const contactos = (data ?? []).map(m => m.contacto).filter(Boolean) as string[]
  return [...new Set(contactos)].sort()
}

export async function getConfiguracion(clave: string): Promise<string | null> {
  const { data } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('clave', clave)
    .limit(1)
  return data?.[0]?.valor ?? null
}

export async function setConfiguracion(clave: string, valor: string): Promise<void> {
  const existentes = await supabase
    .from('configuracion')
    .select('id')
    .eq('clave', clave)
  if (existentes.error) throw existentes.error

  const filas = existentes.data ?? []

  if (filas.length === 0) {
    const { error } = await supabase
      .from('configuracion')
      .insert({ clave, valor })
    if (error) throw error
  } else {
    const { error, data: updated } = await supabase
      .from('configuracion')
      .update({ valor })
      .eq('clave', clave)
      .select('id')
    if (error) throw error
    if (!updated || updated.length === 0) {
      throw new Error(`No se actualizó ninguna fila para clave "${clave}". Verificá permisos RLS.`)
    }
  }
  notifyDataChanged()
}

export async function exportarDB() {
  const [movimientos, categorias, cuentas, configuracion] = await Promise.all([
    supabase.from('movimientos').select('*'),
    supabase.from('categorias').select('*'),
    supabase.from('cuentas').select('*'),
    supabase.from('configuracion').select('*'),
  ])
  return {
    movimientos: movimientos.data ?? [],
    categorias: categorias.data ?? [],
    cuentas: cuentas.data ?? [],
    configuracion: configuracion.data ?? [],
    exportado_en: new Date().toISOString(),
  }
}

interface BackupData {
  movimientos: Movimiento[]
  categorias: Categoria[]
  cuentas: Cuenta[]
  configuracion?: Configuracion[]
}

export async function importarDB(data: BackupData) {
  await clearAllTables()

  const results = await Promise.all([
    data.categorias?.length ? supabase.from('categorias').insert(data.categorias) : Promise.resolve({ error: null }),
    data.cuentas?.length ? supabase.from('cuentas').insert(data.cuentas) : Promise.resolve({ error: null }),
    data.movimientos?.length ? supabase.from('movimientos').insert(data.movimientos) : Promise.resolve({ error: null }),
    data.configuracion?.length ? supabase.from('configuracion').insert(data.configuracion) : Promise.resolve({ error: null }),
  ])
  const error = results.find(result => result.error)?.error
  if (error) throw error
  notifyDataChanged()
}

export async function resetearDB() {
  await clearAllTables()
  notifyDataChanged()
}

export async function getSaldoAcumuladoUltimos30Dias() {
  const hoy = new Date()
  const hace30 = new Date(hoy)
  hace30.setDate(hace30.getDate() - 30)

  const { data: todos } = await supabase
    .from('movimientos')
    .select('fecha, tipo, monto_ars, moneda_principal')
  const arsOnly = (todos ?? []).filter(m => (m.moneda_principal ?? 'ARS') === 'ARS')
  const saldoTotal = await getSaldoTotalARS()

  const resultado: { fecha: string; saldo: number }[] = []
  let saldoAcum = saldoTotal

  for (let i = 30; i >= 0; i--) {
    const fecha = new Date(hoy)
    fecha.setDate(fecha.getDate() - i)
    const fechaStr = fecha.toISOString().split('T')[0]
    const del_dia = arsOnly.filter(m => m.fecha === fechaStr)
    const ing = del_dia.filter(m => m.tipo === 'ingreso').reduce((s, m) => s + m.monto_ars, 0)
    const egr = del_dia.filter(m => m.tipo === 'egreso').reduce((s, m) => s + m.monto_ars, 0)
    if (i === 30) saldoAcum = saldoTotal - ing + egr
    else saldoAcum = saldoAcum + ing - egr
    resultado.push({
      fecha: fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }),
      saldo: saldoAcum,
    })
  }
  return resultado
}
