import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import type { GlobalAction } from '@/components/ui/ActionMenu'
import { cn } from '@/lib/formatters'

interface LayoutProps {
  onNuevoMovimiento: () => void
  onGlobalAction: (action: GlobalAction) => void
}

const TITULOS: Record<string, { titulo: string; subtitulo?: string }> = {
  '/': { titulo: 'Dashboard', subtitulo: 'Resumen financiero del mes' },
  '/movimientos': { titulo: 'Movimientos', subtitulo: 'Gestión de ingresos y egresos' },
  '/cuentas': { titulo: 'Cuentas', subtitulo: 'Saldos y transferencias' },
  '/ventas': { titulo: 'Ventas', subtitulo: 'Documentos comerciales emitidos' },
  '/compras': { titulo: 'Compras', subtitulo: 'Documentos recibidos de proveedores' },
  '/catalogo': { titulo: 'Catálogo', subtitulo: 'Clientes, proveedores y productos' },
  '/fiscal': { titulo: 'Fiscal', subtitulo: 'Empresa, puntos de venta y ARCA/AFIP' },
  '/reportes': { titulo: 'Reportes', subtitulo: 'Análisis y exportación' },
  '/configuracion': { titulo: 'Configuración', subtitulo: 'Ajustes del sistema' },
}

export function Layout({ onNuevoMovimiento, onGlobalAction }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const location = useLocation()
  const info = TITULOS[location.pathname] ?? { titulo: 'Bartez Caja' }

  // cerrar drawer al navegar
  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  // bloquear scroll del body cuando el drawer está abierto
  useEffect(() => {
    if (!mobileOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [mobileOpen])

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape' && mobileOpen) {
      setMobileOpen(false)
      return
    }
    if (e.key === 'n' || e.key === 'N') {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      onNuevoMovimiento()
    }
  }, [onNuevoMovimiento, mobileOpen])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed(c => !c)}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className={cn(
        'flex flex-1 flex-col overflow-hidden transition-all duration-300',
        // En mobile el sidebar es overlay, así que no aplicamos margen.
        'md:transition-[margin]',
        collapsed ? 'md:ml-16' : 'md:ml-60'
      )}>
        <Header
          titulo={info.titulo}
          subtitulo={info.subtitulo}
          onGlobalAction={onGlobalAction}
          onOpenMenu={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-5 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
