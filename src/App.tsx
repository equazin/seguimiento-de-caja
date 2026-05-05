import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Movimientos } from '@/pages/Movimientos'
import { Cuentas } from '@/pages/Cuentas'
import { Reportes } from '@/pages/Reportes'
import { Configuracion } from '@/pages/Configuracion'
import { MovimientoModal } from '@/components/movimientos/MovimientoModal'
import { seedDatosIniciales } from '@/lib/seed'
import type { Movimiento } from '@/db/schema'

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<Movimiento | null>(null)
  const [seeded, setSeeded] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    seedDatosIniciales()
      .then(() => setSeeded(true))
      .catch(error => {
        console.error('Error inicializando datos', error)
        setSeedError(error instanceof Error ? error.message : 'No se pudo inicializar la base de datos')
      })
  }, [])

  const handleNuevoMovimiento = () => {
    setMovimientoEditar(null)
    setModalOpen(true)
  }

  const handleEditMovimiento = (m: Movimiento) => {
    setMovimientoEditar(m)
    setModalOpen(true)
  }

  const handleCloseModal = () => {
    setModalOpen(false)
    setMovimientoEditar(null)
  }

  if (seedError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-danger text-sm font-semibold">No se pudo conectar la base de datos</p>
          <h1 className="text-xl font-bold text-white">Falta preparar Supabase</h1>
          <p className="text-sm text-muted-foreground">
            Ejecutá el SQL de <span className="font-mono text-white">supabase/schema.sql</span> en Supabase y recargá la app.
          </p>
          <p className="text-xs text-muted-foreground break-words">{seedError}</p>
        </div>
      </div>
    )
  }

  if (!seeded) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Iniciando Bartez Caja...</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#1A1D27',
            border: '1px solid #2A2D3A',
            color: '#fff',
          },
        }}
      />
      <Routes>
        <Route element={<Layout onNuevoMovimiento={handleNuevoMovimiento} />}>
          <Route
            index
            element={<Dashboard onEditMovimiento={handleEditMovimiento} />}
          />
          <Route
            path="/movimientos"
            element={
              <Movimientos
                onModalOpen={handleNuevoMovimiento}
                onEdit={handleEditMovimiento}
              />
            }
          />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
      <MovimientoModal
        open={modalOpen}
        onClose={handleCloseModal}
        movimiento={movimientoEditar}
      />
    </BrowserRouter>
  )
}
