import { Search, X } from 'lucide-react'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import type { Categoria, Cuenta } from '@/db/schema'
import type { MovimientoFiltros } from '@/hooks/useMovimientos'
import { METODOS_PAGO } from '@/lib/constants'

interface Props {
  filtros: MovimientoFiltros
  onChange: (filtros: MovimientoFiltros) => void
  categorias: Categoria[]
  cuentas: Cuenta[]
}

export function MovimientoFilters({ filtros, onChange, categorias, cuentas }: Props) {
  const set = (key: keyof MovimientoFiltros, value: string) => {
    onChange({ ...filtros, [key]: value || undefined })
  }

  const hasFiltros = Object.values(filtros).some(Boolean)

  return (
    <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Input
          placeholder="🔍 Buscar..."
          value={filtros.contacto ?? ''}
          onChange={e => set('contacto', e.target.value)}
          className="col-span-2 lg:col-span-1"
        />
        <Input
          type="date"
          value={filtros.fechaDesde ?? ''}
          onChange={e => set('fechaDesde', e.target.value)}
          placeholder="Desde"
        />
        <Input
          type="date"
          value={filtros.fechaHasta ?? ''}
          onChange={e => set('fechaHasta', e.target.value)}
          placeholder="Hasta"
        />
        <Select
          value={filtros.tipo ?? ''}
          onChange={e => set('tipo', e.target.value)}
        >
          <option value="">Tipo</option>
          <option value="ingreso">Ingreso</option>
          <option value="egreso">Egreso</option>
        </Select>
        <Select
          value={filtros.categoriaId ?? ''}
          onChange={e => set('categoriaId', e.target.value)}
        >
          <option value="">Categoría</option>
          {categorias.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
        <Select
          value={filtros.cuentaId ?? ''}
          onChange={e => set('cuentaId', e.target.value)}
        >
          <option value="">Cuenta</option>
          {cuentas.map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
      </div>
      {hasFiltros && (
        <div className="mt-3 flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onChange({})}>
            <X size={14} /> Limpiar filtros
          </Button>
        </div>
      )}
    </div>
  )
}
