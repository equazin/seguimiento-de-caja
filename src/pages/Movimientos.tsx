import { useState, useMemo } from 'react'
import { Trash2, Edit2, ChevronLeft, ChevronRight, ArrowUpDown } from 'lucide-react'
import { useMovimientos, eliminarMovimiento, eliminarMovimientosBulk } from '@/hooks/useMovimientos'
import { useCategorias } from '@/hooks/useCategorias'
import { useCuentas } from '@/hooks/useCuentas'
import { MovimientoFilters } from '@/components/movimientos/MovimientoFilters'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { formatMoney, formatDate } from '@/lib/formatters'
import { METODOS_PAGO } from '@/lib/constants'
import type { Movimiento } from '@/db/schema'
import type { MovimientoFiltros } from '@/hooks/useMovimientos'
import { toast } from 'sonner'

const POR_PAGINA = 25

type SortKey = 'fecha' | 'monto_ars' | 'descripcion'
type SortDir = 'asc' | 'desc'

interface Props {
  onModalOpen: () => void
  onEdit: (m: Movimiento) => void
}

export function Movimientos({ onModalOpen, onEdit }: Props) {
  const [filtros, setFiltros] = useState<MovimientoFiltros>({})
  const [pagina, setPagina] = useState(1)
  const [seleccionados, setSeleccionados] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('fecha')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false)

  const movimientos = useMovimientos(filtros)
  const categorias = useCategorias()
  const cuentas = useCuentas()

  const catMap = useMemo(() => new Map((categorias ?? []).map(c => [c.id, c])), [categorias])
  const cuentaMap = useMemo(() => new Map((cuentas ?? []).map(c => [c.id, c])), [cuentas])
  const metodosMap = useMemo(() => new Map(METODOS_PAGO.map(m => [m.value, m])), [])

  const sorted = useMemo(() => {
    if (!movimientos) return []
    return [...movimientos].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'fecha') cmp = a.fecha.localeCompare(b.fecha)
      else if (sortKey === 'monto_ars') cmp = a.monto_ars - b.monto_ars
      else if (sortKey === 'descripcion') cmp = a.descripcion.localeCompare(b.descripcion)
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [movimientos, sortKey, sortDir])

  const totalPaginas = Math.ceil(sorted.length / POR_PAGINA)
  const paginated = sorted.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
  }

  const toggleSelect = (id: string) => {
    setSeleccionados(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (seleccionados.size === paginated.length) setSeleccionados(new Set())
    else setSeleccionados(new Set(paginated.map(m => m.id)))
  }

  const handleDelete = async (id: string) => {
    await eliminarMovimiento(id)
    toast.success('Movimiento eliminado')
    setSeleccionados(prev => { const n = new Set(prev); n.delete(id); return n })
  }

  const handleBulkDelete = async () => {
    await eliminarMovimientosBulk([...seleccionados])
    toast.success(`${seleccionados.size} movimientos eliminados`)
    setSeleccionados(new Set())
  }

  const SortBtn = ({ col }: { col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="ml-1 text-muted-foreground hover:text-white">
      <ArrowUpDown size={12} className={sortKey === col ? 'text-primary' : ''} />
    </button>
  )

  if (!movimientos) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={10} />
      </div>
    )
  }

  return (
    <>
      <div className="space-y-4">
        <MovimientoFilters
          filtros={filtros}
          onChange={f => { setFiltros(f); setPagina(1) }}
          categorias={categorias ?? []}
          cuentas={cuentas ?? []}
        />

        {/* Toolbar */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <p className="text-sm text-muted-foreground">
              {sorted.length} movimiento{sorted.length !== 1 ? 's' : ''}
            </p>
            {seleccionados.size > 0 && (
              <Button
                variant="danger"
                size="sm"
                onClick={() => setConfirmBulkDelete(true)}
              >
                <Trash2 size={13} /> Eliminar {seleccionados.size}
              </Button>
            )}
          </div>
          <Button size="sm" onClick={onModalOpen}>+ Nuevo movimiento</Button>
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-xl shadow-black/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left w-8">
                    <input
                      type="checkbox"
                      checked={seleccionados.size === paginated.length && paginated.length > 0}
                      onChange={toggleAll}
                      className="accent-primary"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Fecha <SortBtn col="fecha" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Tipo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Descripción <SortBtn col="descripcion" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Categoría
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Contacto
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Método
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Cuenta
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Monto <SortBtn col="monto_ars" />
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginated.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">
                      Sin movimientos
                    </td>
                  </tr>
                )}
                {paginated.map((m, i) => {
                  const cat = catMap.get(m.categoria_id)
                  const cuenta = cuentaMap.get(m.cuenta_id)
                  const metodo = metodosMap.get(m.metodo_pago)
                  const esIngreso = m.tipo === 'ingreso'
                  return (
                    <tr
                      key={m.id}
                      className={`border-b border-border/50 hover:bg-surface-2/50 transition-colors ${
                        seleccionados.has(m.id) ? 'bg-primary/5' : i % 2 === 0 ? '' : 'bg-surface-2/20'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={seleccionados.has(m.id)}
                          onChange={() => toggleSelect(m.id)}
                          className="accent-primary"
                        />
                      </td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {formatDate(m.fecha)}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={esIngreso ? 'ingreso' : 'egreso'}>
                          {esIngreso ? '↓ Ingreso' : '↑ Egreso'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-white truncate">{m.descripcion}</p>
                        {m.subcategoria && (
                          <p className="text-xs text-muted-foreground truncate">{m.subcategoria}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {cat && (
                          <Badge color={cat.color}>
                            {cat.icono} {cat.nombre}
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">
                        {m.contacto ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {metodo ? `${metodo.icono} ${metodo.label}` : m.metodo_pago}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {cuenta?.nombre ?? '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-semibold ${esIngreso ? 'text-success' : 'text-danger'}`}>
                          {esIngreso ? '+' : '-'}{formatMoney(m.monto_ars)}
                        </span>
                        {m.monto_usd && (
                          <p className="text-xs text-muted-foreground">
                            USD {m.monto_usd.toFixed(2)}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => onEdit(m)}
                            className="p-1.5 rounded text-muted-foreground hover:text-white hover:bg-surface-2 transition-colors"
                            title="Editar"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setConfirmDelete(m.id)}
                            className="p-1.5 rounded text-muted-foreground hover:text-danger hover:bg-danger/10 transition-colors"
                            title="Eliminar"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPaginas > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-border">
              <p className="text-xs text-muted-foreground">
                Página {pagina} de {totalPaginas} — {sorted.length} registros
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagina(p => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="p-1.5 rounded text-muted-foreground hover:text-white disabled:opacity-40 hover:bg-surface-2 transition-colors"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  onClick={() => setPagina(p => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="p-1.5 rounded text-muted-foreground hover:text-white disabled:opacity-40 hover:bg-surface-2 transition-colors"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() => confirmDelete && handleDelete(confirmDelete)}
        title="Eliminar movimiento"
        message="¿Estás seguro de que querés eliminar este movimiento? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        danger
      />

      <ConfirmDialog
        open={confirmBulkDelete}
        onClose={() => setConfirmBulkDelete(false)}
        onConfirm={handleBulkDelete}
        title={`Eliminar ${seleccionados.size} movimientos`}
        message="¿Estás seguro de que querés eliminar los movimientos seleccionados? Esta acción no se puede deshacer."
        confirmLabel="Eliminar todos"
        danger
      />
    </>
  )
}
