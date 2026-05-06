import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/formatters'

interface StatusPanelProps {
  icon: LucideIcon
  title: string
  badge?: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info'
  children?: React.ReactNode
}

const TONE_CLASSES = {
  default: 'bg-primary/12 border-primary/25 text-primary',
  success: 'bg-success/12 border-success/25 text-success',
  warning: 'bg-warning/12 border-warning/25 text-warning',
  danger: 'bg-danger/12 border-danger/25 text-danger',
  info: 'bg-info/12 border-info/25 text-info',
}

export function StatusPanel({
  icon: Icon,
  title,
  badge,
  description,
  actions,
  tone = 'default',
  children,
}: StatusPanelProps) {
  return (
    <section className="rounded-xl border border-border bg-surface/90 p-6 shadow-xl shadow-black/10">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-start gap-4">
          <div className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border', TONE_CLASSES[tone])}>
            <Icon size={22} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-white">{title}</h2>
              {badge}
            </div>
            {description && (
              <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
                {description}
              </p>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-col gap-2 sm:flex-row">{actions}</div>}
      </div>
      {children && <div className="mt-5">{children}</div>}
    </section>
  )
}
