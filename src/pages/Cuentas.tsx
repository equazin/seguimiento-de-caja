import { useState } from 'react'
import { Plus, ArrowLeftRight } from 'lucide-react'
import { useCuentasConSaldo, crearCuenta, actualizarCuenta, desactivarCuenta } from '@/hooks/useCuentas'
import { useCuentas } from '@/hooks/useCuentas'
import { CuentaCard } from '@/components/cuentas/CuentaCard'
import { TransferenciaModal } from '@/components/cuentas/TransferenciaModal'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { SkeletonKPI } from '@/components/ui/Skeleton'
import { toast } from 'sonner'
import type { Cuenta, TipoCuenta, MonedaCuenta } from '@/db/schema'

interface FormCuenta {
  nombre: string
  tipo: TipoCuenta
  moneda: MonedaCuenta
  saldo_inicial: string
}

const FORM_INITIAL: FormCuenta = {
  nombre: '', tipo: 'banco', moneda: 'ARS', saldo_inicial: '0'
}

export function Cuentas() {
  const cuentasConSaldo = useCuentasConSaldo()
  const cuentas = useCuentas()
  const [modalCuenta, setModalCuenta] = useState(false)
  const [modalTransfer, setModalTransfer] = useState(false)
  const [editando, setEditando] = useState<Cuenta | null>(null)
  const [form, setForm] = useState<FormCuenta>(FORM_INITIAL)
  const [confirmDesactivar, setConfirmDesactivar] = useState<string | null>(null)

  const abrirNueva = () => {
    setEditando(null)
    setForm(FORM_INITIAL)
    setModalCuenta(true)
  }

  const abrirEditar = (cuenta: Cuenta) => {
    if (cuenta.sistema) {
      toast.error('No se puede editar una cuenta del sistema')
      return
    }
    setEditando(cuenta)
    setForm({
      nombre: cuenta.nombre,
      tipo: cuenta.tipo,
      moneda: cuenta.moneda,
      saldo_inicial: String(cuenta.saldo_inicial),
    })
    setModalCuenta(true)
  }

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault()
    const data = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      moneda: form.moneda,
      saldo_inicial: Number(form.saldo_inicial),
      activa: true,
    }
    try {
      if (editando) {
        await actualizarCuenta(editando.id, data)
        toast.success('Cuenta actualizada')
      } else {
        await crearCuenta(data)
        toast.success('Cuenta creada')
      }
      setModalCuenta(false)
    } catch {
      toast.error('Error al guardar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-surface/90 p-5 shadow-xl shadow-black/10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">Cuentas operativas</h2>
            <p className="mt-1 text-sm text-muted-foreground">Saldos, transferencias y medios disponibles.</p>
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <Button variant="secondary" onClick={() => setModalTransfer(true)}>
              <ArrowLeftRight size={15} /> Transferir
            </Button>
            <Button onClick={abrirNueva}>
              <Plus size={15} /> Nueva cuenta
            </Button>
          </div>
        </div>
      </div>

      {!cuentasConSaldo ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <SkeletonKPI key={i} />)}
        </div>
      ) : cuentasConSaldo.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p>No hay cuentas activas.</p>
          <Button className="mt-4" onClick={abrirNueva}>Crear primera cuenta</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cuentasConSaldo.map(c => (
            <CuentaCard
              key={c.id}
              cuenta={c}
              onEdit={() => abrirEditar(c)}
              onDesactivar={() => setConfirmDesactivar(c.id)}
            />
          ))}
        </div>
      )}

      {/* Modal cuenta */}
      <Dialog
        open={modalCuenta}
        onClose={() => setModalCuenta(false)}
        title={editando ? 'Editar cuenta' : 'Nueva cuenta'}
        size="sm"
      >
        <form onSubmit={handleGuardar} className="space-y-4">
          <Input
            label="Nombre"
            placeholder="Ej: Banco Galicia ARS"
            value={form.nombre}
            onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))}
            required
          />
          <Select
            label="Tipo"
            value={form.tipo}
            onChange={e => setForm(f => ({ ...f, tipo: e.target.value as TipoCuenta }))}
          >
            <option value="banco">🏦 Banco</option>
            <option value="digital">📱 Digital</option>
            <option value="efectivo">💵 Efectivo</option>
          </Select>
          <Select
            label="Moneda"
            value={form.moneda}
            onChange={e => setForm(f => ({ ...f, moneda: e.target.value as MonedaCuenta }))}
          >
            <option value="ARS">🇦🇷 ARS - Pesos</option>
            <option value="USD">🇺🇸 USD - Dólares</option>
          </Select>
          <Input
            label="Saldo inicial"
            type="number"
            min="0"
            step="0.01"
            value={form.saldo_inicial}
            onChange={e => setForm(f => ({ ...f, saldo_inicial: e.target.value }))}
          />
          <div className="flex gap-3 justify-end">
            <Button type="button" variant="secondary" onClick={() => setModalCuenta(false)}>
              Cancelar
            </Button>
            <Button type="submit">
              {editando ? 'Guardar' : 'Crear cuenta'}
            </Button>
          </div>
        </form>
      </Dialog>

      <TransferenciaModal
        open={modalTransfer}
        onClose={() => setModalTransfer(false)}
        cuentas={cuentas ?? []}
      />

      <ConfirmDialog
        open={confirmDesactivar !== null}
        onClose={() => setConfirmDesactivar(null)}
        onConfirm={async () => {
          if (!confirmDesactivar) return
          const cuenta = (cuentasConSaldo ?? []).find(c => c.id === confirmDesactivar)
          if (cuenta?.sistema) {
            toast.error('No se puede desactivar una cuenta del sistema')
            return
          }
          await desactivarCuenta(confirmDesactivar)
          toast.success('Cuenta desactivada')
        }}
        title="Desactivar cuenta"
        message="¿Desactivar esta cuenta? No aparecerá en los totales pero se conserva el historial."
        confirmLabel="Desactivar"
        danger
      />
    </div>
  )
}
