import { useState } from 'react'
import { Users, Truck, Package } from 'lucide-react'
import { cn } from '@/lib/formatters'
import { ContactosTab } from '@/components/catalogo/ContactosTab'
import { ProductosTab } from '@/components/catalogo/ProductosTab'
import { useAuth } from '@/lib/auth'

type Tab = 'clientes' | 'proveedores' | 'productos'

const TABS: { id: Tab; label: string; icon: typeof Users }[] = [
  { id: 'clientes', label: 'Clientes', icon: Users },
  { id: 'proveedores', label: 'Proveedores', icon: Truck },
  { id: 'productos', label: 'Productos', icon: Package },
]

export function Catalogo() {
  const [tab, setTab] = useState<Tab>('clientes')
  const { empresa } = useAuth()

  if (!empresa) {
    return (
      <div className="bg-surface border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
        Configurá una empresa en Fiscal antes de cargar el catálogo.
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-surface/90 p-2 shadow-xl shadow-black/10">
        <div className="flex flex-wrap gap-1">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors',
              tab === id
                ? 'bg-primary/15 text-white'
                : 'text-muted-foreground hover:bg-surface-2 hover:text-white'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
        </div>
      </div>

      {tab === 'clientes' && <ContactosTab tipo="cliente" />}
      {tab === 'proveedores' && <ContactosTab tipo="proveedor" />}
      {tab === 'productos' && <ProductosTab />}
    </div>
  )
}
