import { useState, useEffect } from 'react'
import { BrowserRouter, Navigate, Routes, Route, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { Layout } from '@/components/layout/Layout'
import { Dashboard } from '@/pages/Dashboard'
import { Movimientos } from '@/pages/Movimientos'
import { Cuentas } from '@/pages/Cuentas'
import { Reportes } from '@/pages/Reportes'
import { Configuracion } from '@/pages/Configuracion'
import { Ventas } from '@/pages/Ventas'
import { Compras } from '@/pages/Compras'
import { DocumentoEditor } from '@/pages/DocumentoEditor'
import { DocumentoDetalle } from '@/pages/DocumentoDetalle'
import { Catalogo } from '@/pages/Catalogo'
import { Fiscal } from '@/pages/Fiscal'
import { PedidosCompra } from '@/pages/PedidosCompra'
import { PedidosVenta } from '@/pages/PedidosVenta'
import { MovimientoModal } from '@/components/movimientos/MovimientoModal'
import { ContactoModal } from '@/components/catalogo/ContactoModal'
import { ProductoModal } from '@/components/catalogo/ProductoModal'
import { LoginPage } from '@/components/auth/LoginPage'
import { AuthProvider, useAuth } from '@/lib/auth'
import { seedDatosIniciales } from '@/lib/seed'
import type { Movimiento } from '@/db/schema'
import type { GlobalAction } from '@/components/ui/ActionMenu'

function AppShell() {
  const { session, loading } = useAuth()
  const navigate = useNavigate()
  const [modalOpen, setModalOpen] = useState(false)
  const [movimientoEditar, setMovimientoEditar] = useState<Movimiento | null>(null)
  const [contactoOpen, setContactoOpen] = useState(false)
  const [contactoTipo, setContactoTipo] = useState<'cliente' | 'proveedor'>('cliente')
  const [productoOpen, setProductoOpen] = useState(false)
  const [seeded, setSeeded] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    if (!session) {
      setSeeded(false)
      setSeedError(null)
      return
    }
    let cancelled = false
    seedDatosIniciales()
      .then(() => {
        if (!cancelled) setSeeded(true)
      })
      .catch(error => {
        if (cancelled) return
        console.error('Error inicializando datos', error)
        setSeedError(error instanceof Error ? error.message : 'No se pudo inicializar la base de datos')
      })
    return () => {
      cancelled = true
    }
  }, [session?.user.id])

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

  const handleGlobalAction = (action: GlobalAction) => {
    if (action === 'movimiento') {
      handleNuevoMovimiento()
      return
    }
    if (action === 'venta' || action === 'compra') {
      navigate(action === 'venta' ? '/ventas/nuevo' : '/compras/nuevo')
      return
    }
    if (action === 'cliente' || action === 'proveedor') {
      setContactoTipo(action)
      setContactoOpen(true)
      return
    }
    setProductoOpen(true)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground text-sm">Cargando…</p>
        </div>
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  if (seedError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md text-center space-y-3">
          <p className="text-danger text-sm font-semibold">No se pudo conectar la base de datos</p>
          <h1 className="text-xl font-bold text-white">Falta preparar Supabase</h1>
          <p className="text-sm text-muted-foreground">
            Ejecutá el SQL de <span className="font-mono text-white">supabase/schema.sql</span> y las migraciones en <span className="font-mono text-white">supabase/migrations/</span> y recargá la app.
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
          <p className="text-muted-foreground text-sm">Iniciando Bartez Caja…</p>
        </div>
      </div>
    )
  }

  return (
    <>
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
        <Route element={<Layout onNuevoMovimiento={handleNuevoMovimiento} onGlobalAction={handleGlobalAction} />}>
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
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/ventas/nuevo" element={<DocumentoEditor tipoOperacion="venta" />} />
          <Route path="/ventas/:id/detalle" element={<DocumentoDetalle tipoOperacion="venta" />} />
          <Route path="/ventas/:id" element={<DocumentoEditor tipoOperacion="venta" />} />
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/nuevo" element={<DocumentoEditor tipoOperacion="compra" />} />
          <Route path="/compras/:id/detalle" element={<DocumentoDetalle tipoOperacion="compra" />} />
          <Route path="/compras/:id" element={<DocumentoEditor tipoOperacion="compra" />} />
          <Route path="/pedidos/compra" element={<PedidosCompra />} />
          <Route path="/pedidos/venta" element={<PedidosVenta />} />
          <Route path="/catalogo" element={<Catalogo />} />
          <Route path="/fiscal" element={<Fiscal />} />
          <Route path="/reportes" element={<Reportes />} />
          <Route path="/configuracion" element={<Configuracion />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <MovimientoModal
        open={modalOpen}
        onClose={handleCloseModal}
        movimiento={movimientoEditar}
      />
      <ContactoModal
        open={contactoOpen}
        onClose={() => setContactoOpen(false)}
        tipo={contactoTipo}
        contacto={null}
      />
      <ProductoModal
        open={productoOpen}
        onClose={() => setProductoOpen(false)}
        producto={null}
      />
    </>
  )
}

export default function App() {
  const githubPagesBase = '/seguimiento-de-caja'
  const basename = window.location.pathname.startsWith(githubPagesBase)
    ? githubPagesBase
    : import.meta.env.BASE_URL

  return (
    <AuthProvider>
      <BrowserRouter basename={basename}>
        <AppShell />
      </BrowserRouter>
    </AuthProvider>
  )
}
