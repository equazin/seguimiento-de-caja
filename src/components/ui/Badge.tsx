import { cn } from '@/lib/formatters'

interface BadgeProps {
  children: React.ReactNode
  color?: string
  className?: string
  variant?: 'default' | 'ingreso' | 'egreso'
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
        !color && !variant && 'bg-surface-2 text-muted-foreground border-border',
        className
      )}
    >
      {children}
    </span>
  )
}
