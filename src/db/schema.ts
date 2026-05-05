import Dexie, { type Table } from 'dexie'

export type TipoMovimiento = 'ingreso' | 'egreso'
export type MetodoPago = 'transferencia' | 'mercado_pago' | 'efectivo' | 'debito' | 'credito' | 'cheque' | 'crypto'
export type TipoCuenta = 'banco' | 'digital' | 'efectivo'
export type MonedaCuenta = 'ARS' | 'USD'

export interface Movimiento {
  id: string
  fecha: string
  tipo: TipoMovimiento
  monto_ars: number
  monto_usd?: number
  tipo_cambio?: number
  categoria_id: string
  subcategoria?: string
  descripcion: string
  contacto?: string
  metodo_pago: MetodoPago
  cuenta_id: string
  comprobante_url?: string
  notas?: string
  created_at: string
  updated_at: string
}

export interface Categoria {
  id: string
  nombre: string
  tipo: TipoMovimiento
  color: string
  icono: string
}

export interface Cuenta {
  id: string
  nombre: string
  tipo: TipoCuenta
  moneda: MonedaCuenta
  saldo_inicial: number
  activa: boolean
}

export interface Presupuesto {
  id: string
  categoria_id: string
  mes: string
  monto_limite: number
}

export interface Configuracion {
  id: string
  clave: string
  valor: string
}

export class BartezDB extends Dexie {
  movimientos!: Table<Movimiento>
  categorias!: Table<Categoria>
  cuentas!: Table<Cuenta>
  presupuestos!: Table<Presupuesto>
  configuracion!: Table<Configuracion>

  constructor() {
    super('BartezCajaDB')
    this.version(1).stores({
      movimientos: 'id, fecha, tipo, categoria_id, cuenta_id, metodo_pago, contacto, created_at',
      categorias: 'id, nombre, tipo',
      cuentas: 'id, nombre, tipo, activa',
      presupuestos: 'id, categoria_id, mes',
      configuracion: 'id, clave',
    })
  }
}

export const db = new BartezDB()
