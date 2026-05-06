import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/formatters'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl'
}

const SIZE_CLASSES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  '2xl': 'max-w-6xl',
}

export function Dialog({ open, onClose, title, children, size = 'md' }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        ref={ref}
        className={cn(
          'relative w-full bg-surface border border-border rounded-2xl shadow-2xl',
          'shadow-black/40',
          'max-h-[90vh] flex flex-col',
          SIZE_CLASSES[size]
        )}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {children}
        </div>
      </div>
    </div>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  confirmLabel?: string
  danger?: boolean
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', danger = false }: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <p className="text-sm text-muted-foreground mb-6">{message}</p>
      <div className="flex gap-3 justify-end">
        <button
          onClick={onClose}
          className="px-4 py-2 text-sm rounded-lg border border-border text-muted-foreground hover:bg-surface-2 transition-colors"
        >
          Cancelar
        </button>
        <button
          onClick={() => { onConfirm(); onClose() }}
          className={cn(
            'px-4 py-2 text-sm rounded-lg font-medium transition-colors',
            danger
              ? 'bg-danger hover:bg-red-600 text-white'
              : 'bg-primary hover:bg-primary-hover text-white'
          )}
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
