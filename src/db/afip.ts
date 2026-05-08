// Modelos del modulo comercial/fiscal (AFIP/ARCA).
// Mantengo los tipos del esquema original en supabase.ts.

export type CondicionIvaEmpresa =
  | 'responsable_inscripto'
  | 'monotributo'
  | 'exento'
  | 'consumidor_final'

export type CondicionIvaContacto = CondicionIvaEmpresa | 'no_categorizado'

export type ArcaAmbiente = 'homologacion' | 'produccion'

export type TipoDocumentoFiscal =
  | 'CUIT'
  | 'CUIL'
  | 'DNI'
  | 'CDI'
  | 'LE'
  | 'LC'
  | 'PASAPORTE'
  | 'OTRO'

export type RolUsuario = 'admin' | 'operador' | 'lectura'

export type TipoOperacion = 'venta' | 'compra'

export type TipoDocumentoComercial =
  | 'pedido'
  | 'presupuesto'
  | 'remito'
  | 'factura'
  | 'nota_credito'
  | 'nota_debito'

export type LetraComprobante = 'A' | 'B' | 'C' | 'M' | 'X' | 'R'

export type EstadoDocumento =
  | 'borrador'
  | 'confirmado'
  | 'emitido'
  | 'anulado'
  | 'facturado'
  | 'facturado_parcial'
  | 'remitido'
  | 'remitido_parcial'

export type TipoEmisionPV = 'electronica' | 'manual' | 'controlador_fiscal'
export type TipoProducto = 'producto' | 'servicio'
export type TipoStockMovimiento = 'ingreso' | 'egreso' | 'ajuste'
export type TipoRelacionDocumento = 'origen' | 'anulacion' | 'ajuste'
export type ResultadoArca = 'A' | 'R' | 'P'

export interface Empresa {
  id: string
  razon_social: string
  nombre_fantasia: string | null
  cuit: string
  condicion_iva: CondicionIvaEmpresa
  domicilio_fiscal: string | null
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  email: string | null
  telefono: string | null
  ingresos_brutos: string | null
  inicio_actividades: string | null
  arca_ambiente: ArcaAmbiente
  logo_url: string | null
  created_at: string
  updated_at: string
}

export interface PuntoVenta {
  id: string
  empresa_id: string
  numero: number
  nombre: string
  tipo_emision: TipoEmisionPV
  activo: boolean
  created_at: string
}

export interface EmpresaUsuario {
  id: string
  empresa_id: string
  user_id: string
  rol: RolUsuario
  created_at: string
}

interface ContactoBase {
  id: string
  empresa_id: string
  razon_social: string
  nombre_fantasia: string | null
  tipo_documento: TipoDocumentoFiscal
  numero_documento: string | null
  condicion_iva: CondicionIvaContacto
  email: string | null
  telefono: string | null
  domicilio: string | null
  localidad: string | null
  provincia: string | null
  codigo_postal: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

export type Cliente = ContactoBase
export type Proveedor = ContactoBase

export interface Producto {
  id: string
  empresa_id: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  tipo: TipoProducto
  unidad_medida: string
  precio_neto: number
  alicuota_iva: number
  stockeable: boolean
  stock_actual: number
  stock_minimo: number
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Documento {
  id: string
  empresa_id: string
  tipo_operacion: TipoOperacion
  tipo_documento: TipoDocumentoComercial
  letra: LetraComprobante | null
  estado: EstadoDocumento
  numero_interno: string
  punto_venta_id: string | null
  cliente_id: string | null
  proveedor_id: string | null
  fecha: string
  fecha_vencimiento: string | null
  moneda: 'ARS' | 'USD'
  tipo_cambio: number
  subtotal: number
  iva_total: number
  exento: number
  no_gravado: number
  percepciones: number
  total: number
  // Totales en USD (moneda primaria de carga)
  subtotal_usd: number | null
  iva_total_usd: number | null
  exento_usd: number | null
  no_gravado_usd: number | null
  percepciones_usd: number | null
  total_usd: number | null
  observaciones: string | null
  cuenta_id: string | null
  movimiento_id: string | null
  created_at: string
  updated_at: string
}

export interface DocumentoItem {
  id: string
  documento_id: string
  producto_id: string | null
  orden: number
  codigo: string | null
  descripcion: string
  cantidad: number
  unidad_medida: string
  precio_unitario: number
  bonificacion: number
  alicuota_iva: number
  iva_importe: number
  subtotal: number
  total: number
  // Mismos importes en USD
  precio_unitario_usd: number | null
  iva_importe_usd: number | null
  subtotal_usd: number | null
  total_usd: number | null
}

export interface DocumentoRelacion {
  id: string
  origen_id: string
  destino_id: string
  tipo_relacion: TipoRelacionDocumento
  created_at: string
}

export interface ArcaComprobante {
  id: string
  documento_id: string
  empresa_id: string
  ambiente: ArcaAmbiente
  punto_venta: number
  tipo_comprobante: number
  numero_comprobante: number | null
  cae: string | null
  cae_vencimiento: string | null
  resultado: ResultadoArca | null
  request_resumen: Record<string, unknown> | null
  response_resumen: Record<string, unknown> | null
  errores: Record<string, unknown> | null
  observaciones: Record<string, unknown> | null
  enviado_at: string | null
  created_at: string
}

export interface StockMovimiento {
  id: string
  empresa_id: string
  producto_id: string
  documento_id: string | null
  tipo: TipoStockMovimiento
  cantidad: number
  motivo: string | null
  created_at: string
}
