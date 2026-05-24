// src/pages/ResetPasswordPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Lock, CheckCircle, Zap } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

export default function ResetPasswordPage() {
  const navigate = useNavigate()

  const [sessionReady, setSessionReady] = useState(false)
  const [newPass,       setNewPass]      = useState('')
  const [confirmPass,   setConfirmPass]  = useState('')
  const [errors,        setErrors]       = useState({})
  const [loading,       setLoading]      = useState(false)
  const [done,          setDone]         = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setSessionReady(true)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setSessionReady(true)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async () => {
    const errs = {}
    if (!newPass)                errs.newPass     = 'Password is required'
    else if (newPass.length < 8) errs.newPass     = 'At least 8 characters'
    if (newPass !== confirmPass) errs.confirmPass = 'Passwords do not match'
    if (Object.keys(errs).length) return setErrors(errs)

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password: newPass })
    setLoading(false)

    if (error) { toast.error(error.message || 'Failed to reset password'); return }
    setDone(true)
  }

  return (
    <div
      className="h-dvh flex flex-col overflow-hidden"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center px-8 h-14"
        style={{ borderBottom: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-2 cursor-pointer"
          onClick={() => navigate('/')}
        >
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)' }}
          >
            <Zap size={14} fill="white" className="text-white" />
          </div>
          <span className="font-bold text-base tracking-tight">Meckury AI</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-8 overflow-y-auto">
        <div className="w-full max-w-sm">

          {done ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center gap-6"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <CheckCircle size={28} style={{ color: 'var(--text-primary)' }} />
              </div>
              <div>
                <h2 className="text-2xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
                  Password updated!
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Your password has been reset. You can now sign in with your new password.
                </p>
              </div>
              <button
                onClick={() => navigate('/auth')}
                className="w-full py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
                style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
              >
                Back to sign in
              </button>
            </motion.div>

          ) : !sessionReady ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center text-center gap-4"
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center animate-pulse"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
              >
                <Lock size={28} style={{ color: 'var(--text-muted)' }} />
              </div>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Verifying your reset link…
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                If nothing happens,{' '}
                <button
                  onClick={() => navigate('/auth')}
                  className="underline font-medium"
                  style={{ color: 'var(--brand)' }}
                >
                  request a new link
                </button>
              </p>
            </motion.div>

          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col gap-6"
            >
              <div>
                <h2 className="text-3xl font-black mb-2" style={{ color: 'var(--text-primary)' }}>
                  Set new password
                </h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Choose a strong password for your account
                </p>
              </div>

              <div className="flex flex-col gap-4">
                <Input
                  label="New password"
                  type="password"
                  value={newPass}
                  onChange={(e) => { setNewPass(e.target.value); setErrors({}) }}
                  placeholder="At least 8 characters"
                  icon={Lock}
                  error={errors.newPass}
                  autoFocus
                  autoComplete="new-password"
                />
                <Input
                  label="Confirm new password"
                  type="password"
                  value={confirmPass}
                  onChange={(e) => { setConfirmPass(e.target.value); setErrors({}) }}
                  placeholder="Repeat your password"
                  icon={Lock}
                  error={errors.confirmPass}
                  autoComplete="new-password"
                />
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
                  style={{
                    background: 'var(--text-primary)',
                    color:      'var(--text-inverse)',
                    opacity:    loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Please wait…' : 'Reset password'}
                </button>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
