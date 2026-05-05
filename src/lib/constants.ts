import type { Categoria, Cuenta, MetodoPago } from '@/db/schema'

export const CATEGORIAS_DEFAULT: Omit<Categoria, never>[] = [
  // Egresos
  { id: 'cat-mercaderia', nombre: 'Compra de mercadería', tipo: 'egreso', color: '#ef4444', icono: '📦' },
  { id: 'cat-nafta', nombre: 'Nafta/Combustible', tipo: 'egreso', color: '#f59e0b', icono: '⛽' },
  { id: 'cat-servicios', nombre: 'Servicios (luz/internet)', tipo: 'egreso', color: '#8b5cf6', icono: '💡' },
  { id: 'cat-alquiler', nombre: 'Alquiler', tipo: 'egreso', color: '#06b6d4', icono: '🏠' },
  { id: 'cat-sueldos', nombre: 'Sueldos/Honorarios', tipo: 'egreso', color: '#ec4899', icono: '👥' },
  { id: 'cat-marketing', nombre: 'Marketing', tipo: 'egreso', color: '#14b8a6', icono: '📢' },
  { id: 'cat-logistica', nombre: 'Logística/Flete', tipo: 'egreso', color: '#f97316', icono: '🚚' },
  { id: 'cat-impuestos', nombre: 'Impuestos/IIBB/Tasas', tipo: 'egreso', color: '#64748b', icono: '🏛️' },
  { id: 'cat-retiro', nombre: 'Retiro personal/Dueño', tipo: 'egreso', color: '#a78bfa', icono: '💰' },
  { id: 'cat-bancarios', nombre: 'Gastos bancarios', tipo: 'egreso', color: '#6366f1', icono: '🏦' },
  { id: 'cat-otros-egreso', nombre: 'Otros gastos', tipo: 'egreso', color: '#6b7280', icono: '📋' },
  // Ingresos
  { id: 'cat-venta-equipos', nombre: 'Venta de equipos', tipo: 'ingreso', color: '#22c55e', icono: '🖥️' },
  { id: 'cat-servicios-it', nombre: 'Servicios IT/Soporte', tipo: 'ingreso', color: '#10b981', icono: '🔧' },
  { id: 'cat-cobro-deuda', nombre: 'Cobro de deuda', tipo: 'ingreso', color: '#3b82f6', icono: '💳' },
  { id: 'cat-comisiones', nombre: 'Comisiones', tipo: 'ingreso', color: '#84cc16', icono: '🤝' },
  { id: 'cat-otros-ingreso', nombre: 'Otros ingresos', tipo: 'ingreso', color: '#06b6d4', icono: '➕' },
]

export const CUENTAS_DEFAULT: Omit<Cuenta, never>[] = [
  { id: 'cuenta-macro', nombre: 'Banco Macro ARS', tipo: 'banco', moneda: 'ARS', saldo_inicial: 0, activa: true },
  { id: 'cuenta-mp', nombre: 'Mercado Pago', tipo: 'digital', moneda: 'ARS', saldo_inicial: 0, activa: true },
  { id: 'cuenta-efectivo', nombre: 'Caja Efectivo', tipo: 'efectivo', moneda: 'ARS', saldo_inicial: 0, activa: true },
]

export const METODOS_PAGO: { value: MetodoPago; label: string; icono: string }[] = [
  { value: 'transferencia', label: 'Transferencia', icono: '🏦' },
  { value: 'mercado_pago', label: 'Mercado Pago', icono: '💙' },
  { value: 'efectivo', label: 'Efectivo', icono: '💵' },
  { value: 'debito', label: 'Débito', icono: '💳' },
  { value: 'credito', label: 'Crédito', icono: '💳' },
  { value: 'cheque', label: 'Cheque', icono: '📄' },
  { value: 'crypto', label: 'Crypto', icono: '₿' },
]

export const ICONOS_DISPONIBLES = [
  '📦', '⛽', '💡', '🏠', '👥', '📢', '🚚', '🏛️', '💰', '🏦', '📋',
  '🖥️', '🔧', '💳', '🤝', '➕', '🛒', '📱', '💻', '🖨️', '🖱️', '⌨️',
  '🔌', '📡', '🔋', '💾', '📷', '🎮', '🔐', '📊', '📈', '📉',
]

export const COLORES_DISPONIBLES = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#6b7280', '#9ca3af',
]
