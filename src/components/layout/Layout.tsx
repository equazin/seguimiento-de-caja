import { useEffect, useCallback } from 'react'
import { Outlet } from 'react-router-dom'
import { TopNav } from './TopNav'
import type { GlobalAction } from '@/components/ui/ActionMenu'

interface LayoutProps {
  onNuevoMovimiento: () => void
  onGlobalAction: (action: GlobalAction) => void
}

export function Layout({ onNuevoMovimiento, onGlobalAction }: LayoutProps) {
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
    <div className="flex min-h-screen flex-col bg-background">
      <TopNav onGlobalAction={onGlobalAction} />
      <main className="flex-1 px-4 py-5 md:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  )
}
