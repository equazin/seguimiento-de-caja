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
      <div className="flex gap-1 border-b border-border">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id
                ? 'border-primary text-white'
                : 'border-transparent text-muted-foreground hover:text-white'
            )}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {tab === 'clientes' && <ContactosTab tipo="cliente" />}
      {tab === 'proveedores' && <ContactosTab tipo="proveedor" />}
      {tab === 'productos' && <ProductosTab />}
    </div>
  )
}
