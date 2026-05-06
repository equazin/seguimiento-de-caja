import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface EmptyStateProps {
  icon: LucideIcon
  titulo: string
  descripcion?: string
  action?: ReactNode
  hint?: string
}

export function EmptyState({ icon: Icon, titulo, descripcion, action, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-primary/30 bg-primary/10">
        <Icon size={20} className="text-primary" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-white">{titulo}</p>
        {descripcion && (
          <p className="mx-auto max-w-md text-xs text-muted-foreground">{descripcion}</p>
        )}
      </div>
      {action}
      {hint && <p className="text-[11px] text-muted-foreground/70">{hint}</p>}
    </div>
  )
}
