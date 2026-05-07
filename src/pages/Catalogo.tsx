import { useState } from 'react'
import { Users, Truck, Package, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/formatters'
import { ContactosTab } from '@/components/catalogo/ContactosTab'
import { ProductosTab } from '@/components/catalogo/ProductosTab'
import { PageHeader } from '@/components/layout/PageHeader'
import { useAuth } from '@/lib/auth'
import { useClientes, useProveedores, useProductos } from '@/hooks/useCatalogo'

type Tab = 'clientes' | 'proveedores' | 'productos'

const TABS: { id: Tab; label: string; icon: LucideIcon }[] = [
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'productos', label: 'Productos', icon: Package },
]

export function Catalogo() {
  const [tab, setTab] = useState<Tab>('clientes')
  const { empresa } = useAuth()
  const clientes = useClientes({ soloActivos: false })
  const proveedores = useProveedores({ soloActivos: false })
  const productos = useProductos({ soloActivos: false })

  const counts: Record<Tab, number | null> = {
    clientes: clientes ? clientes.length : null,
    proveedores: proveedores ? proveedores.length : null,
    productos: productos ? productos.length : null,
  }

  if (!empresa) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        Configurá una empresa en Fiscal antes de cargar el catálogo.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        titulo="Catálogo"
        subtitulo="Clientes, proveedores y productos"
      />
      <div className="rounded-xl border border-border bg-surface/90 p-2 shadow-xl shadow-black/10">
        <div className="flex flex-wrap gap-1">
        {TABS.map(({ id, label, icon: Icon }) => {
          const count = counts[id]
          const isActive = tab === id
          return (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={cn(
                'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/15 text-white'
                  : 'text-muted-foreground hover:bg-surface-2 hover:text-white'
              )}
            >
              <Icon size={16} />
              {label}
              {count !== null && (
                <span className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  isActive ? 'bg-primary/30 text-white' : 'bg-surface-2 text-muted-foreground'
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
        </div>
      </div>

      {tab === 'clientes' && <ContactosTab tipo="cliente" />}
      {tab === 'proveedores' && <ContactosTab tipo="proveedor" />}
      {tab === 'productos' && <ProductosTab />}
    </div>
  )
}
