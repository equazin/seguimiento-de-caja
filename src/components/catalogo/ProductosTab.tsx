import { useMemo, useState } from 'react'
import { Plus, Edit2, Power, Search, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { PageToolbar } from '@/components/ui/PageToolbar'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { ProductoModal } from './ProductoModal'
import { useProductos, setProductoActivo } from '@/hooks/useCatalogo'
import { formatMoney } from '@/lib/formatters'
import type { Producto } from '@/db/schema'

export function ProductosTab() {
  const [busqueda, setBusqueda] = useState('')
  const [soloActivos, setSoloActivos] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editar, setEditar] = useState<Producto | null>(null)

  const filtros = useMemo(() => ({ busqueda, soloActivos }), [busqueda, soloActivos])
  const data = useProductos(filtros)
  const loading = data === undefined
  const items = data ?? []
  const stockBajoCount = items.filter(p => p.stockeable && p.stock_actual <= p.stock_minimo).length

  function abrirNuevo() {
    setEditar(null)
    setModalOpen(true)
  }

  function abrirEditar(p: Producto) {
    setEditar(p)
    setModalOpen(true)
  }

  async function toggleActivo(p: Producto) {
    try {
      await setProductoActivo(p.id, !p.activo)
      toast.success(p.activo ? 'Marcado inactivo' : 'Reactivado')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo actualizar'
      toast.error(message)
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Productos activos</p>
          <p className="mt-2 text-xl font-bold text-white">{items.filter(p => p.activo).length}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alertas de stock</p>
          <p className={`mt-2 text-xl font-bold ${stockBajoCount > 0 ? 'text-warning' : 'text-success'}`}>{stockBajoCount}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Servicios</p>
          <p className="mt-2 text-xl font-bold text-white">{items.filter(p => p.tipo === 'servicio').length}</p>
        </div>
      </div>

      <PageToolbar
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <input
                type="checkbox"
                checked={soloActivos}
                onChange={e => setSoloActivos(e.target.checked)}
                className="h-4 w-4 rounded border-border bg-surface-2"
              />
              Solo activos
            </label>
            <Button onClick={abrirNuevo}>
              <Plus size={16} />
              Nuevo producto
            </Button>
          </>
        }
      >
        <div className="relative md:col-span-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar productos por nombre o código…"
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
      </PageToolbar>

      <div className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-xl shadow-black/10">
        {loading ? (
          <div className="p-4">
            <SkeletonTable rows={5} />
          </div>
        ) : items.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            No hay productos que coincidan.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Producto</th>
                  <th className="text-left px-4 py-3 font-medium">Código</th>
                  <th className="text-left px-4 py-3 font-medium">Tipo</th>
                  <th className="text-right px-4 py-3 font-medium">Precio neto</th>
                  <th className="text-right px-4 py-3 font-medium">IVA</th>
                  <th className="text-right px-4 py-3 font-medium">Stock</th>
                  <th className="text-right px-4 py-3 font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {items.map(p => {
                  const stockBajo = p.stockeable && p.stock_actual <= p.stock_minimo
                  return (
                    <tr key={p.id} className="border-t border-border hover:bg-surface-2/40">
                      <td className="px-4 py-3 text-white">
                        <div className="font-medium">{p.nombre}</div>
                        <div className="flex items-center gap-2 mt-1">
                          {!p.activo && <Badge variant="inactivo">Inactivo</Badge>}
                          <span className="text-xs text-muted-foreground">{p.unidad_medida}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">
                        {p.codigo ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {p.tipo === 'producto' ? 'Producto' : 'Servicio'}
                      </td>
                      <td className="px-4 py-3 text-right text-white font-medium">
                        {formatMoney(p.precio_neto)}
                      </td>
                      <td className="px-4 py-3 text-right text-muted-foreground">
                        {p.alicuota_iva}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        {p.stockeable ? (
                          <span className={stockBajo ? 'text-warning' : 'text-white'}>
                            {stockBajo && (
                              <AlertTriangle size={12} className="inline mr-1 text-warning" />
                            )}
                            {p.stock_actual} / mín. {p.stock_minimo}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="inline-flex gap-1">
                          <button
                            onClick={() => abrirEditar(p)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => void toggleActivo(p)}
                            className="p-1.5 rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-white transition-colors"
                            title={p.activo ? 'Desactivar' : 'Reactivar'}
                          >
                            <Power size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ProductoModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        producto={editar}
      />
    </div>
  )
}
