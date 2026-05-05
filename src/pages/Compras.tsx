import { Truck } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/PlaceholderPage'

export function Compras() {
  return (
    <PlaceholderPage
      icon={Truck}
      titulo="Compras"
      descripcion="Pedidos, remitos, facturas y notas de proveedores."
      proxima="Fase 3: carga manual de comprobantes y stock al confirmar."
    />
  )
}
