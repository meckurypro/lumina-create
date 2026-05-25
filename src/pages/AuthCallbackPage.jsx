import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'

const CALLBACK_TIMEOUT_MS = 5000

export default function AuthCallbackPage() {
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const waitForSession = async () => {
      const startedAt = Date.now()
      while (Date.now() - startedAt < CALLBACK_TIMEOUT_MS) {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) return session
        await new Promise((resolve) => setTimeout(resolve, 150))
      }
      return null
    }

    const run = async () => {
      try {
        const url = new URL(window.location.href)
        const code = url.searchParams.get('code')
        const hashParams = new URLSearchParams(url.hash.replace(/^#/, ''))
        const hashError = hashParams.get('error_description') || hashParams.get('error')
        const errorDesc = url.searchParams.get('error_description') || url.searchParams.get('error')

        if (errorDesc || hashError) {
          const message = errorDesc || hashError
          console.error('OAuth error:', message)
          navigate('/auth?error=' + encodeURIComponent(message), { replace: true })
          return
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) {
            if (!/code verifier|auth code|invalid request/i.test(error.message)) {
              console.error('exchangeCodeForSession error:', error)
              navigate('/auth?error=' + encodeURIComponent(error.message), { replace: true })
              return
            }
            console.warn('OAuth code exchange skipped; waiting for stored session:', error.message)
          }
        }

        const session = await waitForSession()
        if (!session) {
          navigate('/auth?error=' + encodeURIComponent('Sign-in session could not be restored. Please try again.'), { replace: true })
          return
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