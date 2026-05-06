import { useMemo, useState } from 'react'
import { CheckCircle2, FileText, KeyRound, PlugZap, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { supabaseAfip } from '@/db/schema'
import { useSupabaseQuery } from '@/hooks/useSupabaseQuery'
import { useAuth } from '@/lib/auth'
import { formatDate, formatDateTime } from '@/lib/formatters'
import type { ArcaComprobante, PuntoVenta } from '@/db/schema'

export function Fiscal() {
  const { empresa, empresaLoading, empresaError } = useAuth()
  const [testing, setTesting] = useState(false)
  const [loginTesting, setLoginTesting] = useState(false)
  const [lastDummy, setLastDummy] = useState<string | null>(null)
  const [lastLogin, setLastLogin] = useState<string | null>(null)

  const puntosVenta = usePuntosVenta(empresa?.id ?? null)
  const comprobantes = useComprobantesArca(empresa?.id ?? null)

  const ultimoComprobante = useMemo(
    () => (comprobantes ?? [])[0] ?? null,
    [comprobantes]
  )

  async function probarConexion() {
    setTesting(true)
    try {
      const { data, error } = await supabaseAfip.functions.invoke('arca', {
        body: { action: 'dummy' },
      })
      if (error) throw error
      const result = data as { result?: { appServer?: string; dbServer?: string; authServer?: string } }
      setLastDummy(
        `App ${result.result?.appServer ?? '-'} / DB ${result.result?.dbServer ?? '-'} / Auth ${result.result?.authServer ?? '-'}`
      )
      toast.success('WSFEv1 homologación respondió OK')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo probar ARCA'
      toast.error(message)
    } finally {
      setTesting(false)
    }
  }

  async function probarLogin() {
    if (!empresa) return
    setLoginTesting(true)
    try {
      const { data, error } = await supabaseAfip.functions.invoke('arca', {
        body: { action: 'login', empresaId: empresa.id },
      })
      if (error) throw error
      const result = data as { expirationTime?: string }
      setLastLogin(result.expirationTime ? `Ticket válido hasta ${formatDateTime(result.expirationTime)}` : 'Ticket WSAA OK')
      toast.success('WSAA homologación respondió OK')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'No se pudo obtener ticket WSAA'
      toast.error(message)
    } finally {
      setLoginTesting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-xl p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-success/15 border border-success/30 flex items-center justify-center flex-shrink-0">
              <ShieldCheck size={22} className="text-success" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white">Fiscal</h2>
                <Badge variant="ingreso">Homologación activa</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
                WSAA y WSFEv1 están configurados para homologación. La emisión real en producción queda bloqueada hasta Fase 6.
              </p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button variant="secondary" onClick={probarConexion} loading={testing}>
              <PlugZap size={16} />
              Probar WSFE
            </Button>
            <Button variant="secondary" onClick={probarLogin} loading={loginTesting} disabled={!empresa}>
              <KeyRound size={16} />
              Probar WSAA
            </Button>
          </div>
        </div>
        {(lastDummy || lastLogin) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5 text-xs">
            {lastDummy && (
              <div className="bg-surface-2 border border-border rounded-lg p-3 text-muted-foreground">
                <span className="text-white font-medium">WSFE:</span> {lastDummy}
              </div>
            )}
            {lastLogin && (
              <div className="bg-surface-2 border border-border rounded-lg p-3 text-muted-foreground">
                <span className="text-white font-medium">WSAA:</span> {lastLogin}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Empresa emisora</h2>
          {empresaLoading && (
            <p className="text-xs text-muted-foreground">Cargando empresa...</p>
          )}
          {empresaError && (
            <p className="text-xs text-danger">{empresaError}</p>
          )}
          {!empresaLoading && !empresaError && !empresa && (
            <p className="text-xs text-muted-foreground">
              Todavía no hay una empresa configurada.
            </p>
          )}
          {empresa && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Razón social</dt>
                <dd className="text-white font-medium">{empresa.razon_social}</dd>
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

        <div className="bg-surface border border-border rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-semibold text-white">Último comprobante ARCA</h2>
          {comprobantes === undefined ? (
            <SkeletonTable rows={2} />
          ) : ultimoComprobante ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-xs">
              <div>
                <dt className="text-muted-foreground">Resultado</dt>
                <dd className="text-white flex items-center gap-1">
                  <CheckCircle2 size={14} className="text-success" />
                  {ultimoComprobante.resultado}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">CAE</dt>
                <dd className="text-white font-mono">{ultimoComprobante.cae ?? '-'}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Comprobante</dt>
                <dd className="text-white">
                  PV {ultimoComprobante.punto_venta} - Tipo {ultimoComprobante.tipo_comprobante} - Nro {ultimoComprobante.numero_comprobante}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Vencimiento CAE</dt>
                <dd className="text-white">
                  {ultimoComprobante.cae_vencimiento ? formatDate(ultimoComprobante.cae_vencimiento) : '-'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-xs text-muted-foreground">
              Todavía no hay comprobantes emitidos en ARCA.
            </p>
          )}
        </div>
      </div>

      <div className="bg-surface border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <FileText size={16} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-white">Puntos de venta</h2>
        </div>
        {puntosVenta === undefined ? (
          <div className="p-4">
            <SkeletonTable rows={3} />
          </div>
        ) : puntosVenta.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No hay puntos de venta cargados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-2 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="text-left px-4 py-3 font-medium">Número</th>
                  <th className="text-left px-4 py-3 font-medium">Nombre</th>
                  <th className="text-left px-4 py-3 font-medium">Emisión</th>
                  <th className="text-left px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {puntosVenta.map(pv => (
                  <tr key={pv.id} className="border-t border-border">
                    <td className="px-4 py-3 text-white font-mono">{pv.numero}</td>
                    <td className="px-4 py-3 text-white">{pv.nombre}</td>
                    <td className="px-4 py-3 text-muted-foreground">{pv.tipo_emision}</td>
                    <td className="px-4 py-3">
                      <Badge variant={pv.activo ? 'ingreso' : undefined}>
                        {pv.activo ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function usePuntosVenta(empresaId: string | null) {
  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as PuntoVenta[]
      const { data, error } = await supabaseAfip
        .from('puntos_venta')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('numero', { ascending: true })
      if (error) throw error
      return (data ?? []) as PuntoVenta[]
    },
    [empresaId],
    ['puntos_venta']
  )
}

function useComprobantesArca(empresaId: string | null) {
  return useSupabaseQuery(
    async () => {
      if (!empresaId) return [] as ArcaComprobante[]
      const { data, error } = await supabaseAfip
        .from('arca_comprobantes')
        .select('*')
        .eq('empresa_id', empresaId)
        .order('enviado_at', { ascending: false })
        .limit(10)
      if (error) throw error
      return (data ?? []) as ArcaComprobante[]
    },
    [empresaId],
    ['arca_comprobantes']
  )
}
