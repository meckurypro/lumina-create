import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Moon, Sun, Monitor, Lock, User, ChevronRight, Shield, Sparkles } from 'lucide-react'
import { auth, profiles } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useTheme } from '@/context/ThemeContext'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const Row = ({ icon: Icon, label, value, onClick, last = false }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-4 text-left transition-colors"
    style={{
      background:   'var(--bg-card)',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
    }}
  >
    <Icon size={17} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    <span className="flex-1 text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
      {label}
    </span>
    {value && (
      <span className="text-xs mr-1 truncate max-w-[120px]" style={{ color: 'var(--text-muted)' }}>
        {value}
      </span>
    )}
    <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
  </button>
)

// Toggle row — no chevron, just a pill switch
const ToggleRow = ({ icon: Icon, label, sublabel, checked, onChange, last = false }) => (
  <div
    className="w-full flex items-center gap-3 px-4 py-4"
    style={{
      background:   'var(--bg-card)',
      borderBottom: last ? 'none' : '1px solid var(--border-color)',
    }}
  >
    <Icon size={17} strokeWidth={1.5} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {sublabel && (
        <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
      )}
    </div>
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
      style={{ background: checked ? 'var(--text-primary)' : 'var(--bg-elevated)' }}
    >
      <span
        className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200"
        style={{
          background: checked ? 'var(--text-inverse)' : 'var(--text-muted)',
          transform:  checked ? 'translateX(20px)' : 'translateX(0)',
        }}
      />
    </button>
  </div>
)

export default function SettingsPage() {
  const navigate                              = useNavigate()
  const { user, profile, updateProfileLocal } = useAuth()
  const { theme, setTheme }                   = useTheme()

  const [showChangePassword, setShowChangePassword] = useState(false)
  const [showEditProfile,    setShowEditProfile]    = useState(false)

  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [passLoading, setPassLoading] = useState(false)
  const [passErrors,  setPassErrors]  = useState({})

  const [displayName,    setDisplayName]    = useState(profile?.display_name || '')
  const [bio,            setBio]            = useState(profile?.bio || '')
  const [profileLoading, setProfileLoading] = useState(false)

  // ai_prompt_refinement defaults to true if not yet in DB
  const promptRefinement = profile?.ai_prompt_refinement ?? true

  const handleToggleRefinement = async (next) => {
    // Optimistic update
    updateProfileLocal({ ai_prompt_refinement: next })
    const { data, error } = await profiles.update(user.id, { ai_prompt_refinement: next })
    if (error) {
      // Roll back
      updateProfileLocal({ ai_prompt_refinement: !next })
      toast.error('Could not save preference')
    }
  }

  const handleChangePassword = async () => {
    const errors = {}
    if (!newPass)                errors.newPass     = 'Required'
    else if (newPass.length < 8) errors.newPass     = 'Minimum 8 characters'
    if (newPass !== confirmPass) errors.confirmPass = 'Passwords do not match'
    if (Object.keys(errors).length > 0) return setPassErrors(errors)

    setPassLoading(true)
    const { error } = await auth.updatePassword(newPass)
    setPassLoading(false)
    if (error) { toast.error(error.message || 'Failed to update password'); return }
    toast.success('Password updated')
    setShowChangePassword(false)
    setNewPass('')
    setConfirmPass('')
  }

  const handleUpdateProfile = async () => {
    setProfileLoading(true)
    const { data, error } = await profiles.update(user.id, { display_name: displayName, bio })
    setProfileLoading(false)
    if (error) { toast.error('Failed to update profile'); return }
    updateProfileLocal(data)
    toast.success('Profile updated')
    setShowEditProfile(false)
  }

  const THEME_OPTIONS = [
    { value: 'light',  label: 'Light',  Icon: Sun     },
    { value: 'dark',   label: 'Dark',   Icon: Moon    },
    { value: 'system', label: 'System', Icon: Monitor },
  ]

  return (
    <div className="h-dvh flex flex-col" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center gap-2 px-4 h-14"
        style={{ borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
          aria-label="Go back"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Settings</h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* Appearance */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
               style={{ color: 'var(--text-muted)' }}>
              Appearance
            </p>
            <div
              className="rounded-2xl p-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex gap-2">
                {THEME_OPTIONS.map(({ value, label, Icon }) => (
                  <button
                    key={value}
                    onClick={() => setTheme(value)}
                    className="flex-1 flex flex-col items-center gap-2 py-3 rounded-xl transition-all text-xs font-semibold"
                    style={{
                      background: theme === value ? 'var(--text-primary)' : 'var(--bg-elevated)',
                      color:      theme === value ? 'var(--text-inverse)' : 'var(--text-muted)',
                    }}
                  >
                    <Icon size={16} strokeWidth={1.5} />
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Generation */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
               style={{ color: 'var(--text-muted)' }}>
              Generation
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--border-color)' }}
            >
              <ToggleRow
                icon={Sparkles}
                label="AI prompt refinement"
                sublabel="Meckury enhances your prompt before generating your content."
                checked={promptRefinement}
                onChange={handleToggleRefinement}
                last
              />
            </div>
          </div>

          {/* Account */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
               style={{ color: 'var(--text-muted)' }}>
              Account
            </p>
            <div
              className="rounded-2xl overflow-hidden"
              style={{ border: '1px solid var(--border-color)' }}
            >
              <Row
                icon={User}
                label="Edit profile"
                value={profile?.display_name || profile?.username}
                onClick={() => setShowEditProfile(true)}
              />
              <Row
                icon={Lock}
                label="Change password"
                onClick={() => setShowChangePassword(true)}
              />
              <Row
                icon={Shield}
                label="Email"
                value={user?.email}
                onClick={() => {}}
                last
              />
            </div>
          </div>

          {/* About */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-1"
               style={{ color: 'var(--text-muted)' }}>
              About
            </p>
            <div
              className="rounded-2xl px-4 py-3 flex items-center justify-between"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Version</span>
              <span className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>0.1.0</span>
            </div>
          </div>

        </div>
      </div>

      {/* Change Password Modal */}
      <Modal
        isOpen={showChangePassword}
        onClose={() => { setShowChangePassword(false); setPassErrors({}) }}
        title="Change password"
      >
        <div className="flex flex-col gap-4">
          <Input
            label="New password" type="password" value={newPass}
            onChange={(e) => setNewPass(e.target.value)}
            placeholder="Minimum 8 characters" icon={Lock}
            error={passErrors.newPass} autoFocus
          />
          <Input
            label="Confirm password" type="password" value={confirmPass}
            onChange={(e) => setConfirmPass(e.target.value)}
            placeholder="Repeat new password" icon={Lock}
            error={passErrors.confirmPass}
          />
          <button
            onClick={handleChangePassword}
            disabled={passLoading}
            className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    passLoading ? 0.6 : 1,
            }}
          >
            {passLoading ? 'Updating…' : 'Update password'}
          </button>
        </div>
      </Modal>

      {/* Edit Profile Modal */}
      <Modal isOpen={showEditProfile} onClose={() => setShowEditProfile(false)} title="Edit profile">
        <div className="flex flex-col gap-4">
          <Input
            label="Display name" value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your name" icon={User} maxLength={50} autoFocus
          />
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              Bio
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the community about yourself…"
              rows={3}
              maxLength={160}
              className="input-base resize-none"
            />
            <p className="text-xs text-right mt-1" style={{ color: 'var(--text-muted)' }}>
              {bio.length}/160
            </p>
          </div>
          <button
            onClick={handleUpdateProfile}
            disabled={profileLoading}
            className="w-full py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    profileLoading ? 0.6 : 1,
            }}
          >
            {profileLoading ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </Modal>

    </div>
  )
}
