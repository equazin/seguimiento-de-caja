import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/db/schema'
import type { Empresa } from '@/db/schema'

interface AuthContextValue {
  session: Session | null
  loading: boolean
  empresa: Empresa | null
  empresaLoading: boolean
  empresaError: string | null
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshEmpresa: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [empresa, setEmpresa] = useState<Empresa | null>(null)
  const [empresaLoading, setEmpresaLoading] = useState(false)
  const [empresaError, setEmpresaError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setLoading(false)
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) {
      setEmpresa(null)
      setEmpresaError(null)
      return
    }
    void loadEmpresa()
  }, [session?.user.id])

  async function loadEmpresa() {
    setEmpresaLoading(true)
    setEmpresaError(null)
    try {
      // empresas todavia no esta declarada en el Database tipado;
      // se consulta con cast hasta migrar el tipado del cliente.
      const client = supabase as unknown as {
        from: (table: string) => {
          select: (columns: string) => {
            limit: (n: number) => {
              maybeSingle: () => Promise<{ data: Empresa | null; error: Error | null }>
            }
          }
        }
      }
      const { data, error } = await client
        .from('empresas')
        .select('*')
        .limit(1)
        .maybeSingle()
      if (error) throw error
      setEmpresa(data)
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Error cargando empresa'
      setEmpresaError(message)
      setEmpresa(null)
    } finally {
      setEmpresaLoading(false)
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      empresa,
      empresaLoading,
      empresaError,
      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      },
      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
      },
      refreshEmpresa: loadEmpresa,
    }),
    [session, loading, empresa, empresaLoading, empresaError]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider')
  return ctx
}
