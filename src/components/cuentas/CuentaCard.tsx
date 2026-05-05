import { Banknote, Smartphone, Building2, Edit2, Power } from 'lucide-react'
import { formatMoney } from '@/lib/formatters'
import { cn } from '@/lib/formatters'
import type { Cuenta } from '@/db/schema'

const TIPO_ICONS = {
  banco: Building2,
  digital: Smartphone,
  efectivo: Banknote,
}

const TIPO_COLORS = {
  banco: '#3b82f6',
  digital: '#22c55e',
  efectivo: '#f59e0b',
}

interface Props {
  cuenta: Cuenta & { saldo_actual: number }
  onEdit: () => void
  onDesactivar: () => void
}

export function CuentaCard({ cuenta, onEdit, onDesactivar }: Props) {
  const Icon = TIPO_ICONS[cuenta.tipo]
  const color = TIPO_COLORS[cuenta.tipo]

  return (
    <div className="bg-surface border border-border rounded-xl p-5 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${color}22` }}>
            <Icon size={18} style={{ color }} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{cuenta.nombre}</p>
            <p className="text-xs text-muted-foreground capitalize">{cuenta.tipo} · {cuenta.moneda}</p>
          </div>
        </div>
        <div className="flex gap-1">
          <button
            onClick={onEdit}
            className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-surface-2 transition-colors"
            title="Editar"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={onDesactivar}
            className="p-1.5 rounded text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
            title="Desactivar"
          >
            <Power size={13} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs text-muted-foreground mb-1">Saldo actual</p>
        <p className={cn('text-2xl font-bold', cuenta.saldo_actual >= 0 ? 'text-white' : 'text-danger')}>
          {formatMoney(cuenta.saldo_actual, cuenta.moneda)}
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Inicial: {formatMoney(cuenta.saldo_inicial, cuenta.moneda)}
        </p>
      </div>
    </div>
  )
}
