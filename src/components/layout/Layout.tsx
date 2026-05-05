import { useState, useEffect, useCallback } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/formatters'

interface LayoutProps {
  onNuevoMovimiento: () => void
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

export function Layout({ onNuevoMovimiento }: LayoutProps) {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const info = TITULOS[location.pathname] ?? { titulo: 'Bartez Caja' }

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'n' || e.key === 'N') {
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return
      e.preventDefault()
      onNuevoMovimiento()
    }
  }, [onNuevoMovimiento])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <div className={cn(
        'flex flex-col flex-1 overflow-hidden transition-all duration-300',
        collapsed ? 'ml-16' : 'ml-60'
      )}>
        <Header
          titulo={info.titulo}
          subtitulo={info.subtitulo}
          onNuevoMovimiento={onNuevoMovimiento}
        />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
