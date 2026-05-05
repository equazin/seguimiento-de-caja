import { supabase } from '@/db/schema'
import { INITIAL_BACKUP } from './initialBackup'
import { notifyDataChanged } from '@/hooks/useSupabaseQuery'

export async function seedDatosIniciales() {
  const { count, error: countError } = await supabase
    .from('categorias')
    .select('id', { count: 'exact', head: true })
  if (countError) throw countError
  if ((count ?? 0) > 0) return // Ya fue seeded

  const { error: categoriasError } = await supabase
    .from('categorias')
    .upsert(INITIAL_BACKUP.categorias, { onConflict: 'id' })
  if (categoriasError) throw categoriasError

  const { error: cuentasError } = await supabase
    .from('cuentas')
    .upsert(INITIAL_BACKUP.cuentas, { onConflict: 'id' })
  if (cuentasError) throw cuentasError

  const { error: configError } = await supabase
    .from('configuracion')
    .upsert(INITIAL_BACKUP.configuracion, { onConflict: 'clave' })
  if (configError) throw configError

  const { error: movimientosError } = await supabase
    .from('movimientos')
    .upsert(INITIAL_BACKUP.movimientos, { onConflict: 'id' })
  if (movimientosError) throw movimientosError

  notifyDataChanged()
}
