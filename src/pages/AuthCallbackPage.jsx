import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error')

        if (errorDesc) {
          console.error('OAuth error:', errorDesc)
          navigate('/auth?error=' + encodeURIComponent(errorDesc), { replace: true })
          return
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            console.error('exchangeCodeForSession error:', error)
            navigate('/auth?error=' + encodeURIComponent(error.message), { replace: true })
            return
          }
        }

        // Wait briefly for AuthContext to pick up the session
        for (let i = 0; i < 20; i++) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) break
          await new Promise((r) => setTimeout(r, 100))
        }
        navigate('/feed', { replace: true })
      } catch (err) {
        console.error('Auth callback unexpected error:', err)
        navigate('/auth?error=' + encodeURIComponent('Sign-in failed'), { replace: true })
      }
    }
    run()
  }, [navigate])

  return (
    <div style={{ padding: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      Signing you in…
    </div>
  )
}