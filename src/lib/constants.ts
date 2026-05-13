import type { Categoria, Cuenta, MetodoPago } from '@/db/schema'

export const CATEGORIAS_DEFAULT: Omit<Categoria, never>[] = [
  // Egresos
  { id: 'cat-mercaderia', nombre: 'Compra de mercaderia', tipo: 'egreso', color: '#ef4444', icono: '\u{1F4E6}' },
  { id: 'cat-nafta', nombre: 'Nafta/Combustible', tipo: 'egreso', color: '#f59e0b', icono: '\u26FD' },
  { id: 'cat-servicios', nombre: 'Servicios (luz/internet)', tipo: 'egreso', color: '#8b5cf6', icono: '\u{1F4A1}' },
  { id: 'cat-alquiler', nombre: 'Alquiler', tipo: 'egreso', color: '#06b6d4', icono: '\u{1F3E0}' },
  { id: 'cat-sueldos', nombre: 'Sueldos/Honorarios', tipo: 'egreso', color: '#ec4899', icono: '\u{1F465}' },
  { id: 'cat-marketing', nombre: 'Marketing', tipo: 'egreso', color: '#14b8a6', icono: '\u{1F4E2}' },
  { id: 'cat-logistica', nombre: 'Logistica/Flete', tipo: 'egreso', color: '#f97316', icono: '\u{1F69A}' },
  { id: 'cat-impuestos', nombre: 'Impuestos/IIBB/Tasas', tipo: 'egreso', color: '#64748b', icono: '\u{1F3DB}\uFE0F' },
  { id: 'cat-retiro', nombre: 'Retiro personal/Dueno', tipo: 'egreso', color: '#a78bfa', icono: '\u{1F4B0}' },
  { id: 'cat-bancarios', nombre: 'Gastos bancarios', tipo: 'egreso', color: '#6366f1', icono: '\u{1F3E6}' },
  { id: 'cat-otros-egreso', nombre: 'Otros gastos', tipo: 'egreso', color: '#6b7280', icono: '\u{1F4CB}' },
  // Ingresos
  { id: 'cat-venta-equipos', nombre: 'Venta a clientes', tipo: 'ingreso', color: '#22c55e', icono: '\u{1F6D2}' },
  { id: 'cat-servicios-it', nombre: 'Servicios IT/Soporte', tipo: 'ingreso', color: '#10b981', icono: '\u{1F527}' },
  { id: 'cat-cobro-deuda', nombre: 'Cobro de deuda', tipo: 'ingreso', color: '#3b82f6', icono: '\u{1F4B3}' },
  { id: 'cat-comisiones', nombre: 'Comisiones', tipo: 'ingreso', color: '#84cc16', icono: '\u{1F91D}' },
  { id: 'cat-otros-ingreso', nombre: 'Otros ingresos', tipo: 'ingreso', color: '#06b6d4', icono: '\u2795' },
]

export const CUENTAS_DEFAULT: Omit<Cuenta, never>[] = [
  { id: 'cuenta-macro', nombre: 'Banco Macro ARS', tipo: 'banco', moneda: 'ARS', saldo_inicial: 0, activa: true },
  { id: 'cuenta-mp', nombre: 'Mercado Pago', tipo: 'digital', moneda: 'ARS', saldo_inicial: 0, activa: true },
  { id: 'cuenta-efectivo', nombre: 'Caja Efectivo', tipo: 'efectivo', moneda: 'ARS', saldo_inicial: 0, activa: true },
]

export const CUENTA_ECHEQS_ARS_ID = 'cuenta-echeqs-ars'
export const CUENTA_ECHEQS_USD_ID = 'cuenta-echeqs-usd'

export function cuentaEcheqsId(moneda: 'ARS' | 'USD'): string {
  return moneda === 'USD' ? CUENTA_ECHEQS_USD_ID : CUENTA_ECHEQS_ARS_ID
}

export const METODOS_PAGO: { value: MetodoPago; label: string; icono: string }[] = [
  { value: 'transferencia', label: 'Transferencia', icono: '\u{1F3E6}' },
  { value: 'mercado_pago', label: 'Mercado Pago', icono: '\u{1F499}' },
  { value: 'efectivo', label: 'Efectivo', icono: '\u{1F4B5}' },
  { value: 'debito', label: 'Debito', icono: '\u{1F4B3}' },
  { value: 'credito', label: 'Credito', icono: '\u{1F4B3}' },
  { value: 'cheque', label: 'Cheque', icono: '\u{1F4C4}' },
  { value: 'echeq', label: 'E-cheq', icono: '\u{1F9FE}' },
  { value: 'crypto', label: 'Crypto', icono: '\u20BF' },
]

export const ICONOS_DISPONIBLES = [
  '\u{1F4E6}', '\u26FD', '\u{1F4A1}', '\u{1F3E0}', '\u{1F465}', '\u{1F4E2}', '\u{1F69A}', '\u{1F3DB}\uFE0F',
  '\u{1F4B0}', '\u{1F3E6}', '\u{1F4CB}', '\u{1F6D2}', '\u{1F527}', '\u{1F4B3}', '\u{1F91D}', '\u2795',
  '\u{1F4F1}', '\u{1F4BB}', '\u{1F5A8}\uFE0F', '\u{1F5B1}\uFE0F', '\u2328\uFE0F', '\u{1F50C}', '\u{1F4E1}',
  '\u{1F50B}', '\u{1F4BE}', '\u{1F4F7}', '\u{1F3AE}', '\u{1F510}', '\u{1F4CA}', '\u{1F4C8}', '\u{1F4C9}',
]

export const COLORES_DISPONIBLES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#6b7280', '#9ca3af',
]
