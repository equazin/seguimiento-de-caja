import { useState, useEffect } from 'react'
import { Download, Upload, Trash2, RefreshCw, Plus, Edit2, X, Check } from 'lucide-react'
import { useCategorias, crearCategoria, actualizarCategoria, eliminarCategoria } from '@/hooks/useCategorias'
import { getConfiguracion, setConfiguracion, exportarDB, importarDB, resetearDB as resetearDatosRemotos } from '@/db/queries'
import { Card, CardHeader, CardTitle } from '@/components/ui/Card'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { Dialog, ConfirmDialog } from '@/components/ui/Dialog'
import { Badge } from '@/components/ui/Badge'
import { COLORES_DISPONIBLES, ICONOS_DISPONIBLES } from '@/lib/constants'
import { formatDateTime } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Categoria, TipoMovimiento } from '@/db/schema'

export function Configuracion() {
  const [nombreNegocio, setNombreNegocio] = useState('Bartez Tecnología')
  const [cotizacionUSD, setCotizacionUSD] = useState('1280')
  const [cotizacionUpdatedAt, setCotizacionUpdatedAt] = useState<string | null>(null)
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const categorias = useCategorias()

  // Modal categoría
  const [modalCat, setModalCat] = useState(false)
  const [editandoCat, setEditandoCat] = useState<Categoria | null>(null)
  const [catForm, setCatForm] = useState({ nombre: '', tipo: 'egreso' as TipoMovimiento, color: '#6366f1', icono: '📦' })
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      getConfiguracion('nombre_negocio'),
      getConfiguracion('cotizacion_usd'),
      getConfiguracion('cotizacion_usd_updated_at'),
    ]).then(([nombre, cotiz, cotizUpdatedAt]) => {
      if (nombre) setNombreNegocio(nombre)
      if (cotiz) setCotizacionUSD(cotiz)
      if (cotizUpdatedAt) setCotizacionUpdatedAt(cotizUpdatedAt)
    })
  }, [])

  const guardarConfig = async () => {
    setLoadingConfig(true)
    try {
      const cotizacionTimestamp = new Date().toISOString()
      await Promise.all([
        setConfiguracion('nombre_negocio', nombreNegocio),
        setConfiguracion('cotizacion_usd', cotizacionUSD),
        setConfiguracion('cotizacion_usd_updated_at', cotizacionTimestamp),
      ])
      setCotizacionUpdatedAt(cotizacionTimestamp)
      toast.success('Configuración guardada')
    } catch {
      toast.error('Error al guardar')
    } finally {
      setLoadingConfig(false)
    }
  }

  const exportarBackup = async () => {
    try {
      const data = await exportarDB()
      const json = JSON.stringify(data, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bartez-backup-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Backup exportado')
    } catch {
      toast.error('Error al exportar')
    }
  }

  const importarBackup = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const data = JSON.parse(text)
        await importarDB(data)
        toast.success('Backup importado correctamente')
      } catch {
        toast.error('Error al importar backup')
      }
    }
    input.click()
  }

  const resetearDB = async () => {
    try {
      await resetearDatosRemotos()
      toast.success('Base de datos reseteada. Recargá la página.')
      setTimeout(() => window.location.reload(), 1500)
    } catch {
      toast.error('Error al resetear')
    }
  }

  const abrirNuevaCat = () => {
    setEditandoCat(null)
    setCatForm({ nombre: '', tipo: 'egreso', color: '#6366f1', icono: '📦' })
    setModalCat(true)
  }

  const abrirEditarCat = (cat: Categoria) => {
    setEditandoCat(cat)
    setCatForm({ nombre: cat.nombre, tipo: cat.tipo, color: cat.color, icono: cat.icono })
    setModalCat(true)
  }

  const guardarCat = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (editandoCat) {
        await actualizarCategoria(editandoCat.id, catForm)
        toast.success('Categoría actualizada')
      } else {
        await crearCategoria(catForm)
        toast.success('Categoría creada')
      }
      setModalCat(false)
    } catch {
      toast.error('Error al guardar')
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Config general */}
      <Card>
        <CardHeader>
          <CardTitle>Configuración general</CardTitle>
        </CardHeader>
        <div className="space-y-4">
          <Input
            label="Nombre del negocio"
            value={nombreNegocio}
            onChange={e => setNombreNegocio(e.target.value)}
          />
          <Input
            label="Cotización USD (manual)"
            type="number"
            value={cotizacionUSD}
            onChange={e => setCotizacionUSD(e.target.value)}
            hint={cotizacionUpdatedAt
              ? `Valor en ARS por 1 USD. Actualizada ${formatDateTime(cotizacionUpdatedAt)}`
              : 'Valor en ARS por 1 USD. Sin fecha de actualizacion'}
          />
          <div className="flex justify-end">
            <Button onClick={guardarConfig} loading={loadingConfig}>
              Guardar configuración
            </Button>
          </div>
        </div>
      </Card>

      {/* Categorías */}
      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <Button size="sm" onClick={abrirNuevaCat}>
            <Plus size={13} /> Nueva categoría
          </Button>
        </CardHeader>

        <div className="space-y-1">
          {['ingreso', 'egreso'].map(tipo => (
            <div key={tipo} className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2 px-1">
                {tipo === 'ingreso' ? '↓ Ingresos' : '↑ Egresos'}
              </p>
              <div className="space-y-1">
                {(categorias ?? []).filter(c => c.tipo === tipo).map(cat => (
                  <div
                    key={cat.id}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-2 group"
                  >
                    <span className="text-base">{cat.icono}</span>
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: cat.color }}
                    />
                    <span className="flex-1 text-sm text-white">{cat.nombre}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => abrirEditarCat(cat)}
                        className="p-1 rounded text-muted-foreground hover:text-white"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => setConfirmDeleteCat(cat.id)}
                        className="p-1 rounded text-muted-foreground hover:text-danger"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Backup */}
      <Card>
        <CardHeader>
          <CardTitle>Datos y respaldo</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-3">
          <Button variant="secondary" onClick={exportarBackup}>
            <Download size={15} /> Exportar backup JSON
          </Button>
          <Button variant="secondary" onClick={importarBackup}>
            <Upload size={15} /> Importar backup JSON
          </Button>
          <Button variant="danger" onClick={() => setConfirmReset(true)}>
            <Trash2 size={15} /> Resetear todos los datos
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          El backup incluye todos los movimientos, cuentas y categorías. Guardalo regularmente.
        </p>
      </Card>

      {/* Modal categoría */}
      <Dialog
        open={modalCat}
        onClose={() => setModalCat(false)}
        title={editandoCat ? 'Editar categoría' : 'Nueva categoría'}
        size="sm"
      >
        <form onSubmit={guardarCat} className="space-y-4">
          <Input
            label="Nombre"
            value={catForm.nombre}
            onChange={e => setCatForm(f => ({ ...f, nombre: e.target.value }))}
            required
          />
          <Select
            label="Tipo"
            value={catForm.tipo}
            onChange={e => setCatForm(f => ({ ...f, tipo: e.target.value as TipoMovimiento }))}
          >
            <option value="egreso">↑ Egreso</option>
            <option value="ingreso">↓ Ingreso</option>
          </Select>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Icono</label>
            <div className="flex flex-wrap gap-1.5">
              {ICONOS_DISPONIBLES.map(icono => (
                <button
                  key={icono}
                  type="button"
                  onClick={() => setCatForm(f => ({ ...f, icono }))}
                  className={`text-lg p-1.5 rounded-lg hover:bg-surface-2 transition-colors ${catForm.icono === icono ? 'bg-primary/20 ring-1 ring-primary' : ''}`}
                >
                  {icono}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORES_DISPONIBLES.map(color => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setCatForm(f => ({ ...f, color }))}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${catForm.color === color ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalCat(false)}>Cancelar</Button>
            <Button type="submit">{editandoCat ? 'Guardar' : 'Crear'}</Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={confirmDeleteCat !== null}
        onClose={() => setConfirmDeleteCat(null)}
        onConfirm={async () => {
          if (confirmDeleteCat) {
            await eliminarCategoria(confirmDeleteCat)
            toast.success('Categoría eliminada')
          }
        }}
        title="Eliminar categoría"
        message="¿Eliminar esta categoría? Los movimientos asociados quedarán sin categoría."
        confirmLabel="Eliminar"
        danger
      />

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={resetearDB}
        title="Resetear base de datos"
        message="¿Estás seguro? Se eliminarán TODOS los movimientos, cuentas y categorías. Esta acción no se puede deshacer."
        confirmLabel="Sí, resetear todo"
        danger
      />
    </div>
  )
}
