import { createClient, type SupabaseClient } from '@supabase/supabase-js'

// Cliente Supabase para las tablas del modulo comercial/fiscal.
//
// No tipamos el Database porque agregar 10+ tablas a Database hace
// colapsar la inferencia del cliente original (errores "type never"
// en archivos no relacionados). El tipado se mantiene en la capa
// de hooks/queries via los interfaces de src/db/afip.ts.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en el entorno')
}

export const supabaseAfip: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey)
