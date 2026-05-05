import { FileText } from 'lucide-react'
import { PlaceholderPage } from '@/components/shared/PlaceholderPage'
import { useAuth } from '@/lib/auth'

export function Fiscal() {
  const { empresa, empresaLoading, empresaError } = useAuth()

  return (
    <div className="space-y-6">
      <PlaceholderPage
        icon={FileText}
        titulo="Fiscal"
        descripcion="Empresa emisora, condición IVA, puntos de venta y conexión con ARCA/AFIP."
        proxima="Fase 4: Edge Function ARCA (WSAA + WSFEv1) en homologación."
      />

      <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-white">Empresa emisora</h2>
        {empresaLoading && (
          <p className="text-xs text-muted-foreground">Cargando empresa…</p>
        )}
        {empresaError && (
          <p className="text-xs text-danger">{empresaError}</p>
        )}
        {!empresaLoading && !empresaError && !empresa && (
          <p className="text-xs text-muted-foreground">
            Todavía no hay una empresa configurada. Cargala desde Supabase mientras se construye la UI.
          </p>
        )}
        {empresa && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            <div>
              <dt className="text-muted-foreground">Razón social</dt>
              <dd className="text-white">{empresa.razon_social}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">CUIT</dt>
              <dd className="text-white font-mono">{empresa.cuit}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Condición IVA</dt>
              <dd className="text-white">{empresa.condicion_iva}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Ambiente ARCA</dt>
              <dd className="text-white">{empresa.arca_ambiente}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  )
}
