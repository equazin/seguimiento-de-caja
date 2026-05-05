import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Movimientos } from '@/pages/Movimientos'
import { Cuentas } from '@/pages/Cuentas'
import { Reportes } from '@/pages/Reportes'
import { Configuracion } from '@/pages/Configuracion'
import { seedDatosIniciales } from '@/lib/seed'
import type { Movimiento } from '@/db/schema'

export default function App() {
  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<Movimiento | null>(null)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    seedDatosIniciales().then(() => setSeeded(true))
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
                modalOpen={modalOpen}
                onModalOpen={handleNuevoMovimiento}
                onModalClose={handleCloseModal}
                movimientoEditar={movimientoEditar}
                onEdit={handleEditMovimiento}
              />
            }
          />
          <Route path="/cuentas" element={<Cuentas />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
