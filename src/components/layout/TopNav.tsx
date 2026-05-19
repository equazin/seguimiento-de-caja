import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import {
  ArrowLeftRight,
  BarChart3,
  Building2,
  ChevronDown,
  ClipboardList,
  FileText,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  PiggyBank,
  Receipt,
  Settings,
  ShoppingCart,
  Sun,
  Truck,
  UsersRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react'
import { ActionMenu, type GlobalAction } from '@/components/ui/ActionMenu'
import { CotizacionUsdInput } from './CotizacionUsdInput'
import { useAuth } from '@/lib/auth'
import { useTheme } from '@/lib/theme'
import { cn } from '@/lib/formatters'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface BusinessMenu {
  id: 'ventas' | 'compras'
  label: string
  icon: LucideIcon
  activePaths: string[]
  items: NavItem[]
}

const NAV_ITEMS_BEFORE: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
  { to: '/cuentas', label: 'Cuentas', icon: Wallet },
  { to: '/echeqs', label: 'E-cheqs', icon: Receipt },
  { to: '/retiros', label: 'Retiros', icon: PiggyBank },
]

const NAV_ITEMS_AFTER: NavItem[] = [
  { to: '/catalogo', label: 'Catálogo', icon: Package },
  { to: '/fiscal', label: 'Fiscal', icon: FileText },
  { to: '/reportes', label: 'Reportes', icon: BarChart3 },
  { to: '/configuracion', label: 'Configuración', icon: Settings },
]

const BUSINESS_MENUS: BusinessMenu[] = [
  {
    id: 'ventas',
    label: 'Ventas',
    icon: ShoppingCart,
    activePaths: ['/ventas', '/pedidos/venta'],
    items: [
      { to: '/ventas', label: 'Ver ventas', icon: ShoppingCart },
      { to: '/ventas/nuevo?tipo=factura', label: 'Nueva venta', icon: Receipt },
      { to: '/ventas?tipo=presupuesto', label: 'Presupuestos', icon: FileText },
      { to: '/pedidos/venta', label: 'Pedidos de venta', icon: ClipboardList },
      { to: '/ventas?tipo=remito', label: 'Remitos', icon: Truck },
      { to: '/ventas?tipo=factura', label: 'Facturas', icon: FileText },
      { to: '/movimientos?tipo=ingreso', label: 'Recibos', icon: Receipt },
      { to: '/catalogo?tab=clientes', label: 'Clientes', icon: UsersRound },
    ],
  },
  {
    id: 'compras',
    label: 'Compras',
    icon: Truck,
    activePaths: ['/compras', '/pedidos/compra'],
    items: [
      { to: '/compras', label: 'Ver compras', icon: Truck },
      { to: '/compras/nuevo?tipo=factura', label: 'Nueva compra', icon: Receipt },
      { to: '/pedidos/compra', label: 'Pedidos de compra', icon: ClipboardList },
      { to: '/compras?tipo=remito', label: 'Remitos', icon: Truck },
      { to: '/compras?tipo=factura', label: 'Facturas', icon: FileText },
      { to: '/movimientos?tipo=egreso', label: 'Recibos', icon: Receipt },
      { to: '/catalogo?tab=proveedores', label: 'Proveedores', icon: UsersRound },
      { to: '/movimientos?tipo=egreso', label: 'Gastos', icon: Wallet },
    ],
  },
]

interface TopNavProps {
  onGlobalAction: (action: GlobalAction) => void
}

function avatarInicial(email: string): string {
  return email.trim().charAt(0).toUpperCase() || '?'
}

function pathMatches(pathname: string, paths: string[]) {
  return paths.some(path => pathname === path || pathname.startsWith(`${path}/`))
}

function DesktopNavLink({ item }: { item: NavItem }) {
  const { to, label, icon: Icon, end } = item
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors',
          isActive
            ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
            : 'text-muted-foreground hover:text-white'
        )
      }
    >
      <Icon size={15} className="flex-shrink-0" />
      {label}
    </NavLink>
  )
}

export function TopNav({ onGlobalAction }: TopNavProps) {
  const { session, signOut, empresa } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [desktopMenuOpen, setDesktopMenuOpen] = useState<BusinessMenu['id'] | null>(null)
  const [mobileMenuOpen, setMobileMenuOpen] = useState<BusinessMenu['id'] | null>('ventas')
  const desktopMenuRef = useRef<HTMLDivElement>(null)
  const location = useLocation()

  const email = session?.user.email ?? ''
  const ThemeIcon = theme === 'dark' ? Sun : Moon
  const nombreEmpresa = empresa?.nombre_fantasia || empresa?.razon_social || 'Bartez Caja'
  const ambiente = empresa?.arca_ambiente
  const subtitulo = ambiente
    ? ambiente === 'produccion' ? 'Producción' : 'Homologación'
    : 'Caja & Facturación'

  useEffect(() => {
    setMobileOpen(false)
    setDesktopMenuOpen(null)
  }, [location.pathname, location.search])

  useEffect(() => {
    if (!desktopMenuOpen) return
    function onPointerDown(event: MouseEvent) {
      if (!desktopMenuRef.current?.contains(event.target as Node)) {
        setDesktopMenuOpen(null)
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setDesktopMenuOpen(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [desktopMenuOpen])

  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  useEffect(() => {
    if (!mobileOpen) return
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMobileOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [mobileOpen])

  return (
    <>
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur">
        <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="rounded-lg border border-border bg-surface-2 p-2 text-muted-foreground transition-colors hover:text-white md:hidden"
              aria-label="Abrir menú"
            >
              <Menu size={18} />
            </button>
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
              <Building2 size={18} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold leading-tight text-white" title={nombreEmpresa}>
                {nombreEmpresa}
              </p>
              <p
                className={cn(
                  'truncate text-xs',
                  ambiente === 'produccion' ? 'text-success' : 'text-muted-foreground'
                )}
              >
                {subtitulo}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <CotizacionUsdInput />
            <ActionMenu onAction={onGlobalAction} />
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-lg border border-border bg-surface-2 p-2 text-muted-foreground transition-colors hover:text-white"
              title={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
              aria-label={theme === 'dark' ? 'Tema claro' : 'Tema oscuro'}
            >
              <ThemeIcon size={16} />
            </button>
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
        </div>

        <nav className="hidden border-t border-border md:block">
          <div ref={desktopMenuRef}>
            <ul className="flex items-center gap-1 overflow-visible px-4 md:px-6">
              {NAV_ITEMS_BEFORE.map(item => (
                <li key={item.to}>
                  <DesktopNavLink item={item} />
                </li>
              ))}

              {BUSINESS_MENUS.map(menu => {
                const isActive = pathMatches(location.pathname, menu.activePaths)
                const isOpen = desktopMenuOpen === menu.id
                const Icon = menu.icon
                return (
                  <li
                    key={menu.id}
                    className="relative"
                    onMouseEnter={() => setDesktopMenuOpen(menu.id)}
                    onMouseLeave={() => setDesktopMenuOpen(null)}
                  >
                    <button
                      type="button"
                      onClick={() => setDesktopMenuOpen(isOpen ? null : menu.id)}
                      className={cn(
                        'relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors',
                        isActive || isOpen
                          ? 'text-white after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary'
                          : 'text-muted-foreground hover:text-white'
                      )}
                      aria-expanded={isOpen}
                      aria-haspopup="menu"
                    >
                      <Icon size={15} className="flex-shrink-0" />
                      {menu.label}
                      <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
                    </button>

                    {isOpen && (
                      <div className="absolute left-0 top-full z-40 mt-0 w-64 overflow-hidden rounded-lg border border-border bg-surface shadow-2xl shadow-black/40">
                        <div className="grid grid-cols-1 p-1">
                          {menu.items.map(({ to, label, icon: ItemIcon }) => (
                            <Link
                              key={`${menu.id}-${label}`}
                              to={to}
                              className="flex items-center gap-3 rounded-md px-3 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
                              role="menuitem"
                            >
                              <ItemIcon size={16} className="shrink-0 text-current" />
                              <span className="min-w-0 truncate">{label}</span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </li>
                )
              })}

              {NAV_ITEMS_AFTER.map(item => (
                <li key={item.to}>
                  <DesktopNavLink item={item} />
                </li>
              ))}
            </ul>
          </div>
        </nav>
      </header>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 flex h-screen w-72 flex-col border-r border-border bg-surface/95 backdrop-blur transition-transform duration-300 md:hidden',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex min-h-[73px] items-center gap-3 border-b border-border px-4 py-5">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
            <Building2 size={18} className="text-white" />
          </div>
          <div className="min-w-0 flex-1 overflow-hidden">
            <p className="truncate text-sm font-bold leading-tight text-white" title={nombreEmpresa}>
              {nombreEmpresa}
            </p>
            <p className={cn(
              'truncate text-xs',
              ambiente === 'produccion' ? 'text-success' : 'text-muted-foreground'
            )}>
              {subtitulo}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
            aria-label="Cerrar menú"
          >
            <X size={18} />
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto py-4">
          <ul className="space-y-1 px-2">
            {NAV_ITEMS_BEFORE.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      'hover:bg-surface-2 hover:text-white',
                      isActive
                        ? 'border border-primary/30 bg-primary/15 text-white'
                        : 'text-muted-foreground'
                    )
                  }
                >
                  <Icon size={18} className="flex-shrink-0 text-current" />
                  {label}
                </NavLink>
              </li>
            ))}

            {BUSINESS_MENUS.map(menu => {
              const isActive = pathMatches(location.pathname, menu.activePaths)
              const isOpen = mobileMenuOpen === menu.id
              const Icon = menu.icon
              return (
                <li key={menu.id}>
                  <button
                    type="button"
                    onClick={() => setMobileMenuOpen(isOpen ? null : menu.id)}
                    className={cn(
                      'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-surface-2 hover:text-white',
                      isActive ? 'border border-primary/30 bg-primary/15 text-white' : 'text-muted-foreground'
                    )}
                    aria-expanded={isOpen}
                  >
                    <Icon size={18} className="flex-shrink-0 text-current" />
                    <span className="flex-1">{menu.label}</span>
                    <ChevronDown size={15} className={cn('transition-transform', isOpen && 'rotate-180')} />
                  </button>
                  {isOpen && (
                    <ul className="mt-1 space-y-1 pl-5">
                      {menu.items.map(({ to, label, icon: ItemIcon }) => (
                        <li key={`${menu.id}-mobile-${label}`}>
                          <Link
                            to={to}
                            onClick={() => setMobileOpen(false)}
                            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white"
                          >
                            <ItemIcon size={16} className="flex-shrink-0 text-current" />
                            {label}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              )
            })}

            {NAV_ITEMS_AFTER.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                      'hover:bg-surface-2 hover:text-white',
                      isActive
                        ? 'border border-primary/30 bg-primary/15 text-white'
                        : 'text-muted-foreground'
                    )
                  }
                >
                  <Icon size={18} className="flex-shrink-0 text-current" />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </aside>
    </>
  )
}
