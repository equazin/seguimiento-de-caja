import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, BarChart3,
  Settings, ChevronLeft, ChevronRight, Building2,
  ShoppingCart, Truck, Package, FileText, X, ClipboardList,
} from 'lucide-react'
import { cn } from '@/lib/formatters'
import { useAuth } from '@/lib/auth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
  mobileOpen?: boolean
  onMobileClose?: () => void
}

const NAV_GROUPS = [
  {
    label: 'Operación',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/movimientos', label: 'Movimientos', icon: ArrowLeftRight },
      { to: '/cuentas', label: 'Cuentas', icon: Wallet },
      { to: '/ventas', label: 'Ventas', icon: ShoppingCart },
      { to: '/compras', label: 'Compras', icon: Truck },
    ],
  },
  {
    label: 'Pedidos',
    items: [
      { to: '/pedidos/compra', label: 'Órd. de compra', icon: ClipboardList },
      { to: '/pedidos/venta', label: 'Órd. de venta', icon: ClipboardList },
    ],
  },
  {
    label: 'Gestión',
    items: [
      { to: '/catalogo', label: 'Catálogo', icon: Package },
      { to: '/fiscal', label: 'Fiscal', icon: FileText },
      { to: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
  {
    label: 'Sistema',
    items: [
      { to: '/configuracion', label: 'Configuración', icon: Settings },
    ],
  },
]

export function Sidebar({ collapsed, onToggle, mobileOpen = false, onMobileClose }: SidebarProps) {
  const { empresa } = useAuth()
  const nombre = empresa?.nombre_fantasia || empresa?.razon_social || 'Bartez Caja'
  const ambiente = empresa?.arca_ambiente
  const subtitulo = ambiente
    ? ambiente === 'produccion' ? 'Producción' : 'Homologación'
    : 'Caja & Facturación'

  return (
    <>
      {/* Backdrop mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Cerrar menú"
          onClick={onMobileClose}
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-surface/95 backdrop-blur',
          'transition-transform duration-300 md:transition-all',
          // Desktop: visible siempre, ancho según collapsed
          'md:translate-x-0',
          collapsed ? 'md:w-16' : 'md:w-60',
          // Mobile: ancho fijo expandido y se desliza
          'w-72',
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        )}
      >
      <div className={cn(
        'flex min-h-[73px] items-center gap-3 border-b border-border px-4 py-5',
        collapsed && 'md:justify-center md:px-0'
      )}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
          <Building2 size={18} className="text-white" />
        </div>
        <div className={cn('min-w-0 flex-1 overflow-hidden', collapsed && 'md:hidden')}>
          <p className="truncate text-sm font-bold leading-tight text-white" title={nombre}>{nombre}</p>
          <p className={cn(
            'truncate text-xs',
            ambiente === 'produccion' ? 'text-success' : 'text-muted-foreground'
          )}>
            {subtitulo}
          </p>
        </div>
        {/* Cerrar mobile */}
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-white md:hidden"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-5 px-2">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              <p className={cn(
                'mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70',
                collapsed && 'md:hidden'
              )}>
                {group.label}
              </p>
              <ul className="space-y-1">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      onClick={onMobileClose}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        'hover:bg-surface-2 hover:text-white',
                        isActive
                          ? 'border border-primary/30 bg-primary/15 text-white'
                          : 'text-muted-foreground',
                        collapsed && 'md:justify-center md:px-0'
                      )}
                      title={collapsed ? label : undefined}
                    >
                      <Icon size={18} className="flex-shrink-0 text-current" />
                      <span className={cn(collapsed && 'md:hidden')}>{label}</span>
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={onToggle}
          className={cn(
            'hidden w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors md:flex',
            'hover:bg-surface-2 hover:text-white',
            collapsed && 'md:justify-center md:px-0'
          )}
          title={collapsed ? 'Expandir' : 'Contraer'}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Contraer</span></>}
        </button>
      </div>
      </aside>
    </>
  )
}
