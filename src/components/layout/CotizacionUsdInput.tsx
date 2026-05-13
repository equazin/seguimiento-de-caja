import { useEffect, useState } from 'react'
import { DollarSign, Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useCotizacionUSD, useUpdateCotizacionUSD } from '@/hooks/useCotizacionUSD'
import { cn, formatDateTime } from '@/lib/formatters'

/**
 * Input inline en el header para editar la cotización USD.
 * Auto-save al perder foco o presionar Enter.
 */
export function CotizacionUsdInput() {
  const data = useCotizacionUSD()
  const { update, saving } = useUpdateCotizacionUSD()
  const [valor, setValor] = useState('')
  const [dirty, setDirty] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)

  useEffect(() => {
    if (!data) return
    if (!dirty) {
      setValor(data.cotizacion > 0 ? String(data.cotizacion) : '')
    }
  }, [data?.cotizacion, dirty])

  async function commit() {
    if (!dirty) return
    const num = Number(valor.replace(',', '.'))
    if (!Number.isFinite(num) || num <= 0) {
      toast.error('La cotización debe ser un número mayor a 0')
      setValor(data?.cotizacion ? String(data.cotizacion) : '')
      setDirty(false)
      return
    }
    if (data && Math.abs(num - data.cotizacion) < 0.001) {
      setDirty(false)
      return
    }
    try {
      await update(num)
      setDirty(false)
      setSavedAt(Date.now())
      toast.success(`Cotización actualizada a ${num}`)
      window.setTimeout(() => setSavedAt(null), 1500)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo guardar'
      toast.error(msg)
    }
  }

  const updatedLabel = data?.updatedAt
    ? `Actualizada ${formatDateTime(data.updatedAt)}`
    : 'Sin actualizar'

  const recentlySaved = savedAt !== null && Date.now() - savedAt < 1500

  return (
    <div
      className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface-2/60 py-1 pl-2 pr-1 sm:flex"
      title={updatedLabel}
    >
      <DollarSign size={14} className="text-muted-foreground" />
      <span className="text-xs text-muted-foreground">USD</span>
      <input
        type="number"
        step="0.01"
        min="0"
        value={valor}
        onChange={e => {
          setValor(e.target.value)
          setDirty(true)
        }}
        onBlur={() => void commit()}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            ;(e.target as HTMLInputElement).blur()
          }
          if (e.key === 'Escape') {
            setValor(data?.cotizacion ? String(data.cotizacion) : '')
            setDirty(false)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        placeholder="0.00"
        className={cn(
          'w-20 bg-transparent px-1 text-right text-sm font-semibold tabular-nums text-white outline-none',
          dirty && 'text-primary'
        )}
      />
      <span className="flex h-6 w-6 items-center justify-center text-muted-foreground">
        {saving ? (
          <Loader2 size={14} className="animate-spin text-primary" />
        ) : recentlySaved ? (
          <Check size={14} className="text-success" />
        ) : null}
      </span>
    </div>
  )
}
