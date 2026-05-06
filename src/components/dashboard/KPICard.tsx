import { ArrowDown, ArrowUp, Minus, type LucideIcon } from 'lucide-react'
import { cn, formatMoney } from '@/lib/formatters'

interface DeltaInfo {
  valorAnterior: number
  /**
   * Cuando true, una caída de valor se interpreta como positiva (ej: egresos).
   * Default: false (subir es bueno).
   */
  invertirSigno?: boolean
  labelComparacion?: string
}

interface KPICardProps {
  titulo: string
  valor: number
  icono: LucideIcon
  variante?: 'default' | 'ingreso' | 'egreso' | 'neutral'
  subtitulo?: string
  moneda?: 'ARS' | 'USD'
  delta?: DeltaInfo
}

interface DeltaResult {
  pct: number | null
  abs: number
  direccion: 'up' | 'down' | 'flat'
  esBueno: boolean
}

function calcularDelta(valor: number, anterior: number, invertirSigno: boolean): DeltaResult {
  const abs = valor - anterior
  let direccion: DeltaResult['direccion'] = 'flat'
  if (abs > 0.005) direccion = 'up'
  else if (abs < -0.005) direccion = 'down'

  let pct: number | null = null
  if (anterior !== 0) {
    pct = (abs / Math.abs(anterior)) * 100
  } else if (abs !== 0) {
    pct = null
  }

  const esBueno = direccion === 'flat'
    ? true
    : invertirSigno
      ? direccion === 'down'
      : direccion === 'up'

  return { pct, abs, direccion, esBueno }
}

export function KPICard({ titulo, valor, icono: Icon, variante = 'default', subtitulo, moneda = 'ARS', delta }: KPICardProps) {
  const colorMap = {
    default: { bg: 'bg-primary/15', text: 'text-primary', border: 'border-primary/20' },
    ingreso: { bg: 'bg-success/15', text: 'text-success', border: 'border-success/20' },
    egreso: { bg: 'bg-danger/15', text: 'text-danger', border: 'border-danger/20' },
    neutral: { bg: 'bg-warning/15', text: 'text-warning', border: 'border-warning/20' },
  }
  const colors = colorMap[variante]
  const deltaCalc = delta ? calcularDelta(valor, delta.valorAnterior, delta.invertirSigno ?? false) : null
  const DeltaIcon = deltaCalc?.direccion === 'up' ? ArrowUp : deltaCalc?.direccion === 'down' ? ArrowDown : Minus

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
      {deltaCalc && (
        <div className="mt-2 flex items-center gap-1.5 text-xs">
          <span className={cn(
            'inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-medium',
            deltaCalc.direccion === 'flat'
              ? 'bg-surface-2 text-muted-foreground'
              : deltaCalc.esBueno
                ? 'bg-success/15 text-success'
                : 'bg-danger/15 text-danger'
          )}>
            <DeltaIcon size={11} />
            {deltaCalc.pct === null
              ? formatMoney(Math.abs(deltaCalc.abs), moneda)
              : `${Math.abs(deltaCalc.pct).toFixed(0)}%`}
          </span>
          <span className="text-muted-foreground">{delta?.labelComparacion ?? 'vs mes anterior'}</span>
        </div>
      )}
      {subtitulo && !deltaCalc && <p className="text-xs text-muted-foreground mt-1.5">{subtitulo}</p>}
    </div>
  )
}
