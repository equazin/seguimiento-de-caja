import { useMemo, useState } from 'react'
import { Receipt, AlertTriangle, CalendarCheck, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { useTodosLosEcheqs, actualizarEstadoEcheq, cobrarEcheq } from '@/hooks/useEcheqs'
import { useMovimientos } from '@/hooks/useMovimientos'
import { useCuentas } from '@/hooks/useCuentas'
import { PageHeader } from '@/components/layout/PageHeader'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select } from '@/components/ui/Input'
import { SkeletonTable } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { RowActionsMenu } from '@/components/ui/RowActionsMenu'
import { formatMoney, formatDate, todayStr } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Echeq, EchequEstado, Movimiento } from '@/db/schema'
import { CUENTA_ECHEQS_ARS_ID } from '@/lib/constants'

type FiltroEstado = 'todos' | 'pendiente' | 'esta_semana' | 'vencido' | 'cobrado' | 'rechazado'

interface FiltroChip {
  id: FiltroEstado
  label: string
  icono: typeof Receipt
}

const CHIPS: FiltroChip[] = [
  { id: 'todos', label: 'Todos', icono: Receipt },
  { id: 'pendiente', label: 'Pendientes', icono: Clock },
  { id: 'esta_semana', label: 'Vencen esta semana', icono: CalendarCheck },
  { id: 'vencido', label: 'Vencidos', icono: AlertTriangle },
  { id: 'cobrado', label: 'Cobrados', icono: CheckCircle2 },
  { id: 'rechazado', label: 'Rechazados', icono: XCircle },
]

function diasDeDiferencia(fechaIso: string): number {
  const hoy = new Date(todayStr())
  const fecha = new Date(fechaIso)
  const ms = fecha.getTime() - hoy.getTime()
  return Math.round(ms / (1000 * 60 * 60 * 24))
}

function clasificarVencimiento(fecha: string): 'pendiente' | 'esta_semana' | 'vencido' {
  const dias = diasDeDiferencia(fecha)
  if (dias < 0) return 'vencido'
  if (dias <= 7) return 'esta_semana'
  return 'pendiente'
}

const ESTADO_LABEL: Record<EchequEstado, string> = {
  pendiente: 'Pendiente',
  cobrado: 'Cobrado',
  rechazado: 'Rechazado',
  anulado: 'Anulado',
}

const ESTADO_COLOR: Record<EchequEstado, string> = {
  pendiente: '#3b82f6',
  cobrado: '#22c55e',
  rechazado: '#ef4444',
  anulado: '#6b7280',
}

export function Echeqs() {
  const [filtro, setFiltro] = useState<FiltroEstado>('todos')
  const [cobroDialog, setCobroDialog] = useState<{ echeq: Echeq; movimiento: Movimiento } | null>(null)
  const [cobroCuentaId, setCobroCuentaId] = useState('')
  const [cobroFecha, setCobroFecha] = useState(todayStr())
  const [cobroLoading, setCobroLoading] = useState(false)
  const echeqs = useTodosLosEcheqs()
  const movimientos = useMovimientos()
  const cuentas = useCuentas()

  const cuentaMap = useMemo(() => new Map((cuentas ?? []).map(c => [c.id, c])), [cuentas])
  const movimientoMap = useMemo(() => new Map((movimientos ?? []).map(m => [m.id, m])), [movimientos])

  const filtrados = useMemo(() => {
    if (!echeqs) return []
    if (filtro === 'todos') return echeqs
    if (filtro === 'cobrado') return echeqs.filter(e => e.estado === 'cobrado')
    if (filtro === 'rechazado') return echeqs.filter(e => e.estado === 'rechazado')
    return echeqs.filter(e => e.estado === 'pendiente' && clasificarVencimiento(e.fecha) === filtro)
  }, [echeqs, filtro])

  const stats = useMemo(() => {
    const acc = { pendiente: 0, esta_semana: 0, vencido: 0, cobrado: 0, rechazado: 0 }
    for (const e of (echeqs ?? [])) {
      if (e.estado === 'cobrado') { acc.cobrado += 1; continue }
      if (e.estado === 'rechazado') { acc.rechazado += 1; continue }
      if (e.estado === 'anulado') continue
      const v = clasificarVencimiento(e.fecha)
      if (v === 'pendiente') acc.pendiente += 1
      else if (v === 'esta_semana') acc.esta_semana += 1
      else if (v === 'vencido') acc.vencido += 1
    }
    return acc
  }, [echeqs])

  const totalARS = useMemo(() => {
    return filtrados.reduce((s, e) => {
      const mov = movimientoMap.get(e.movimiento_id)
      if (!mov) return s
      const signo = mov.tipo === 'ingreso' ? 1 : -1
      // Suma todo en ARS según moneda principal del movimiento padre
      return s + signo * e.monto
    }, 0)
  }, [filtrados, movimientoMap])

  async function cambiarEstado(echeq: Echeq, nuevo: EchequEstado) {
    try {
      await actualizarEstadoEcheq(echeq.id, nuevo)
      toast.success(`Estado actualizado: ${ESTADO_LABEL[nuevo]}`)
    } catch {
      toast.error('No se pudo actualizar el estado')
    }
  }

  function abrirCobroDialog(echeq: Echeq) {
    const mov = movimientoMap.get(echeq.movimiento_id)
    if (!mov) {
      toast.error('No se encontró el movimiento asociado')
      return
    }
    setCobroDialog({ echeq, movimiento: mov })
    setCobroCuentaId(echeq.cuenta_destino_id ?? '')
    setCobroFecha(todayStr())
  }

  async function confirmarCobro() {
    if (!cobroDialog) return
    if (!cobroCuentaId) {
      toast.error('Seleccioná la cuenta destino')
      return
    }
    if (!cobroFecha) {
      toast.error('Indicá la fecha de cobro')
      return
    }
    setCobroLoading(true)
    try {
      await cobrarEcheq(cobroDialog.echeq, cobroCuentaId, cobroFecha, cobroDialog.movimiento)
      toast.success('E-cheq cobrado y transferido a la cuenta destino')
      setCobroDialog(null)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'No se pudo cobrar el e-cheq'
      toast.error(msg)
    } finally {
      setCobroLoading(false)
    }
  }

  if (!echeqs) {
    return (
      <div className="space-y-4">
        <SkeletonTable rows={6} />
      </div>
    )
  }

  return (
    <>
      <PageHeader
        titulo="E-cheqs"
        subtitulo="Cheques electrónicos a pagar y a cobrar"
      />
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="rounded-lg border border-border bg-surface/90 p-3">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-xl font-bold text-info">{stats.pendiente}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/90 p-3">
            <p className="text-xs text-muted-foreground">Esta semana</p>
            <p className="text-xl font-bold text-warning">{stats.esta_semana}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/90 p-3">
            <p className="text-xs text-muted-foreground">Vencidos</p>
            <p className="text-xl font-bold text-danger">{stats.vencido}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/90 p-3">
            <p className="text-xs text-muted-foreground">Cobrados</p>
            <p className="text-xl font-bold text-success">{stats.cobrado}</p>
          </div>
          <div className="rounded-lg border border-border bg-surface/90 p-3">
            <p className="text-xs text-muted-foreground">Rechazados</p>
            <p className="text-xl font-bold text-danger/70">{stats.rechazado}</p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2">
          {CHIPS.map(chip => {
            const Icon = chip.icono
            const activo = filtro === chip.id
            return (
              <button
                key={chip.id}
                type="button"
                onClick={() => setFiltro(chip.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  activo
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-surface/90 text-muted-foreground hover:bg-surface-2'
                }`}
              >
                <Icon size={13} />
                {chip.label}
              </button>
            )
          })}
        </div>

        {/* Tabla */}
        <div className="overflow-hidden rounded-xl border border-border bg-surface/90 shadow-xl shadow-black/10">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Fecha pago</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Estado</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Tipo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Descripción</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Librador</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">N°</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Cuenta destino</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Recargo</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monto</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide w-20">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-0 py-0">
                      <EmptyState
                        icon={Receipt}
                        titulo="Sin e-cheqs en este filtro"
                        descripcion="Cuando cargues un movimiento con método 'E-cheq' aparecerán acá."
                      />
                    </td>
                  </tr>
                )}
                {filtrados.map((e, i) => {
                  const mov = movimientoMap.get(e.movimiento_id)
                  const esIngreso = mov?.tipo === 'ingreso'
                  const moneda = mov?.moneda_principal === 'USD' ? 'USD' : 'ARS'
                  const venc = clasificarVencimiento(e.fecha)
                  const cuentaDestino = e.cuenta_destino_id ? cuentaMap.get(e.cuenta_destino_id) : null
                  const filaColor = e.estado !== 'pendiente'
                    ? 'border-border/50 opacity-60'
                    : venc === 'vencido' ? 'border-danger/30'
                    : venc === 'esta_semana' ? 'border-warning/30'
                    : 'border-border/50'
                  return (
                    <tr
                      key={e.id}
                      className={`border-b ${filaColor} hover:bg-surface-2/50 transition-colors ${i % 2 === 0 ? '' : 'bg-surface-2/20'}`}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span className={`font-semibold ${
                          e.estado !== 'pendiente' ? 'text-muted-foreground' :
                          venc === 'vencido' ? 'text-danger' :
                          venc === 'esta_semana' ? 'text-warning' :
                          'text-white'
                        }`}>
                          {formatDate(e.fecha)}
                        </span>
                        {e.estado === 'pendiente' && (
                          <p className="text-[10px] text-muted-foreground">
                            {(() => {
                              const dias = diasDeDiferencia(e.fecha)
                              if (dias === 0) return 'Hoy'
                              if (dias > 0) return `En ${dias} día${dias === 1 ? '' : 's'}`
                              return `Hace ${Math.abs(dias)} día${Math.abs(dias) === 1 ? '' : 's'}`
                            })()}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={ESTADO_COLOR[e.estado]}>{ESTADO_LABEL[e.estado]}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={esIngreso ? 'ingreso' : 'egreso'}>
                          {esIngreso ? '↓ Cobrar' : '↑ Pagar'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="text-white truncate">{mov?.descripcion ?? '—'}</p>
                        {mov?.contacto && (
                          <p className="text-xs text-muted-foreground truncate">{mov.contacto}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{e.librador}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{e.numero ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{cuentaDestino?.nombre ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                        {e.recargo_pct > 0 ? `${e.recargo_pct}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <span className={`font-semibold ${esIngreso ? 'text-success' : 'text-danger'}`}>
                          {esIngreso ? formatMoney(e.monto, moneda) : `-${formatMoney(e.monto, moneda)}`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <RowActionsMenu
                          ariaLabel="Acciones del e-cheq"
                          actions={[
                            { id: 'cobrado', label: 'Cobrar e-cheq', icon: CheckCircle2, onClick: () => abrirCobroDialog(e), disabled: e.estado === 'cobrado' },
                            { id: 'rechazado', label: 'Marcar como rechazado', icon: XCircle, tone: 'danger', onClick: () => cambiarEstado(e, 'rechazado'), disabled: e.estado === 'rechazado' },
                            { id: 'pendiente', label: 'Volver a pendiente', icon: Clock, onClick: () => cambiarEstado(e, 'pendiente'), disabled: e.estado === 'pendiente' },
                          ]}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              {filtrados.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border">
                    <td colSpan={8} className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase">
                      Neto del filtro
                    </td>
                    <td colSpan={2} className={`px-4 py-3 text-right whitespace-nowrap font-bold ${totalARS >= 0 ? 'text-success' : 'text-danger'}`}>
                      {totalARS >= 0 ? formatMoney(totalARS) : `-${formatMoney(Math.abs(totalARS))}`}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>

      <Dialog
        open={cobroDialog !== null}
        onClose={() => !cobroLoading && setCobroDialog(null)}
        title="Cobrar e-cheq"
        size="sm"
      >
        {cobroDialog && (() => {
          const monedaPadre: 'ARS' | 'USD' = 'ARS'
          const cuentasDisponibles = (cuentas ?? []).filter(c =>
            c.moneda === 'ARS' &&
            c.id !== CUENTA_ECHEQS_ARS_ID
          )
          return (
            <div className="space-y-4">
              <div className="rounded-lg border border-border bg-surface-2 p-3 space-y-1 text-sm">
                <p className="text-muted-foreground">
                  E-cheq de <span className="text-white font-semibold">{cobroDialog.echeq.librador}</span>
                </p>
                <p className="text-white font-bold text-lg">
                  {formatMoney(cobroDialog.echeq.monto, monedaPadre)}
                </p>
                <p className="text-xs text-muted-foreground">
                  Vencimiento: {formatDate(cobroDialog.echeq.fecha)}
                </p>
              </div>

              <Select
                label="Cuenta destino"
                value={cobroCuentaId}
                onChange={e => setCobroCuentaId(e.target.value)}
                required
              >
                <option value="">Seleccionar cuenta {monedaPadre}...</option>
                {cuentasDisponibles.map(c => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Select>

              <Input
                label="Fecha de cobro"
                type="date"
                value={cobroFecha}
                onChange={e => setCobroFecha(e.target.value)}
                required
              />

              <p className="text-xs text-muted-foreground">
                Se generarán 2 movimientos: uno saliendo de "E-cheqs en cartera" y otro entrando a la cuenta seleccionada.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setCobroDialog(null)} disabled={cobroLoading}>
                  Cancelar
                </Button>
                <Button type="button" onClick={confirmarCobro} loading={cobroLoading}>
                  Confirmar cobro
                </Button>
              </div>
            </div>
          )
        })()}
      </Dialog>
    </>
  )
}
