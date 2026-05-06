import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/formatters'

export interface RowAction {
  id: string
  label: string
  icon?: LucideIcon
  onClick: () => void
  hidden?: boolean
  disabled?: boolean
  tone?: 'default' | 'danger' | 'success'
}

interface RowActionsMenuProps {
  actions: RowAction[]
  ariaLabel?: string
}

export function RowActionsMenu({ actions, ariaLabel = 'Acciones' }: RowActionsMenuProps) {
  const visible = actions.filter(a => !a.hidden)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (visible.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        className={cn(
          'rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white',
          open && 'bg-surface-2 text-white'
        )}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/40"
        >
          {visible.map(action => (
            <button
              key={action.id}
              role="menuitem"
              type="button"
              disabled={action.disabled}
              onClick={() => {
                if (action.disabled) return
                setOpen(false)
                action.onClick()
              }}
              className={cn(
                'flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors',
                'hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-50',
                action.tone === 'danger' ? 'text-danger hover:text-danger' :
                action.tone === 'success' ? 'text-success hover:text-success' :
                'text-white'
              )}
            >
              {action.icon ? <action.icon size={14} className="shrink-0" /> : null}
              <span>{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
