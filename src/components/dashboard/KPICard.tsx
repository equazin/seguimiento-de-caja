import { type LucideIcon } from 'lucide-react'
import { cn, formatMoney } from '@/lib/formatters'

interface KPICardProps {
  titulo: string
  valor: number
  icono: LucideIcon
  variante?: 'default' | 'ingreso' | 'egreso' | 'neutral'
  subtitulo?: string
  moneda?: 'ARS' | 'USD'
}

export function KPICard({ titulo, valor, icono: Icon, variante = 'default', subtitulo, moneda = 'ARS' }: KPICardProps) {
  const colorMap = {
    default: { bg: 'bg-primary/15', text: 'text-primary', border: 'border-primary/20' },
    ingreso: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/20' },
    egreso: { bg: 'bg-danger/15', text: 'text-danger', border: 'border-danger/20' },
    neutral: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/20' },
  }
  const colors = colorMap[variante]

  return (
    <div className={cn('rounded-xl border border-border bg-surface/90 p-5 shadow-xl shadow-black/10')}>
      <div className="flex items-start justify-between mb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{titulo}</p>
        <div className={cn('p-2 rounded-lg', colors.bg, colors.border, 'border')}>
          <Icon size={16} className={colors.text} />
        </div>
      </div>
      <p className={cn(
        'text-2xl font-bold',
        variante === 'ingreso' && 'text-success',
        variante === 'egreso' && 'text-danger',
        variante === 'default' && 'text-white',
        variante === 'neutral' && valor >= 0 ? 'text-success' : 'text-danger',
      )}>
        {formatMoney(valor, moneda)}
      </p>
      {subtitulo && <p className="text-xs text-muted-foreground mt-1.5">{subtitulo}</p>}
    </div>
  )
}
