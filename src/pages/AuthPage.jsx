// src/pages/AuthPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, Lock, User, Zap } from 'lucide-react'
import { auth, profiles } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────

const VIEWS = Object.freeze({
  LANDING:         'landing',
  EMAIL_ENTRY:     'email_entry',
  OTP_VERIFY:      'otp_verify',
  SET_PASSWORD:    'set_password',
  SET_PROFILE:     'set_profile',
  LOGIN:           'login',
  FORGOT_PASSWORD: 'forgot_password',
  RESET_SENT:      'reset_sent',
})

const BACK_MAP = Object.freeze({
  [VIEWS.EMAIL_ENTRY]:     VIEWS.LANDING,
  [VIEWS.OTP_VERIFY]:      VIEWS.EMAIL_ENTRY,
  [VIEWS.SET_PASSWORD]:    VIEWS.OTP_VERIFY,
  [VIEWS.SET_PROFILE]:     VIEWS.LANDING,
  [VIEWS.LOGIN]:           VIEWS.LANDING,
  [VIEWS.FORGOT_PASSWORD]: VIEWS.LOGIN,
  [VIEWS.RESET_SENT]:      VIEWS.LOGIN,
})

const REEL_ITEMS = [
  { id: 1, colors: ['#1a0a00', '#f97316', '#7c2d12'], label: 'Office Handover'  },
  { id: 2, colors: ['#000000', '#1c1c1c', '#2d2d2d'], label: 'Memory Lane'      },
  { id: 3, colors: ['#0a0a1a', '#1e3a5f', '#0ea5e9'], label: 'AI Portrait'      },
  { id: 4, colors: ['#0a1a0a', '#14532d', '#16a34a'], label: 'Brand Video'      },
  { id: 5, colors: ['#1a0a1a', '#6b21a8', '#a855f7'], label: 'Cinematic'        },
  { id: 6, colors: ['#1a1000', '#92400e', '#d97706'], label: 'History'          },
]

// ─────────────────────────────────────────────────────────────
// Animation variants
// ─────────────────────────────────────────────────────────────

const slideIn = {
  initial:  { opacity: 0, x: 30  },
  animate:  { opacity: 1, x: 0   },
  exit:     { opacity: 0, x: -30 },
}
const fadeIn = {
  initial:  { opacity: 0, y: 20  },
  animate:  { opacity: 1, y: 0   },
  exit:     { opacity: 0, y: -20 },
}
const scaleIn = {
  initial:  { opacity: 0, scale: 0.95 },
  animate:  { opacity: 1, scale: 1    },
}

// ─────────────────────────────────────────────────────────────
// Reel slideshow (desktop right panel)
// ─────────────────────────────────────────────────────────────

const ReelSlideshow = () => {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    const timer = setInterval(
      () => setCurrent((prev) => (prev + 1) % REEL_ITEMS.length),
      3000,
    )
    return () => clearInterval(timer)
  }, [])

  const item = REEL_ITEMS[current]

  return (
    <div className="relative w-full h-full overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={current}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.8, ease: 'easeInOut' }}
          className="absolute inset-0"
          style={{
            background: `linear-gradient(160deg, ${item.colors[0]}, ${item.colors[1]}, ${item.colors[2]})`,
          }}
        />
      </AnimatePresence>

      <div
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.7) 100%)' }}
      />

      <div className="absolute bottom-0 left-0 right-0 p-10">
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'rgba(255,255,255,0.5)' }}
        >
          Made with Meckury AI
        </p>
        <AnimatePresence mode="wait">
          <motion.p
            key={current}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.4 }}
            className="text-white text-2xl font-black"
            style={{ letterSpacing: '-0.03em' }}
          >
            {item.label}
          </motion.p>
        </AnimatePresence>
      </div>

      <div className="absolute bottom-10 right-10 flex gap-1.5 items-center">
        {REEL_ITEMS.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Go to slide ${i + 1}`}
            className="rounded-full transition-all duration-300"
            style={{
              width:      i === current ? '20px' : '6px',
              height:     '6px',
              background: i === current ? 'white' : 'rgba(255,255,255,0.35)',
            }}
          />
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Reusable button primitives (defined outside component to
// avoid re-creating on every render)
// ─────────────────────────────────────────────────────────────

const PrimaryButton = ({ onClick, loading, children }) => (
  <button
    onClick={onClick}
    disabled={loading}
    className="w-full py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
    style={{
      background: 'var(--text-primary)',
      color:      'var(--text-inverse)',
      opacity:    loading ? 0.6 : 1,
      cursor:     loading ? 'not-allowed' : 'pointer',
    }}
  >
    {loading ? 'Please wait…' : children}
  </button>
)

const SecondaryButton = ({ onClick, children }) => (
  <button
    onClick={onClick}
    className="w-full py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
    style={{
      background: 'var(--bg-elevated)',
      color:      'var(--text-secondary)',
      border:     '1px solid var(--border)',
    }}
  >
    {children}
  </button>
)

const GoogleButton = ({ onClick }) => (
  <button
    onClick={onClick}
    className="w-full py-4 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
    style={{
      background: 'var(--bg-elevated)',
      color:      'var(--text-secondary)',
      border:     '1px solid var(--border)',
    }}
  >
    <img
      src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg"
      alt=""
      aria-hidden="true"
      className="w-4 h-4"
    />
    Continue with Google
  </button>
)

const OrDivider = () => (
  <div className="flex items-center gap-3">
    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>or</span>
    <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
  </div>
)

// ─────────────────────────────────────────────────────────────
// AuthPage
// ─────────────────────────────────────────────────────────────

export default function AuthPage() {
  const navigate                   = useNavigate()
  const { user, onboardingNeeded } = useAuth()

  const [view,        setView]        = useState(VIEWS.LANDING)
  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [otp,         setOtp]         = useState('')
  const [username,    setUsername]    = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [errors,      setErrors]      = useState({})

  // ── BUG FIX: redirect authenticated users ─────────────────
  // - Fully authenticated (onboarding done) → /feed
  // - Auth done but profile not set up yet  → SET_PROFILE view
  useEffect(() => {
    if (!user) return
    if (onboardingNeeded) {
      setView(VIEWS.SET_PROFILE)
    } else {
      navigate('/feed', { replace: true })
    }
  }, [user, onboardingNeeded, navigate])

  // ─────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────

  const clearErrors = () => setErrors({})

  const back = useCallback(() => {
    clearErrors()
    setView((current) => BACK_MAP[current] ?? VIEWS.LANDING)
  }, [])

  // ─────────────────────────────────────────────────────────
  // Auth handlers
  // ─────────────────────────────────────────────────────────

  const handleSendOTP = async () => {
    clearErrors()
    if (!email)                      return setErrors({ email: 'Email is required' })
    if (!/\S+@\S+\.\S+/.test(email)) return setErrors({ email: 'Enter a valid email address' })

    setLoading(true)
    const { error } = await auth.signUpWithEmail(email)
    setLoading(false)

    if (error) { toast.error(error.message || 'Failed to send code'); return }
    toast.success('Check your email for the 8-digit code!')
    setView(VIEWS.OTP_VERIFY)
  }

  const handleVerifyOTP = async () => {
    clearErrors()
    if (otp.length < 8) return setErrors({ otp: 'Enter the complete 8-digit code' })

    setLoading(true)
    const { error } = await auth.verifyOTP(email, otp)
    setLoading(false)

    if (error) { setErrors({ otp: 'Invalid or expired code. Try again.' }); return }
    setView(VIEWS.SET_PASSWORD)
  }

  const handleSetPassword = async () => {
    clearErrors()
    const errs = {}
    if (!newPassword)                errs.newPassword = 'Password is required'
    else if (newPassword.length < 8) errs.newPassword = 'At least 8 characters'
    if (newPassword !== confirmPass) errs.confirmPass = 'Passwords do not match'
    if (Object.keys(errs).length)    return setErrors(errs)

    setLoading(true)
    const { error } = await auth.updatePassword(newPassword)
    setLoading(false)

    if (error) { toast.error('Failed to set password'); return }
    setView(VIEWS.SET_PROFILE)
  }

  const handleSetProfile = async () => {
    clearErrors()
    const errs = {}
    if (!username)                               errs.username = 'Username is required'
    else if (username.length < 3)                errs.username = 'At least 3 characters'
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) errs.username = 'Letters, numbers and underscores only'
    if (Object.keys(errs).length)                return setErrors(errs)

    setLoading(true)
    const { available } = await profiles.checkUsername(username.toLowerCase())
    if (!available) {
      setLoading(false)
      return setErrors({ username: 'Username is taken. Try another.' })
    }

    const { error } = await profiles.completeOnboarding(user.id, {
      username:    username.toLowerCase(),
      displayName: displayName.trim() || username,
    })
    setLoading(false)

    if (error) { toast.error('Failed to save profile'); return }

    toast.success('Welcome to Meckury AI! 🎉')
    // The useEffect above will fire once onboardingNeeded flips to false
    // via refreshProfile (called inside completeOnboarding or AuthContext).
    // Explicit navigate here as a fallback:
    navigate('/feed', { replace: true })
  }

  const handleLogin = async () => {
    clearErrors()
    const errs = {}
    if (!email)    errs.email    = 'Email is required'
    if (!password) errs.password = 'Password is required'
    if (Object.keys(errs).length) return setErrors(errs)

    setLoading(true)
    const { error } = await auth.signIn(email, password)
    setLoading(false)

    if (error) { setErrors({ password: 'Invalid email or password' }); return }
    // Navigation is handled by the useEffect above once user + profile load
  }

  const handleGoogleAuth = async () => {
    const { error } = await auth.signInWithGoogle()
    if (error) toast.error('Google sign in failed')
    // Supabase redirects to /auth/callback → back to /auth
    // The useEffect above will then redirect to /feed or SET_PROFILE
  }

  const handleForgotPassword = async () => {
    clearErrors()
    if (!email) return setErrors({ email: 'Enter your email address' })

    setLoading(true)
    const { error } = await auth.resetPassword(email)
    setLoading(false)

    if (error) { toast.error('Failed to send reset email'); return }
    setView(VIEWS.RESET_SENT)
  }

  // ─────────────────────────────────────────────────────────
  // Sub-components (inline to access handlers without prop
  // drilling, but defined as stable named components)
  // ─────────────────────────────────────────────────────────

  const BackButton = () =>
    view !== VIEWS.LANDING ? (
      <motion.button
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={back}
        className="flex items-center gap-1.5 mb-6 -ml-1 p-2 rounded-xl w-fit text-sm font-medium"
        style={{ color: 'var(--text-secondary)' }}
        aria-label="Go back"
      >
        ← Back
      </motion.button>
    ) : null

  // ─────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────

  return (
    <div
      className="h-dvh flex overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* ── LEFT: form panel ────────────────────────────── */}
      <div
        className="flex flex-col w-full lg:w-[480px] xl:w-[520px] flex-shrink-0 h-full"
        style={{ borderRight: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div
          className="flex items-center px-8 h-14 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => navigate('/')}
            role="link"
            aria-label="Go to homepage"
          >
            <div
              className="w-7 h-7 rounded-lg flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
            >
              <Zap size={14} fill="white" className="text-white" aria-hidden="true" />
            </div>
            <span className="font-bold text-base tracking-tight">Meckury AI</span>
          </div>
        </div>

        {/* Form area */}
        <div className="flex flex-col flex-1 justify-center px-8 py-10 overflow-y-auto">
          <AnimatePresence mode="wait">

            {/* ── Landing ──────────────────────────────── */}
            {view === VIEWS.LANDING && (
              <motion.div key="landing" {...fadeIn} className="flex flex-col gap-6">
                <div>
                  <h1 className="text-3xl font-black mb-2">Get started</h1>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Create stunning AI content in seconds
                  </p>
                </div>
                <div className="flex flex-col gap-3">
                  <PrimaryButton onClick={() => setView(VIEWS.EMAIL_ENTRY)} loading={loading}>
                    Get started free →
                  </PrimaryButton>
                  <SecondaryButton onClick={() => setView(VIEWS.LOGIN)}>
                    Sign in
                  </SecondaryButton>
                  <OrDivider />
                  <GoogleButton onClick={handleGoogleAuth} />
                </div>
                <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                  By continuing you agree to our Terms &amp; Privacy Policy
                </p>
              </motion.div>
            )}

            {/* ── Email Entry ───────────────────────────── */}
            {view === VIEWS.EMAIL_ENTRY && (
              <motion.div key="email" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Create account</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    We'll send an 8-digit verification code to your email
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Email address" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" icon={Mail} error={errors.email}
                    autoComplete="email" autoFocus
                  />
                  <PrimaryButton onClick={handleSendOTP} loading={loading}>
                    Send verification code
                  </PrimaryButton>
                  <OrDivider />
                  <GoogleButton onClick={handleGoogleAuth} />
                </div>
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  Already have an account?{' '}
                  <button
                    onClick={() => setView(VIEWS.LOGIN)}
                    className="font-semibold"
                    style={{ color: 'var(--brand)' }}
                  >
                    Sign in
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── OTP Verify ────────────────────────────── */}
            {view === VIEWS.OTP_VERIFY && (
              <motion.div key="otp" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Check your email</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    We sent a code to{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Verification code" type="text" inputMode="numeric"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 8))}
                    placeholder="Enter 8-digit code" error={errors.otp}
                    autoComplete="one-time-code" autoFocus maxLength={8}
                  />
                  <PrimaryButton onClick={handleVerifyOTP} loading={loading}>
                    Verify code
                  </PrimaryButton>
                  <button
                    onClick={handleSendOTP}
                    className="text-sm text-center font-medium"
                    style={{ color: 'var(--brand)' }}
                  >
                    Resend code
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── Set Password ──────────────────────────── */}
            {view === VIEWS.SET_PASSWORD && (
              <motion.div key="set-password" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Set a password</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Choose a strong password to secure your account
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Password" type="password" value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters" icon={Lock}
                    error={errors.newPassword} autoFocus autoComplete="new-password"
                  />
                  <Input
                    label="Confirm password" type="password" value={confirmPass}
                    onChange={(e) => setConfirmPass(e.target.value)}
                    placeholder="Repeat your password" icon={Lock}
                    error={errors.confirmPass} autoComplete="new-password"
                  />
                  <PrimaryButton onClick={handleSetPassword} loading={loading}>
                    Continue
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {/* ── Set Profile ───────────────────────────── */}
            {view === VIEWS.SET_PROFILE && (
              <motion.div key="profile" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Set up profile</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Almost there! Choose your username
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Username" value={username}
                    onChange={(e) => setUsername(e.target.value.toLowerCase())}
                    placeholder="yourname" icon={User} error={errors.username}
                    hint="Letters, numbers and underscores only"
                    maxLength={30} autoFocus
                  />
                  <Input
                    label="Display name (optional)" value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your Name" icon={User} maxLength={50}
                  />
                  <PrimaryButton onClick={handleSetProfile} loading={loading}>
                    Start creating 🎉
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {/* ── Login ─────────────────────────────────── */}
            {view === VIEWS.LOGIN && (
              <motion.div key="login" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Welcome back</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Sign in to your account
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Email address" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" icon={Mail} error={errors.email}
                    autoComplete="email" autoFocus
                  />
                  <Input
                    label="Password" type="password" value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••" icon={Lock} error={errors.password}
                    autoComplete="current-password"
                  />
                  <button
                    onClick={() => setView(VIEWS.FORGOT_PASSWORD)}
                    className="text-sm text-right font-medium -mt-2"
                    style={{ color: 'var(--brand)' }}
                  >
                    Forgot password?
                  </button>
                  <PrimaryButton onClick={handleLogin} loading={loading}>
                    Sign in
                  </PrimaryButton>
                  <OrDivider />
                  <GoogleButton onClick={handleGoogleAuth} />
                </div>
                <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  Don't have an account?{' '}
                  <button
                    onClick={() => setView(VIEWS.EMAIL_ENTRY)}
                    className="font-semibold"
                    style={{ color: 'var(--brand)' }}
                  >
                    Sign up free
                  </button>
                </p>
              </motion.div>
            )}

            {/* ── Forgot Password ───────────────────────── */}
            {view === VIEWS.FORGOT_PASSWORD && (
              <motion.div key="forgot" {...slideIn} className="flex flex-col gap-6">
                <BackButton />
                <div>
                  <h2 className="text-3xl font-black mb-2">Reset password</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    Enter your email and we'll send a reset link
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Input
                    label="Email address" type="email" value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" icon={Mail}
                    error={errors.email} autoFocus
                  />
                  <PrimaryButton onClick={handleForgotPassword} loading={loading}>
                    Send reset link
                  </PrimaryButton>
                </div>
              </motion.div>
            )}

            {/* ── Reset Sent ────────────────────────────── */}
            {view === VIEWS.RESET_SENT && (
              <motion.div key="reset-sent" {...scaleIn} className="flex flex-col items-center text-center gap-6">
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                >
                  <Mail size={28} style={{ color: 'var(--text-primary)' }} aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-2xl font-black mb-2">Check your email</h2>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    We sent a reset link to{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
                  </p>
                </div>
                <SecondaryButton onClick={() => setView(VIEWS.LOGIN)}>
                  Back to sign in
                </SecondaryButton>
              </motion.div>
            )}

          </AnimatePresence>
        </div>

        {/* Footer */}
        <div
          className="flex-shrink-0 px-8 py-5 flex items-center justify-between"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>By LinkAI</p>
          <div className="flex items-center gap-4">
            <button className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Terms</button>
            <button className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Privacy</button>
          </div>
        </div>
      </div>

      {/* ── RIGHT: reel slideshow (desktop only) ─────────── */}
      <div className="hidden lg:block flex-1 h-full" aria-hidden="true">
        <ReelSlideshow />
      </div>
    </div>
  )
}
