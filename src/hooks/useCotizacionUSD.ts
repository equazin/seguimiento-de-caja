import { useState, useCallback } from 'react'
import { getConfiguracion, setConfiguracion } from '@/db/queries'
import { useSupabaseQuery, notifyDataChanged } from '@/hooks/useSupabaseQuery'

const KEY = 'cotizacion_usd'
const UPDATED_AT = 'cotizacion_usd_updated_at'

export function useCotizacionUSD() {
  return useSupabaseQuery(
    async () => {
      const [valor, updatedAt] = await Promise.all([
        getConfiguracion(KEY),
        getConfiguracion(UPDATED_AT),
      ])
      const num = valor ? Number(valor) : 0
      return {
        cotizacion: Number.isFinite(num) && num > 0 ? num : 0,
        updatedAt: updatedAt ?? null,
      }
    },
    [],
    ['configuracion']
  )
}

export function useUpdateCotizacionUSD() {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = useCallback(async (valor: number) => {
    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error('La cotización debe ser un número mayor a 0')
    }
    setSaving(true)
    setError(null)
    try {
      await setConfiguracion(KEY, String(valor))
      await setConfiguracion(UPDATED_AT, new Date().toISOString())
      notifyDataChanged()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar la cotización'
      setError(msg)
      throw err
    } finally {
      setSaving(false)
    }
  }, [])

  return { update, saving, error }
}

/**
 * Hook minimal con valor por defecto. Devuelve la cotización actual o un fallback.
 * Se reactualiza automáticamente cuando cambia la configuración.
 */
export function useCotizacionValor(fallback = 1): number {
  const data = useCotizacionUSD()
  if (!data) return fallback
  return data.cotizacion > 0 ? data.cotizacion : fallback
}

/**
 * Versión non-hook para usos puntuales en handlers async.
 */
export async function leerCotizacionUSD(): Promise<number> {
  const valor = await getConfiguracion(KEY)
  const num = valor ? Number(valor) : 0
  return Number.isFinite(num) && num > 0 ? num : 0
}

