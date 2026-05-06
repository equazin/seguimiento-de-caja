import { cn } from '@/lib/formatters'

interface PageToolbarProps {
  children: React.ReactNode
  actions?: React.ReactNode
  className?: string
}

export function PageToolbar({ children, actions, className }: PageToolbarProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10',
        className
      )}
    >
      <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-4">
          {children}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        )}
      </div>
    </div>
  )
}
