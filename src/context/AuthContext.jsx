// REPLACE WITH YOUR FULL src/context/AuthContext.jsx
// Minimal stub: just enough for App.jsx to mount.
import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext({ user: null, loading: true })

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data?.session?.user ?? null)
      setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub?.subscription?.unsubscribe?.()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, profile: null, signOut: () => supabase.auth.signOut() }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
