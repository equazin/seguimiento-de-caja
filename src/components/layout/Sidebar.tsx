import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, ArrowLeftRight, Wallet, BarChart3,
  Settings, ChevronLeft, ChevronRight, Building2,
  ShoppingCart, Truck, Package, FileText,
} from 'lucide-react'
import { cn } from '@/lib/formatters'
import { useAuth } from '@/lib/auth'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
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

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { empresa } = useAuth()
  const nombre = empresa?.nombre_fantasia || empresa?.razon_social || 'Bartez Caja'
  const ambiente = empresa?.arca_ambiente
  const subtitulo = ambiente
    ? ambiente === 'produccion' ? 'Producción' : 'Homologación'
    : 'Caja & Facturación'

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 z-30 flex h-screen flex-col transition-all duration-300',
        'border-r border-border bg-surface/95 backdrop-blur',
        collapsed ? 'w-16' : 'w-60'
      )}
    >
      <div className={cn(
        'flex min-h-[73px] items-center gap-3 border-b border-border px-4 py-5',
        collapsed && 'justify-center px-0'
      )}>
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary shadow-lg shadow-primary/20">
          <Building2 size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate text-sm font-bold leading-tight text-white" title={nombre}>{nombre}</p>
            <p className={cn(
              'truncate text-xs',
              ambiente === 'produccion' ? 'text-success' : 'text-muted-foreground'
            )}>
              {subtitulo}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4">
        <div className="space-y-5 px-2">
          {NAV_GROUPS.map(group => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  {group.label}
                </p>
              )}
              <ul className="space-y-1">
                {group.items.map(({ to, label, icon: Icon, end }) => (
                  <li key={to}>
                    <NavLink
                      to={to}
                      end={end}
                      className={({ isActive }) => cn(
                        'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                        'hover:bg-surface-2 hover:text-white',
                        isActive
                          ? 'border border-primary/30 bg-primary/15 text-white'
                          : 'text-muted-foreground',
                        collapsed && 'justify-center px-0'
                      )}
                      title={collapsed ? label : undefined}
                    >
                      <Icon size={18} className={cn('flex-shrink-0', 'text-current')} />
                      {!collapsed && <span>{label}</span>}
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
            'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors',
            'hover:bg-surface-2 hover:text-white',
            collapsed && 'justify-center px-0'
          )}
          title={collapsed ? 'Expandir' : 'Contraer'}
        >
          {collapsed ? <ChevronRight size={16} /> : <><ChevronLeft size={16} /><span>Contraer</span></>}
        </button>
      </div>
    </aside>
  )
}
