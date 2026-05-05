import { useEffect, useMemo, useState, type DependencyList } from 'react'
import { supabase } from '@/db/supabase'

const DATA_CHANGE_EVENT = 'bartez:supabase-data-change'

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGE_EVENT))
}

export function useSupabaseQuery<T>(
  queryFn: () => Promise<T>,
  deps: DependencyList = [],
  realtimeTables: string[] = []
): T | undefined {
  const [data, setData] = useState<T>()
  const [refreshKey, setRefreshKey] = useState(0)
  const tablesKey = useMemo(() => realtimeTables.join(','), [realtimeTables])

  useEffect(() => {
    let cancelled = false

    queryFn()
      .then(result => {
        if (!cancelled) setData(result)
      })
      .catch(error => {
        console.error('Error consultando Supabase', error)
        if (!cancelled) setData(undefined)
      })

    return () => {
      cancelled = true
    }
  }, [refreshKey, ...deps])

  useEffect(() => {
    const refresh = () => setRefreshKey(value => value + 1)
    window.addEventListener(DATA_CHANGE_EVENT, refresh)

    if (!tablesKey) {
      return () => window.removeEventListener(DATA_CHANGE_EVENT, refresh)
    }

    const channel = supabase.channel(`bartez-db-${tablesKey}-${crypto.randomUUID()}`)
    tablesKey.split(',').forEach(table => {
      channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        refresh
      )
    })
    channel.subscribe()

    return () => {
      window.removeEventListener(DATA_CHANGE_EVENT, refresh)
      supabase.removeChannel(channel)
    }
  }, [tablesKey])

  return data
}
