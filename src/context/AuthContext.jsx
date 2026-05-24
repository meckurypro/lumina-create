import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { supabase, profiles as profilesApi, userRoles } from '@/lib/supabase'

const PROFILE_RETRY_ATTEMPTS = 4
const PROFILE_RETRY_DELAY_MS = 800
const OAUTH_PROVIDERS = new Set(['google', 'github', 'facebook', 'apple'])
const AuthContext = createContext(null)
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const fetchProfileWithRetry = async (userId) => {
  for (let attempt = 0; attempt < PROFILE_RETRY_ATTEMPTS; attempt++) {
    const { data, error } = await profilesApi.getById(userId)
    if (data) return { data, isNewUser: false }
    if (error && error.code !== 'PGRST116') console.error(`AuthContext: fetchProfile attempt ${attempt + 1} error`, error)
    if (attempt < PROFILE_RETRY_ATTEMPTS - 1) await sleep(PROFILE_RETRY_DELAY_MS)
  }
  return { data: null, isNewUser: true }
}

const deriveOnboardingNeeded = (profile, authUser) => {
  if (!profile) return true
  if (profile.onboarding_completed) return false
  const provider = authUser?.app_metadata?.provider ?? ''
  return !(OAUTH_PROVIDERS.has(provider) && !!profile.display_name && !!profile.avatar_url)
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [onboardingNeeded, setOnboardingNeeded] = useState(false)
  const activeProfileLoad = useRef(null)

  const loadProfile = useCallback(async (authUser) => {
    const userId = authUser?.id
    if (!userId || activeProfileLoad.current === userId) return
    activeProfileLoad.current = userId
    try {
      const [{ data, isNewUser }, roleResult] = await Promise.all([
        fetchProfileWithRetry(userId),
        userRoles.getForUser(userId),
      ])
      if (activeProfileLoad.current !== userId) return
      setRoles(roleResult.data || [])
      if (isNewUser || !data) {
        setProfile(null)
        setOnboardingNeeded(true)
      } else {
        setProfile(data)
        setOnboardingNeeded(deriveOnboardingNeeded(data, authUser))
      }
    } finally {
      if (activeProfileLoad.current === userId) activeProfileLoad.current = null
    }
  }, [])

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) {
          console.error('AuthContext: getSession error', error)
          return
        }
        if (session?.user) {
          setUser(session.user)
          await loadProfile(session.user)
        }
      } catch (err) {
        console.error('AuthContext: unexpected init error', err)
      } finally {
        if (mounted) setLoading(false)
      }
    }
    init()
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return
      if (event === 'SIGNED_OUT') {
        setUser(null)
        setProfile(null)
        setRoles([])
        setOnboardingNeeded(false)
        activeProfileLoad.current = null
        return
      }
      if (['SIGNED_IN', 'USER_UPDATED', 'INITIAL_SESSION'].includes(event) && session?.user) {
        setUser(session.user)
        // Defer Supabase calls out of the auth callback to avoid deadlocks
        setTimeout(() => {
          if (mounted) loadProfile(session.user)
        }, 0)
      }
    })
    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [loadProfile])

  const refreshProfile = useCallback(async () => {
    if (!user) return
    activeProfileLoad.current = null
    await loadProfile(user)
  }, [user, loadProfile])

  const updateProfileLocal = useCallback((updates) => {
    setProfile((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...updates }
      setOnboardingNeeded(deriveOnboardingNeeded(next, user))
      return next
    })
  }, [user])

  const value = useMemo(() => ({
    user,
    profile,
    roles,
    loading,
    onboardingNeeded,
    refreshProfile,
    updateProfileLocal,
    isAdmin: roles.includes('admin'),
    isStaff: roles.includes('staff') || roles.includes('moderator') || roles.includes('admin'),
    credits: profile?.credits ?? 0,
  }), [user, profile, roles, loading, onboardingNeeded, refreshProfile, updateProfileLocal])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an <AuthProvider>')
  return ctx
}
