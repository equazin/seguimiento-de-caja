import { Bell, LogOut } from 'lucide-react'
import { ActionMenu, type GlobalAction } from '@/components/ui/ActionMenu'
import { useAuth } from '@/lib/auth'

interface HeaderProps {
  titulo: string
  subtitulo?: string
  onGlobalAction: (action: GlobalAction) => void
}

export function Header({ titulo, subtitulo, onGlobalAction }: HeaderProps) {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 py-4 backdrop-blur">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-white">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {email && (
          <span className="hidden max-w-[18rem] truncate text-xs text-muted-foreground lg:inline">{email}</span>
        )}
        <button
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
          title="Notificaciones"
        >
          <Bell size={18} />
        </button>
        <button
          onClick={() => void signOut()}
          className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
          title="Cerrar sesión"
        >
          <LogOut size={18} />
        </button>
        <ActionMenu onAction={onGlobalAction} />
      </div>
    </header>
  )
}
