import { useState } from 'react'
import { Dialog } from '@/components/ui/Dialog'
import { Input, Select } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { transferirEntreCuentas } from '@/hooks/useCuentas'
import { todayStr } from '@/lib/formatters'
import { toast } from 'sonner'
import type { Cuenta } from '@/db/schema'

interface Props {
  open: boolean
  onClose: () => void
  cuentas: Cuenta[]
}

export function TransferenciaModal({ open, onClose, cuentas }: Props) {
  const [origen, setOrigen] = useState('')
  const [destino, setDestino] = useState('')
  const [monto, setMonto] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [fecha, setFecha] = useState(todayStr())
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!origen || !destino || !monto || Number(monto) <= 0) {
      toast.error('Completá todos los campos')
      return
    }
    if (origen === destino) {
      toast.error('Las cuentas deben ser diferentes')
      return
    }
    setLoading(true)
    try {
      await transferirEntreCuentas(
        origen, destino,
        Number(monto),
        descripcion || 'Transferencia entre cuentas',
        fecha
      )
      toast.success('Transferencia registrada')
      onClose()
      setMonto(''); setDescripcion(''); setOrigen(''); setDestino('')
    } catch {
      toast.error('Error al registrar transferencia')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title="Transferencia entre cuentas" size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Fecha"
          type="date"
          value={fecha}
          onChange={e => setFecha(e.target.value)}
          required
        />
        <Select
          label="Cuenta origen"
          value={origen}
          onChange={e => setOrigen(e.target.value)}
          required
        >
          <option value="">Seleccionar...</option>
          {cuentas.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
        </Select>
        <Select
          label="Cuenta destino"
          value={destino}
          onChange={e => setDestino(e.target.value)}
          required
        >
          <option value="">Seleccionar...</option>
          {cuentas.filter(c => c.id !== origen).map(c => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </Select>
        <Input
          label="Monto ARS"
          type="number"
          min="0"
          step="0.01"
          placeholder="0.00"
          value={monto}
          onChange={e => setMonto(e.target.value)}
          required
        />
        <Input
          label="Descripción"
          placeholder="Motivo de la transferencia"
          value={descripcion}
          onChange={e => setDescripcion(e.target.value)}
        />
        <div className="flex gap-3 justify-end pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button type="submit" loading={loading}>Transferir</Button>
        </div>
      </form>
    </Dialog>
  )
}
