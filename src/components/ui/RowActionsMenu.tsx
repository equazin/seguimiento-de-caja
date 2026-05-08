import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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

interface MenuPosition {
  top: number
  left: number
}

const MENU_WIDTH = 176 // 11rem

export function RowActionsMenu({ actions, ariaLabel = 'Acciones' }: RowActionsMenuProps) {
  const visible = actions.filter(a => !a.hidden)
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState<MenuPosition | null>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (!open || !triggerRef.current) return
    const rect = triggerRef.current.getBoundingClientRect()
    const top = rect.bottom + 4
    const left = Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8))
    setPosition({ top, left })
  }, [open])

  useEffect(() => {
    if (!open) return

    function close(event: MouseEvent) {
      const target = event.target as Node
      if (triggerRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    function onScrollOrResize() {
      setOpen(false)
    }

    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('scroll', onScrollOrResize, true)
    window.addEventListener('resize', onScrollOrResize)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('scroll', onScrollOrResize, true)
      window.removeEventListener('resize', onScrollOrResize)
    }
  }, [open])

  if (visible.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }

  return (
    <>
      <button
        ref={triggerRef}
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
      {open && position && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: position.top, left: position.left, width: MENU_WIDTH }}
          className="fixed z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/50"
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
        </div>,
        document.body
      )}
    </>
  )
}
