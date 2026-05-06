import { cn } from '@/lib/formatters'

interface BadgeProps {
  children: React.ReactNode
  color?: string
  className?: string
  variant?:
    | 'default'
    | 'ingreso'
    | 'egreso'
    | 'borrador'
    | 'confirmado'
    | 'emitido'
    | 'rechazado'
    | 'anulado'
    | 'activo'
    | 'inactivo'
    | 'warning'
    | 'info'
}

export function Badge({ children, color, className, variant }: BadgeProps) {
  const style = color ? { backgroundColor: `${color}22`, color, borderColor: `${color}44` } : undefined

  return (
    <span
      style={style}
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium border',
        !color && variant === 'ingreso' && 'bg-success/15 text-success border-success/30',
        !color && variant === 'egreso' && 'bg-danger/15 text-danger border-danger/30',
        !color && variant === 'borrador' && 'bg-surface-3 text-muted-foreground border-border',
        !color && variant === 'confirmado' && 'bg-info/15 text-info border-info/30',
        !color && variant === 'emitido' && 'bg-success/15 text-success border-success/30',
        !color && variant === 'rechazado' && 'bg-danger/15 text-danger border-danger/30',
        !color && variant === 'anulado' && 'bg-danger/15 text-danger border-danger/30',
        !color && variant === 'activo' && 'bg-success/15 text-success border-success/30',
        !color && variant === 'inactivo' && 'bg-surface-3 text-muted-foreground border-border',
        !color && variant === 'warning' && 'bg-warning/15 text-warning border-warning/30',
        !color && variant === 'info' && 'bg-info/15 text-info border-info/30',
        !color && (!variant || variant === 'default') && 'bg-surface-2 text-muted-foreground border-border',
        className
      )}
    >
      {children}
    </span>
  )
}
