import { LogOut } from 'lucide-react'
import { ActionMenu, type GlobalAction } from '@/components/ui/ActionMenu'
import { useAuth } from '@/lib/auth'

interface HeaderProps {
  titulo: string
  subtitulo?: string
  onGlobalAction: (action: GlobalAction) => void
}

function avatarInicial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || '?'
}

export function Header({ titulo, subtitulo, onGlobalAction }: HeaderProps) {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''

  return (
    <header className="flex items-center justify-between gap-4 border-b border-border bg-surface/90 px-6 py-4 backdrop-blur">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight text-white">{titulo}</h1>
        {subtitulo && <p className="mt-0.5 truncate text-sm text-muted-foreground">{subtitulo}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <ActionMenu onAction={onGlobalAction} />
        <div className="ml-1 flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 py-1 pl-1 pr-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary"
            title={email}
          >
            {avatarInicial(email)}
          </span>
          <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground md:inline">{email}</span>
          <button
            onClick={() => void signOut()}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-surface-3 hover:text-white"
            title="Cerrar sesión"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </header>
  )
}
