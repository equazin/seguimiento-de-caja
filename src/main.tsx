import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error renderizando la app', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-6">
          <div className="max-w-lg rounded-xl border border-border bg-surface p-6 text-center shadow-xl shadow-black/20">
            <p className="text-sm font-semibold text-danger">No se pudo cargar la aplicación</p>
            <h1 className="mt-2 text-xl font-bold text-white">Recargá la página</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Si el problema sigue, cerrá sesión o limpiá los datos guardados del navegador.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-surface-2 p-3 text-left text-xs text-muted-foreground">
              {this.state.error.message}
            </pre>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
