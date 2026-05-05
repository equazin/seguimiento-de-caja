import { ArrowDownLeft, ArrowUpRight, Edit2 } from 'lucide-react'
import { formatMoney, formatDate } from '@/lib/formatters'
import type { Movimiento } from '@/db/schema'
import type { Categoria } from '@/db/schema'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'

interface Props {
  movimientos: Movimiento[]
  categorias: Categoria[]
  onEdit: (m: Movimiento) => void
}

export function RecentMovimientos({ movimientos, categorias, onEdit }: Props) {
  const catMap = new Map(categorias.map(c => [c.id, c]))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Últimos movimientos</CardTitle>
      </CardHeader>
      <div className="space-y-1">
        {movimientos.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Sin movimientos aún</p>
        )}
        {movimientos.map(m => {
          const cat = catMap.get(m.categoria_id)
          const esIngreso = m.tipo === 'ingreso'
          return (
            <div
              key={m.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-2 transition-colors group"
            >
              <div className={`p-1.5 rounded-lg ${esIngreso ? 'bg-success/15' : 'bg-danger/15'}`}>
                {esIngreso
                  ? <ArrowDownLeft size={14} className="text-success" />
                  : <ArrowUpRight size={14} className="text-danger" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-white truncate">{m.descripcion}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{formatDate(m.fecha)}</span>
                  {cat && (
                    <Badge color={cat.color} className="text-[10px] py-0">
                      {cat.icono} {cat.nombre}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className={`text-sm font-semibold ${esIngreso ? 'text-success' : 'text-danger'}`}>
                  {esIngreso ? '+' : '-'}{formatMoney(m.monto_ars)}
                </p>
                <button
                  onClick={() => onEdit(m)}
                  className="opacity-0 group-hover:opacity-100 p-1 rounded text-muted-foreground hover:text-white transition-all"
                >
                  <Edit2 size={12} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </Card>
  )
}
