import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeftRight,
  ChevronDown,
  PackagePlus,
  Plus,
  ShoppingCart,
  Truck,
  UserPlus,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/formatters'

export type GlobalAction =
  | 'movimiento'
  | 'venta'
  | 'compra'
  | 'cliente'
  | 'proveedor'
  | 'producto'

interface ActionMenuProps {
  onAction: (action: GlobalAction) => void
}

const ACTIONS = [
  { id: 'movimiento', label: 'Movimiento', description: 'Ingreso o egreso de caja', icon: ArrowLeftRight },
  { id: 'venta', label: 'Venta', description: 'Presupuesto, pedido, remito o factura', icon: ShoppingCart },
  { id: 'compra', label: 'Compra', description: 'Documento de proveedor y stock', icon: Truck },
  { id: 'cliente', label: 'Cliente', description: 'Alta rápida de contacto', icon: UserPlus },
  { id: 'proveedor', label: 'Proveedor', description: 'Alta rápida de proveedor', icon: Truck },
  { id: 'producto', label: 'Producto', description: 'Producto, servicio y stock', icon: PackagePlus },
] as const

export function ActionMenu({ onAction }: ActionMenuProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointerDown(event: MouseEvent) {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button onClick={() => setOpen(value => !value)}>
        <Plus size={16} />
        Nuevo
        <ChevronDown size={14} className={cn('transition-transform', open && 'rotate-180')} />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-surface shadow-2xl shadow-black/40">
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-white">Crear nuevo</p>
            <p className="text-xs text-muted-foreground">Accesos rápidos de operación</p>
          </div>
          <div className="grid grid-cols-1 p-1">
            {ACTIONS.map(({ id, label, description, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => {
                  setOpen(false)
                  onAction(id)
                }}
                className="flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-surface-2"
              >
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-primary">
                  <Icon size={16} />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-white">{label}</span>
                  <span className="block text-xs text-muted-foreground">{description}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
