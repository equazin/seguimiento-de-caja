import { useMemo, useState } from 'react'
import { Upload } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import {
  importarClientes,
  importarProductos,
  importarProveedores,
  type ContactoImport,
  type ProductoImport,
} from '@/hooks/useCatalogo'
import {
  parseContactos,
  parseProductos,
  readCatalogFile,
  type CatalogoImportTipo,
} from '@/lib/catalogoImport'
import { useAuth } from '@/lib/auth'

interface CatalogoImportModalProps {
  open: boolean
  onClose: () => void
  tipo: CatalogoImportTipo
}

type ParsedState =
  | { kind: 'contactos'; rows: ContactoImport[]; errors: string[] }
  | { kind: 'productos'; rows: ProductoImport[]; errors: string[] }

const LABELS: Record<CatalogoImportTipo, string> = {
  cliente: 'clientes',
  proveedor: 'proveedores',
  producto: 'productos',
}

const CONTACTO_HEADERS = 'razon_social,tipo_documento,numero_documento,condicion_iva,email,telefono,domicilio,localidad,provincia,codigo_postal'
const PRODUCTO_HEADERS = 'nombre,codigo,tipo,unidad_medida,precio_neto,alicuota_iva,stockeable,stock_actual,stock_minimo'

export function CatalogoImportModal({
  open,
  onClose,
  tipo,
}: CatalogoImportModalProps) {
  const { empresa } = useAuth()
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<ParsedState | null>(null)
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const sampleHeaders = useMemo(
    () => tipo === 'producto' ? PRODUCTO_HEADERS : CONTACTO_HEADERS,
    [tipo]
  )

  async function handleFile(file: File | null) {
    setParsed(null)
    setFileName(file?.name ?? '')
    if (!file) return

    setLoading(true)
    try {
      const rawRows = await readCatalogFile(file)
      if (tipo === 'producto') {
        const result = parseProductos(rawRows)
        setParsed({ kind: 'productos', ...result })
      } else {
        const result = parseContactos(rawRows, tipo)
        setParsed({ kind: 'contactos', ...result })
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo leer el archivo'
      toast.error(message)
      setParsed({ kind: tipo === 'producto' ? 'productos' : 'contactos', rows: [], errors: [message] })
    } finally {
      setLoading(false)
    }
  }

  async function importar() {
    if (!empresa || !parsed || parsed.rows.length === 0) return

    setSubmitting(true)
    try {
      if (tipo === 'cliente' && parsed.kind === 'contactos') {
        await importarClientes(empresa.id, parsed.rows)
      } else if (tipo === 'proveedor' && parsed.kind === 'contactos') {
        await importarProveedores(empresa.id, parsed.rows)
      } else if (tipo === 'producto' && parsed.kind === 'productos') {
        await importarProductos(empresa.id, parsed.rows)
      }
      toast.success(`${parsed.rows.length} ${LABELS[tipo]} importados`)
      setParsed(null)
      setFileName('')
      onClose()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo importar'
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  const validRows = parsed?.rows.length ?? 0
  const errorRows = parsed?.errors.length ?? 0

  return (
    <Dialog open={open} onClose={onClose} title={`Importar ${LABELS[tipo]}`} size="lg">
      <div className="space-y-4">
        <label className="block rounded-xl border border-dashed border-border bg-surface-2/70 p-5 text-center transition-colors hover:border-primary/60">
          <Upload size={24} className="mx-auto mb-3 text-muted-foreground" />
          <span className="block text-sm font-medium text-white">
            Seleccionar CSV o Excel
          </span>
          <span className="mt-1 block text-xs text-muted-foreground">
            Formatos admitidos: .csv, .xlsx, .xls
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            className="sr-only"
            onChange={event => void handleFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <div className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-muted-foreground">
          <p className="font-medium text-white">Encabezados sugeridos</p>
          <p className="mt-1 break-words font-mono">{sampleHeaders}</p>
        </div>

        {fileName && (
          <div className="rounded-lg border border-border bg-surface px-3 py-2 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="truncate text-white">{fileName}</span>
              {loading && <span className="text-xs text-muted-foreground">Leyendo...</span>}
            </div>
          </div>
        )}

        {parsed && (
          <div className="grid grid-cols-2 gap-3">
            <Summary label="Validos" value={validRows} tone="success" />
            <Summary label="Con error" value={errorRows} tone={errorRows > 0 ? 'danger' : 'default'} />
          </div>
        )}

        {parsed && parsed.errors.length > 0 && (
          <div className="max-h-40 overflow-y-auto rounded-lg border border-danger/30 bg-danger/10 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-danger">
              Errores
            </p>
            <ul className="space-y-1 text-xs text-danger">
              {parsed.errors.slice(0, 20).map(error => (
                <li key={error}>{error}</li>
              ))}
              {parsed.errors.length > 20 && (
                <li>Y {parsed.errors.length - 20} errores mas.</li>
              )}
            </ul>
          </div>
        )}

        <div className="flex justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={!parsed || validRows === 0 || loading || submitting}
            onClick={() => void importar()}
          >
            {submitting ? 'Importando...' : `Importar ${validRows}`}
          </Button>
        </div>
      </div>
    </Dialog>
  )
}

function Summary({
  label,
  value,
  tone = 'default',
}: {
  label: string
  value: number
  tone?: 'default' | 'success' | 'danger'
}) {
  const toneClass = {
    default: 'text-white',
    success: 'text-success',
    danger: 'text-danger',
  }[tone]

  return (
    <div className="rounded-lg border border-border bg-surface-2 px-3 py-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className={`mt-1 text-lg font-semibold ${toneClass}`}>{value}</p>
    </div>
  )
}
