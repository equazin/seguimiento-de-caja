import { Plus, Bell } from 'lucide-react'
import { cn } from '@/lib/formatters'

interface HeaderProps {
  titulo: string
  subtitulo?: string
  onNuevoMovimiento: () => void
}

export function Header({ titulo, subtitulo, onNuevoMovimiento }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-surface">
      <div>
        <h1 className="text-xl font-bold text-white">{titulo}</h1>
        {subtitulo && <p className="text-sm text-muted-foreground mt-0.5">{subtitulo}</p>}
      </div>
      <div className="flex items-center gap-2">
        <button
          className="p-2 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
          title="Notificaciones"
        >
          <Bell size={18} />
        </button>
        <button
          onClick={onNuevoMovimiento}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold',
            'bg-primary hover:bg-primary-hover text-white transition-colors'
          )}
          title="Nuevo movimiento (N)"
        >
          <Plus size={16} />
          <span>Nuevo</span>
        </button>
      </div>
    </header>
  )
}
