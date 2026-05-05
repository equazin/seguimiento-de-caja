import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno')
}

export type TipoMovimiento = 'ingreso' | 'egreso'
export type MetodoPago = 'transferencia' | 'mercado_pago' | 'efectivo' | 'debito' | 'credito' | 'cheque' | 'crypto'
export type TipoCuenta = 'banco' | 'digital' | 'efectivo'
export type MonedaCuenta = 'ARS' | 'USD'

export type Movimiento = {
  id: string
  fecha: string
  tipo: TipoMovimiento
  monto_ars: number
  monto_usd?: number | null
  tipo_cambio?: number | null
  categoria_id: string
  subcategoria?: string | null
  descripcion: string
  contacto?: string | null
  metodo_pago: MetodoPago
  cuenta_id: string
  comprobante_url?: string | null
  notas?: string | null
  created_at: string
  updated_at: string
}

export type Categoria = {
  id: string
  nombre: string
  tipo: TipoMovimiento
  color: string
  icono: string
}

export type Cuenta = {
  id: string
  nombre: string
  tipo: TipoCuenta
  moneda: MonedaCuenta
  saldo_inicial: number
  activa: boolean
}

export type Configuracion = {
  id: string
  clave: string
  valor: string
}

export type Database = {
  public: {
    Tables: {
      movimientos: {
        Row: Movimiento
        Insert: Omit<Movimiento, 'id' | 'created_at' | 'updated_at'> & Partial<Pick<Movimiento, 'id' | 'created_at' | 'updated_at'>>
        Update: Partial<Omit<Movimiento, 'id' | 'created_at' | 'updated_at'>> & Partial<Pick<Movimiento, 'updated_at'>>
        Relationships: []
      }
      categorias: {
        Row: Categoria
        Insert: Categoria
        Update: Partial<Omit<Categoria, 'id'>>
        Relationships: []
      }
      cuentas: {
        Row: Cuenta
        Insert: Cuenta
        Update: Partial<Omit<Cuenta, 'id'>>
        Relationships: []
      }
      configuracion: {
        Row: Configuracion
        Insert: Omit<Configuracion, 'id'> & Partial<Pick<Configuracion, 'id'>>
        Update: Partial<Omit<Configuracion, 'id'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
