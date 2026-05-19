import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Car, CheckCircle2, Plus, ReceiptText, UserRound, WalletCards } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/EmptyState'
import { Input, Select } from '@/components/ui/Input'
import { useCuentas } from '@/hooks/useCuentas'
import { crearMovimiento, useMovimientos } from '@/hooks/useMovimientos'
import { cn, formatDate, formatMoney, todayStr } from '@/lib/formatters'
import {
  esGastoVehiculo,
  esRetiroPersonal,
  estaEnRango,
  getRangoSemana,
  normalizarPersonaRetiro,
  PERSONAS_RETIRO,
  RETIRO_PERSONAL_CATEGORY_ID,
  RETIRO_PERSONAL_TOPE_SEMANAL,
  VEHICULOS_CATEGORY_ID,
  type PersonaRetiro,
} from '@/lib/retiros'
import type { MetodoPago, Movimiento } from '@/db/schema'

interface PersonalForm {
  persona: PersonaRetiro
  monto: string
  cuenta_id: string
  fecha: string
  metodo_pago: MetodoPago
  descripcion: string
}

interface VehiculoForm {
  vehiculo: string
  monto: string
  cuenta_id: string
  fecha: string
  metodo_pago: MetodoPago
  descripcion: string
}

interface PersonaResumen {
  persona: PersonaRetiro
  usado: number
  restante: number
  porcentaje: number
}

const PERSONAL_INITIAL: PersonalForm = {
  persona: 'Andres',
  monto: '',
  cuenta_id: '',
  fecha: todayStr(),
  metodo_pago: 'transferencia',
  descripcion: '',
}

const VEHICULO_INITIAL: VehiculoForm = {
  vehiculo: '',
  monto: '',
  cuenta_id: '',
  fecha: todayStr(),
  metodo_pago: 'transferencia',
  descripcion: '',
}

function MovimientoRow({ movimiento }: { movimiento: Movimiento }) {
  return (
    <tr className="border-b border-border/50 last:border-0">
      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(movimiento.fecha)}</td>
      <td className="px-3 py-2">
        <p className="text-sm font-medium text-white">{movimiento.contacto || movimiento.subcategoria || 'Sin asignar'}</p>
        <p className="text-xs text-muted-foreground">{movimiento.descripcion}</p>
      </td>
      <td className="px-3 py-2 text-right text-sm font-semibold text-danger whitespace-nowrap">
        {formatMoney(movimiento.monto_ars)}
      </td>
    </tr>
  )
}

function PersonaCard({ resumen }: { resumen: PersonaResumen }) {
  const excedido = resumen.usado > RETIRO_PERSONAL_TOPE_SEMANAL
  const completo = resumen.usado >= RETIRO_PERSONAL_TOPE_SEMANAL

  return (
    <div className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <UserRound size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{resumen.persona}</p>
            <p className="text-xs text-muted-foreground">Tope semanal {formatMoney(RETIRO_PERSONAL_TOPE_SEMANAL)}</p>
          </div>
        </div>
        <Badge variant={excedido ? 'egreso' : completo ? 'warning' : 'activo'}>
          {excedido ? 'Excedido' : completo ? 'Al limite' : 'Disponible'}
        </Badge>
      </div>

      <div className="mt-4 space-y-2">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground">Usado esta semana</p>
            <p className={cn('text-xl font-bold', excedido ? 'text-danger' : 'text-white')}>
              {formatMoney(resumen.usado)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Restante</p>
            <p className={cn('text-sm font-semibold', resumen.restante > 0 ? 'text-success' : 'text-danger')}>
              {formatMoney(resumen.restante)}
            </p>
          </div>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-surface-3">
          <div
            className={cn('h-full rounded-full', excedido ? 'bg-danger' : completo ? 'bg-warning' : 'bg-success')}
            style={{ width: `${Math.min(resumen.porcentaje, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export function Retiros() {
  const cuentas = useCuentas()
  const movimientos = useMovimientos({ tipo: 'egreso' })
  const [personalForm, setPersonalForm] = useState<PersonalForm>(PERSONAL_INITIAL)
  const [vehiculoForm, setVehiculoForm] = useState<VehiculoForm>(VEHICULO_INITIAL)
  const [guardandoPersonal, setGuardandoPersonal] = useState(false)
  const [guardandoVehiculo, setGuardandoVehiculo] = useState(false)

  const semana = useMemo(() => getRangoSemana(), [])

  useEffect(() => {
    if (!cuentas?.length) return
    setPersonalForm(form => form.cuenta_id ? form : { ...form, cuenta_id: cuentas[0].id })
    setVehiculoForm(form => form.cuenta_id ? form : { ...form, cuenta_id: cuentas[0].id })
  }, [cuentas])

  const retirosPersonales = useMemo(
    () => (movimientos ?? []).filter(esRetiroPersonal),
    [movimientos]
  )
  const gastosVehiculos = useMemo(
    () => (movimientos ?? []).filter(esGastoVehiculo),
    [movimientos]
  )

  const retirosSemana = useMemo(
    () => retirosPersonales.filter(m => estaEnRango(m, semana.inicioStr, semana.finStr)),
    [retirosPersonales, semana.inicioStr, semana.finStr]
  )

  const resumenPersonas = useMemo<PersonaResumen[]>(() => {
    return PERSONAS_RETIRO.map(persona => {
      const usado = retirosSemana
        .filter(m => normalizarPersonaRetiro(m.contacto) === persona)
        .reduce((sum, m) => sum + Number(m.monto_ars), 0)
      return {
        persona,
        usado,
        restante: RETIRO_PERSONAL_TOPE_SEMANAL - usado,
        porcentaje: (usado / RETIRO_PERSONAL_TOPE_SEMANAL) * 100,
      }
    })
  }, [retirosSemana])

  const gastosVehiculosSemana = useMemo(
    () => gastosVehiculos.filter(m => estaEnRango(m, semana.inicioStr, semana.finStr)),
    [gastosVehiculos, semana.inicioStr, semana.finStr]
  )

  const resumenVehiculos = useMemo(() => {
    const map = new Map<string, { vehiculo: string; total: number; cantidad: number }>()
    for (const mov of gastosVehiculosSemana) {
      const vehiculo = mov.subcategoria?.trim() || mov.contacto?.trim() || 'Sin vehiculo'
      const actual = map.get(vehiculo) ?? { vehiculo, total: 0, cantidad: 0 }
      actual.total += Number(mov.monto_ars)
      actual.cantidad += 1
      map.set(vehiculo, actual)
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total)
  }, [gastosVehiculosSemana])

  const totalVehiculosSemana = resumenVehiculos.reduce((sum, item) => sum + item.total, 0)

  const registrarPersonal = async (e: React.FormEvent) => {
    e.preventDefault()
    const monto = Number(personalForm.monto)
    if (!personalForm.cuenta_id || !Number.isFinite(monto) || monto <= 0) {
      toast.error('Completa cuenta y monto del retiro')
      return
    }

    setGuardandoPersonal(true)
    try {
      await crearMovimiento({
        fecha: personalForm.fecha,
        tipo: 'egreso',
        monto_ars: monto,
        moneda_principal: 'ARS',
        categoria_id: RETIRO_PERSONAL_CATEGORY_ID,
        subcategoria: 'Retiro personal',
        descripcion: personalForm.descripcion.trim() || `Retiro personal - ${personalForm.persona}`,
        contacto: personalForm.persona,
        metodo_pago: personalForm.metodo_pago,
        cuenta_id: personalForm.cuenta_id,
      })
      toast.success('Retiro personal registrado')
      setPersonalForm(form => ({ ...form, monto: '', descripcion: '' }))
    } catch {
      toast.error('Error al registrar retiro')
    } finally {
      setGuardandoPersonal(false)
    }
  }

  const registrarVehiculo = async (e: React.FormEvent) => {
    e.preventDefault()
    const monto = Number(vehiculoForm.monto)
    const vehiculo = vehiculoForm.vehiculo.trim()
    if (!vehiculo || !vehiculoForm.cuenta_id || !Number.isFinite(monto) || monto <= 0) {
      toast.error('Completa vehiculo, cuenta y monto')
      return
    }

    setGuardandoVehiculo(true)
    try {
      await crearMovimiento({
        fecha: vehiculoForm.fecha,
        tipo: 'egreso',
        monto_ars: monto,
        moneda_principal: 'ARS',
        categoria_id: VEHICULOS_CATEGORY_ID,
        subcategoria: vehiculo,
        descripcion: vehiculoForm.descripcion.trim() || `Gasto vehiculo - ${vehiculo}`,
        contacto: vehiculo,
        metodo_pago: vehiculoForm.metodo_pago,
        cuenta_id: vehiculoForm.cuenta_id,
      })
      toast.success('Gasto de vehiculo registrado')
      setVehiculoForm(form => ({ ...form, monto: '', descripcion: '' }))
    } catch {
      toast.error('Error al registrar gasto de vehiculo')
    } finally {
      setGuardandoVehiculo(false)
    }
  }

  if (!movimientos) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2].map(i => <div key={i} className="h-56 animate-pulse rounded-xl bg-surface-2" />)}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-border bg-surface/90 p-5 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Retiros y vehiculos</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Semana del {formatDate(semana.inicioStr)} al {formatDate(semana.finStr)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Personales: {formatMoney(RETIRO_PERSONAL_TOPE_SEMANAL)} por persona</Badge>
            <Badge variant="default">Vehiculos sin tope</Badge>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {resumenPersonas.map(resumen => (
          <PersonaCard key={resumen.persona} resumen={resumen} />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center gap-2">
            <WalletCards size={17} className="text-primary" />
            <h3 className="text-sm font-semibold text-white">Registrar retiro personal</h3>
          </div>
          <form onSubmit={registrarPersonal} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Persona"
                value={personalForm.persona}
                onChange={e => setPersonalForm(form => ({ ...form, persona: e.target.value as PersonaRetiro }))}
              >
                {PERSONAS_RETIRO.map(persona => <option key={persona} value={persona}>{persona}</option>)}
              </Select>
              <Input
                label="Fecha"
                type="date"
                value={personalForm.fecha}
                onChange={e => setPersonalForm(form => ({ ...form, fecha: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Cuenta"
                value={personalForm.cuenta_id}
                onChange={e => setPersonalForm(form => ({ ...form, cuenta_id: e.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {(cuentas ?? []).map(cuenta => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>)}
              </Select>
              <Input
                label="Monto"
                type="number"
                min="0"
                step="0.01"
                value={personalForm.monto}
                onChange={e => setPersonalForm(form => ({ ...form, monto: e.target.value }))}
                required
              />
            </div>
            <Input
              label="Descripcion"
              placeholder="Ej: retiro semanal"
              value={personalForm.descripcion}
              onChange={e => setPersonalForm(form => ({ ...form, descripcion: e.target.value }))}
            />
            <Button type="submit" loading={guardandoPersonal}>
              <Plus size={14} /> Registrar retiro
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ReceiptText size={17} className="text-info" />
              <h3 className="text-sm font-semibold text-white">Retiros personales recientes</h3>
            </div>
            {resumenPersonas.some(p => p.usado > RETIRO_PERSONAL_TOPE_SEMANAL) && (
              <AlertTriangle size={16} className="text-warning" />
            )}
          </div>
          {retirosSemana.length === 0 ? (
            <EmptyState
              icon={CheckCircle2}
              titulo="Sin retiros esta semana"
              descripcion="Cuando cargues retiros de Andres o Nicolas van a aparecer aca."
            />
          ) : (
            <div className="overflow-hidden rounded-lg border border-border">
              <table className="w-full">
                <tbody>
                  {retirosSemana.slice(0, 8).map(mov => <MovimientoRow key={mov.id} movimiento={mov} />)}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center gap-2">
            <Car size={17} className="text-info" />
            <h3 className="text-sm font-semibold text-white">Registrar gasto de vehiculo</h3>
          </div>
          <form onSubmit={registrarVehiculo} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Vehiculo"
                placeholder="Ej: Partner, Kangoo, Hilux"
                value={vehiculoForm.vehiculo}
                onChange={e => setVehiculoForm(form => ({ ...form, vehiculo: e.target.value }))}
                required
              />
              <Input
                label="Fecha"
                type="date"
                value={vehiculoForm.fecha}
                onChange={e => setVehiculoForm(form => ({ ...form, fecha: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                label="Cuenta"
                value={vehiculoForm.cuenta_id}
                onChange={e => setVehiculoForm(form => ({ ...form, cuenta_id: e.target.value }))}
                required
              >
                <option value="">Seleccionar...</option>
                {(cuentas ?? []).map(cuenta => <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>)}
              </Select>
              <Input
                label="Monto"
                type="number"
                min="0"
                step="0.01"
                value={vehiculoForm.monto}
                onChange={e => setVehiculoForm(form => ({ ...form, monto: e.target.value }))}
                required
              />
            </div>
            <Input
              label="Descripcion"
              placeholder="Ej: combustible, service, peaje"
              value={vehiculoForm.descripcion}
              onChange={e => setVehiculoForm(form => ({ ...form, descripcion: e.target.value }))}
            />
            <Button type="submit" loading={guardandoVehiculo}>
              <Plus size={14} /> Registrar gasto
            </Button>
          </form>
        </section>

        <section className="rounded-xl border border-border bg-surface/90 p-4 shadow-xl shadow-black/10">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-white">Vehiculos esta semana</h3>
              <p className="text-xs text-muted-foreground">Total {formatMoney(totalVehiculosSemana)}</p>
            </div>
            <Badge variant="info">{gastosVehiculosSemana.length} movimientos</Badge>
          </div>

          {resumenVehiculos.length === 0 ? (
            <EmptyState
              icon={Car}
              titulo="Sin gastos de vehiculos"
              descripcion="Los gastos cargados desde este modulo quedan separados del resto de egresos."
            />
          ) : (
            <div className="space-y-3">
              {resumenVehiculos.map(item => (
                <div key={item.vehiculo} className="rounded-lg border border-border bg-surface-2 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{item.vehiculo}</p>
                      <p className="text-xs text-muted-foreground">{item.cantidad} movimiento{item.cantidad !== 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-sm font-bold text-white">{formatMoney(item.total)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
