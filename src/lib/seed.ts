import { db } from '@/db/schema'
import { CATEGORIAS_DEFAULT, CUENTAS_DEFAULT } from './constants'
import { v4 as uuidv4 } from 'uuid'

export async function seedDatosIniciales() {
  const catCount = await db.categorias.count()
  if (catCount > 0) return // Ya fue seeded

  await db.categorias.bulkAdd(CATEGORIAS_DEFAULT)
  await db.cuentas.bulkAdd(CUENTAS_DEFAULT)

  // Config inicial
  await db.configuracion.bulkAdd([
    { id: uuidv4(), clave: 'nombre_negocio', valor: 'Bartez Tecnología' },
    { id: uuidv4(), clave: 'moneda_base', valor: 'ARS' },
    { id: uuidv4(), clave: 'cotizacion_usd', valor: '1280' },
  ])
}
