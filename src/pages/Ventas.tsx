import { ShoppingCart } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export function Ventas() {
  return (
    <PlaceholderPage
      icon={ShoppingCart}
      titulo="Ventas"
      descripcion="Pedidos, presupuestos, remitos, facturas, notas de crédito y débito."
      proxima="Fase 3: gestión de documentos comerciales y conversión entre tipos."
    />
  )
}
