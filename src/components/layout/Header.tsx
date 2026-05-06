import { LogOut, Menu } from 'lucide-react'
import { ActionMenu, type GlobalAction } from '@/components/ui/ActionMenu'
import { useAuth } from '@/lib/auth'

interface HeaderProps {
  titulo: string
  subtitulo?: string
  onGlobalAction: (action: GlobalAction) => void
  onOpenMenu?: () => void
}

function avatarInicial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || '?'
}

export function Header({ titulo, subtitulo, onGlobalAction, onOpenMenu }: HeaderProps) {
  const { session, signOut } = useAuth()
  const email = session?.user.email ?? ''

  return (
    <header className="flex items-center justify-between gap-3 border-b border-border bg-surface/90 px-4 py-4 backdrop-blur md:px-6">
      <div className="flex min-w-0 items-center gap-3">
        {onOpenMenu && (
          <button
            type="button"
            onClick={onOpenMenu}
            className="rounded-lg border border-border bg-surface-2 p-2 text-muted-foreground transition-colors hover:text-white md:hidden"
            aria-label="Abrir menú"
          >
            <Menu size={18} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="truncate text-lg font-bold tracking-tight text-white md:text-xl">{titulo}</h1>
          {subtitulo && <p className="mt-0.5 hidden truncate text-sm text-muted-foreground md:block">{subtitulo}</p>}
        </div>
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
          <span className="hidden max-w-[14rem] truncate text-xs text-muted-foreground lg:inline">{email}</span>
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
