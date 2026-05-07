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

export type EstadoPedidoCompra = 'pendiente' | 'pagado_parcial' | 'pagado_total' | 'cancelado'
export type EstadoPedidoVenta = 'pendiente' | 'cobrado_parcial' | 'cobrado_total' | 'cancelado'

export type PedidoItem = {
  descripcion: string
  cantidad: number
  precio_unitario: number
}

export type PedidoCompra = {
  id: string
  numero: string
  proveedor: string
  proveedor_id?: string | null
  fecha: string
  fecha_vencimiento?: string | null
  estado: EstadoPedidoCompra
  monto_total: number
  monto_total_usd?: number | null
  tipo_cambio?: number | null
  descripcion?: string | null
  items?: PedidoItem[] | null
  notas?: string | null
  created_at: string
}

export type PedidoVenta = {
  id: string
  numero: string
  cliente: string
  cliente_id?: string | null
  fecha: string
  fecha_vencimiento?: string | null
  estado: EstadoPedidoVenta
  monto_total: number
  monto_total_usd?: number | null
  tipo_cambio?: number | null
  descripcion?: string | null
  items?: PedidoItem[] | null
  notas?: string | null
  created_at: string
}

export type MovimientoVinculo = {
  id: string
  movimiento_id: string
  pedido_compra_id?: string | null
  pedido_venta_id?: string | null
  monto_aplicado: number
  notas?: string | null
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
      pedidos_compra: {
        Row: PedidoCompra
        Insert: Omit<PedidoCompra, 'id' | 'created_at'> & Partial<Pick<PedidoCompra, 'id' | 'created_at'>>
        Update: Partial<Omit<PedidoCompra, 'id' | 'created_at'>>
        Relationships: []
      }
      pedidos_venta: {
        Row: PedidoVenta
        Insert: Omit<PedidoVenta, 'id' | 'created_at'> & Partial<Pick<PedidoVenta, 'id' | 'created_at'>>
        Update: Partial<Omit<PedidoVenta, 'id' | 'created_at'>>
        Relationships: []
      }
      movimiento_vinculos: {
        Row: MovimientoVinculo
        Insert: Omit<MovimientoVinculo, 'id'> & Partial<Pick<MovimientoVinculo, 'id'>>
        Update: Partial<Omit<MovimientoVinculo, 'id'>>
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
