import { useMemo, useState } from 'react'
import { ClipboardList, Search } from 'lucide-react'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { usePedidosCompra, usePedidosVenta } from '@/hooks/usePedidos'
import { ESTADO_COMPRA_CONFIG, ESTADO_VENTA_CONFIG } from '@/lib/vinculos'
import type { ItemDraft } from '@/lib/documentos'
import { cn, formatDate, formatMoney } from '@/lib/formatters'
import type {
  PedidoCompra,
  PedidoVenta,
  TipoOperacion,
} from '@/db/schema'

type Pedido = PedidoCompra | PedidoVenta

interface ImportarDesdePedidoDialogProps {
  open: boolean
  tipoOperacion: TipoOperacion
  contactoId: string | null
  onClose: () => void
  onImport: (
    pedido: Pedido,
    items: ItemDraft[],
    contactoId: string | null,
  ) => void
}

interface PedidoMostrable {
  pedido: Pedido
  contactoLabel: string
  estadoLabel: string
  estadoColor: string
}

function pedidoEsCompra(p: Pedido): p is PedidoCompra {
  return 'proveedor' in p
}

function pedidoMatchesContacto(pedido: Pedido, contactoId: string | null): boolean {
  if (!contactoId) return true
  if (pedidoEsCompra(pedido)) return pedido.proveedor_id === contactoId
  return pedido.cliente_id === contactoId
}

function itemsDesdePedido(pedido: Pedido): ItemDraft[] {
  const items = pedido.items ?? []
  if (items.length > 0) {
    return items.map(it => ({
      producto_id: null,
      codigo: null,
      descripcion: it.descripcion,
      cantidad: Number(it.cantidad) || 1,
      unidad_medida: 'unidad',
      precio_unitario: Number(it.precio_unitario) || 0,
      bonificacion: 0,
      alicuota_iva: 21,
    }))
  }
  // Si no hay items detallados, generamos uno con el total
  const monto = Number(pedido.monto_total_usd ?? pedido.monto_total) || 0
  return [{
    producto_id: null,
    codigo: pedido.numero,
    descripcion: pedido.descripcion?.trim() || `Importado de ${pedido.numero}`,
    cantidad: 1,
    unidad_medida: 'unidad',
    precio_unitario: monto,
    bonificacion: 0,
    alicuota_iva: 21,
  }]
}

export function ImportarDesdePedidoDialog({
  open,
  tipoOperacion,
  contactoId,
  onClose,
  onImport,
}: ImportarDesdePedidoDialogProps) {
  const [busqueda, setBusqueda] = useState('')

  // Llamamos siempre a los dos hooks (regla de hooks) pero solo usamos el del tipo correcto.
  // El otro queda con el filtro vacío default y no impacta.
  const pedidosCompraData = usePedidosCompra()
  const pedidosVentaData = usePedidosVenta()
  const pedidosRaw = tipoOperacion === 'compra' ? pedidosCompraData : pedidosVentaData
  const loading = pedidosRaw === undefined

  const pedidos: PedidoMostrable[] = useMemo(() => {
    const lista = (pedidosRaw ?? []) as Pedido[]
    const filtrado = lista
      .filter(p => p.estado !== 'cancelado')
      .filter(p => pedidoMatchesContacto(p, contactoId))
      .filter(p => {
        const q = busqueda.trim().toLowerCase()
        if (!q) return true
        const contactoTexto = pedidoEsCompra(p) ? p.proveedor : p.cliente
        return (
          p.numero.toLowerCase().includes(q) ||
          contactoTexto?.toLowerCase().includes(q) ||
          p.descripcion?.toLowerCase().includes(q)
        )
      })

    return filtrado.map(pedido => {
      if (pedidoEsCompra(pedido)) {
        const cfg = ESTADO_COMPRA_CONFIG[pedido.estado] ?? { label: pedido.estado, color: '#6b7280' }
        return {
          pedido,
          contactoLabel: pedido.proveedor,
          estadoLabel: cfg.label,
          estadoColor: cfg.color,
        }
      }
      const cfg = ESTADO_VENTA_CONFIG[pedido.estado] ?? { label: pedido.estado, color: '#6b7280' }
      return {
        pedido,
        contactoLabel: pedido.cliente,
        estadoLabel: cfg.label,
        estadoColor: cfg.color,
      }
    })
  }, [pedidosRaw, busqueda, contactoId])

  function handleImport(pedido: Pedido) {
    const items = itemsDesdePedido(pedido)
    const contacto = pedidoEsCompra(pedido)
      ? pedido.proveedor_id ?? null
      : pedido.cliente_id ?? null
    onImport(pedido, items, contacto)
    onClose()
    setBusqueda('')
  }

  const titulo = tipoOperacion === 'compra'
    ? 'Importar desde orden de compra'
    : 'Importar desde orden de venta'

  return (
    <Dialog open={open} onClose={onClose} title={titulo} size="lg">
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Elegí una orden {tipoOperacion === 'compra' ? 'de compra' : 'de venta'} para copiar sus items y datos al documento.
          {contactoId && ' Solo se muestran las del contacto seleccionado.'}
        </p>

        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por número, contacto o descripción..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="max-h-96 overflow-y-auto rounded-lg border border-border">
          {loading ? (
            <div className="p-4">
              <SkeletonTable rows={3} />
            </div>
          ) : pedidos.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              titulo="Sin órdenes disponibles"
              descripcion={
                contactoId
                  ? 'No hay órdenes pendientes para este contacto. Si querés ver todas, deseleccioná el contacto primero.'
                  : 'No hay órdenes activas para importar.'
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {pedidos.map(({ pedido, contactoLabel, estadoLabel, estadoColor }) => {
                const tieneItems = (pedido.items?.length ?? 0) > 0
                return (
                  <li key={pedido.id}>
                    <button
                      type="button"
                      onClick={() => handleImport(pedido)}
                      className={cn(
                        'flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors',
                        'hover:bg-surface-2'
                      )}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-semibold text-white">
                            {pedido.numero}
                          </span>
                          <Badge color={estadoColor} className="text-[10px]">
                            {estadoLabel}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(pedido.fecha)}
                          </span>
                        </div>
                        <div className="mt-1 truncate text-sm text-white">{contactoLabel}</div>
                        {pedido.descripcion && (
                          <div className="mt-1 truncate text-xs text-muted-foreground">
                            {pedido.descripcion}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">
                          {tieneItems
                            ? `${pedido.items?.length ?? 0} items detallados`
                            : 'Sin items detallados (se genera 1 línea con el total)'}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold text-white tabular-nums">
                          {pedido.monto_total_usd != null
                            ? formatMoney(pedido.monto_total_usd, 'USD')
                            : formatMoney(pedido.monto_total)}
                        </div>
                        {pedido.monto_total_usd != null && (
                          <div className="text-xs text-muted-foreground tabular-nums">
                            ≈ {formatMoney(pedido.monto_total)}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
