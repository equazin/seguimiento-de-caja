import type {
  CondicionIvaContacto,
  TipoDocumentoFiscal,
  TipoProducto,
} from '@/db/schema'
import type { ContactoImport, ProductoImport } from '@/hooks/useCatalogo'
import { isValidCuit, onlyDigits, shouldValidateCuit } from '@/lib/validators'

export type CatalogoImportTipo = 'cliente' | 'proveedor' | 'producto'

export interface ImportParseResult<T> {
  rows: T[]
  errors: string[]
}

type RawRow = Record<string, unknown>

const CONTACTO_DEFAULTS: Record<'cliente' | 'proveedor', {
  condicion_iva: CondicionIvaContacto
}> = {
  cliente: { condicion_iva: 'consumidor_final' },
  proveedor: { condicion_iva: 'responsable_inscripto' },
}

const TIPOS_DOCUMENTO = new Set<TipoDocumentoFiscal>([
  'CUIT',
  'CUIL',
  'DNI',
  'CDI',
  'LE',
  'LC',
  'PASAPORTE',
  'OTRO',
])

const CONDICIONES_IVA = new Set<CondicionIvaContacto>([
  'responsable_inscripto',
  'monotributo',
  'exento',
  'consumidor_final',
  'no_categorizado',
])

const TIPOS_PRODUCTO = new Set<TipoProducto>(['producto', 'servicio'])

const HEADER_ALIASES: Record<string, string> = {
  razonsocial: 'razon_social',
  razon_social: 'razon_social',
  nombre: 'nombre',
  nombrefantasia: 'nombre_fantasia',
  nombre_fantasia: 'nombre_fantasia',
  fantasia: 'nombre_fantasia',
  tipodocumento: 'tipo_documento',
  tipo_documento: 'tipo_documento',
  documento: 'numero_documento',
  numerodocumento: 'numero_documento',
  numero_documento: 'numero_documento',
  cuit: 'numero_documento',
  cuil: 'numero_documento',
  condicioniva: 'condicion_iva',
  condicion_iva: 'condicion_iva',
  iva: 'condicion_iva',
  email: 'email',
  mail: 'email',
  telefono: 'telefono',
  domicilio: 'domicilio',
  direccion: 'domicilio',
  localidad: 'localidad',
  provincia: 'provincia',
  codigopostal: 'codigo_postal',
  codigo_postal: 'codigo_postal',
  cp: 'codigo_postal',
  notas: 'notas',
  activo: 'activo',
  codigo: 'codigo',
  descripcion: 'descripcion',
  tipo: 'tipo',
  unidad: 'unidad_medida',
  unidadmedida: 'unidad_medida',
  unidad_medida: 'unidad_medida',
  precioneto: 'precio_neto',
  precio_neto: 'precio_neto',
  precio: 'precio_neto',
  alicuotaiva: 'alicuota_iva',
  alicuota_iva: 'alicuota_iva',
  stockeable: 'stockeable',
  manejastock: 'stockeable',
  stock: 'stock_actual',
  stockactual: 'stock_actual',
  stock_actual: 'stock_actual',
  stockminimo: 'stock_minimo',
  stock_minimo: 'stock_minimo',
}

const CONDICION_ALIASES: Record<string, CondicionIvaContacto> = {
  ri: 'responsable_inscripto',
  responsableinscripto: 'responsable_inscripto',
  responsable_inscripto: 'responsable_inscripto',
  monotributo: 'monotributo',
  exento: 'exento',
  consumidorfinal: 'consumidor_final',
  consumidor_final: 'consumidor_final',
  cf: 'consumidor_final',
  nocategorizado: 'no_categorizado',
  no_categorizado: 'no_categorizado',
}

export async function readCatalogFile(file: File): Promise<RawRow[]> {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  if (!sheetName) return []
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: '' })
}

export function parseContactos(
  rawRows: RawRow[],
  tipo: 'cliente' | 'proveedor'
): ImportParseResult<ContactoImport> {
  const rows: ContactoImport[] = []
  const errors: string[] = []

  rawRows.forEach((raw, idx) => {
    const row = normalizeRow(raw)
    const line = idx + 2
    const razonSocial = text(row.razon_social || row.nombre)
    if (!razonSocial) {
      errors.push(`Fila ${line}: falta razon_social`)
      return
    }

    const tipoDocumento = parseTipoDocumento(row.tipo_documento)
    const numeroDocumento = parseDocumento(row.numero_documento, tipoDocumento)
    if (shouldValidateCuit(tipoDocumento) && numeroDocumento && !isValidCuit(numeroDocumento)) {
      errors.push(`Fila ${line}: ${tipoDocumento} invalido`)
      return
    }

    const condicionIva = parseCondicionIva(row.condicion_iva)
      ?? CONTACTO_DEFAULTS[tipo].condicion_iva
    if (!CONDICIONES_IVA.has(condicionIva)) {
      errors.push(`Fila ${line}: condicion_iva invalida`)
      return
    }

    rows.push({
      razon_social: razonSocial,
      nombre_fantasia: nullableText(row.nombre_fantasia),
      tipo_documento: tipoDocumento,
      numero_documento: numeroDocumento || null,
      condicion_iva: condicionIva,
      email: nullableText(row.email),
      telefono: nullableText(row.telefono),
      domicilio: nullableText(row.domicilio),
      localidad: nullableText(row.localidad),
      provincia: nullableText(row.provincia),
      codigo_postal: nullableText(row.codigo_postal),
      notas: nullableText(row.notas),
      activo: parseBoolean(row.activo, true),
    })
  })

  return { rows, errors }
}

export function parseProductos(rawRows: RawRow[]): ImportParseResult<ProductoImport> {
  const rows: ProductoImport[] = []
  const errors: string[] = []

  rawRows.forEach((raw, idx) => {
    const row = normalizeRow(raw)
    const line = idx + 2
    const nombre = text(row.nombre)
    if (!nombre) {
      errors.push(`Fila ${line}: falta nombre`)
      return
    }

    const tipo = parseTipoProducto(row.tipo)
    const precio = parseNumber(row.precio_neto, 0)
    const alicuotaIva = parseNumber(row.alicuota_iva, 21)
    const stockeable = tipo === 'servicio' ? false : parseBoolean(row.stockeable, true)
    if (precio < 0) {
      errors.push(`Fila ${line}: precio_neto no puede ser negativo`)
      return
    }

    rows.push({
      codigo: nullableText(row.codigo),
      nombre,
      descripcion: nullableText(row.descripcion),
      tipo,
      unidad_medida: text(row.unidad_medida) || 'unidad',
      precio_neto: precio,
      alicuota_iva: alicuotaIva,
      stockeable,
      stock_actual: stockeable ? parseNumber(row.stock_actual, 0) : 0,
      stock_minimo: stockeable ? parseNumber(row.stock_minimo, 0) : 0,
      activo: parseBoolean(row.activo, true),
    })
  })

  return { rows, errors }
}

function normalizeRow(row: RawRow): RawRow {
  const normalized: RawRow = {}
  Object.entries(row).forEach(([key, value]) => {
    const normalizedKey = HEADER_ALIASES[normalizeKey(key)] ?? key
    normalized[normalizedKey] = value
  })
  return normalized
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .toLowerCase()
}

function text(value: unknown): string {
  return String(value ?? '').trim()
}

function nullableText(value: unknown): string | null {
  const result = text(value)
  return result || null
}

function parseTipoDocumento(value: unknown): TipoDocumentoFiscal {
  const raw = text(value).toUpperCase()
  return TIPOS_DOCUMENTO.has(raw as TipoDocumentoFiscal)
    ? raw as TipoDocumentoFiscal
    : 'CUIT'
}

function parseDocumento(value: unknown, tipoDocumento: TipoDocumentoFiscal): string {
  const raw = text(value)
  return shouldValidateCuit(tipoDocumento) ? onlyDigits(raw) : raw
}

function parseCondicionIva(value: unknown): CondicionIvaContacto | null {
  const raw = text(value)
  if (!raw) return null
  const normalized = normalizeKey(raw)
  return CONDICION_ALIASES[normalized] ?? null
}

function parseTipoProducto(value: unknown): TipoProducto {
  const raw = normalizeKey(text(value))
  return TIPOS_PRODUCTO.has(raw as TipoProducto) ? raw as TipoProducto : 'producto'
}

function parseNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const normalized = text(value).replace(/\./g, '').replace(',', '.')
  if (!normalized) return fallback
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : fallback
}

function parseBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value
  const raw = normalizeKey(text(value))
  if (!raw) return fallback
  if (['1', 'si', 'sí', 'true', 'activo', 'x'].includes(raw)) return true
  if (['0', 'no', 'false', 'inactivo'].includes(raw)) return false
  return fallback
}
