import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { User, Check } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { profiles } from '@/lib/supabase'
import { Input } from '@/components/ui/Input'
import toast from 'react-hot-toast'

const CREATOR_TYPES = [
  'Content Creator', 'Marketer', 'Designer', 'Founder / Business Owner',
  'Educator / Student', 'Agency / Team', 'Hobbyist', 'Other',
]
const USE_CASES = [
  'Social media videos', 'Ads & marketing', 'Personal memories',
  'Education & training', 'Brand storytelling', 'Just exploring',
]
const REFERRAL_SOURCES = [
  'Twitter / X', 'Instagram', 'TikTok', 'YouTube',
  'Friend or colleague', 'Google search', 'Other',
]
const ASPECT_RATIOS = [
  { value: '9:16',  label: '9:16', hint: 'Vertical · Reels, TikTok' },
  { value: '1:1',   label: '1:1',  hint: 'Square · Feed posts' },
  { value: '16:9',  label: '16:9', hint: 'Landscape · YouTube' },
]

const slide = {
  initial: { opacity: 0, x: 24 },
  animate: { opacity: 1, x: 0 },
  exit:    { opacity: 0, x: -24 },
}

// ── Single-select grid ────────────────────────────────────────────────────────
const ChoiceGrid = ({ options, value, onChange, cols = 2 }) => (
  <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
    {options.map((opt) => {
      const val      = typeof opt === 'string' ? opt : opt.value
      const label    = typeof opt === 'string' ? opt : opt.label
      const hint     = typeof opt === 'string' ? null : opt.hint
      const selected = value === val
      return (
        <button
          key={val}
          type="button"
          onClick={() => onChange(val)}
          className="text-left p-3.5 rounded-xl transition-all active:scale-[0.98]"
          style={{
            background: selected ? 'var(--text-primary)' : 'var(--bg-elevated)',
            color:      selected ? 'var(--text-inverse)' : 'var(--text-primary)',
            border:     `1px solid ${selected ? 'var(--text-primary)' : 'var(--border)'}`,
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-semibold">{label}</span>
            {selected && <Check size={14} aria-hidden="true" />}
          </div>
          {hint && (
            <p className="text-xs mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
              {hint}
            </p>
          )}
        </button>
      )
    })}
  </div>
)

// ── Multi-select grid — value is string[] ─────────────────────────────────────
const MultiChoiceGrid = ({ options, value = [], onChange, cols = 2 }) => {
  const toggle = (val) => {
    const next = value.includes(val)
      ? value.filter((v) => v !== val)
      : [...value, val]
    onChange(next)
  }
  return (
    <div className={`grid gap-2 ${cols === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
      {options.map((opt) => {
        const val      = typeof opt === 'string' ? opt : opt.value
        const label    = typeof opt === 'string' ? opt : opt.label
        const hint     = typeof opt === 'string' ? null : opt.hint
        const selected = value.includes(val)
        return (
          <button
            key={val}
            type="button"
            onClick={() => toggle(val)}
            className="text-left p-3.5 rounded-xl transition-all active:scale-[0.98]"
            style={{
              background: selected ? 'var(--text-primary)' : 'var(--bg-elevated)',
              color:      selected ? 'var(--text-inverse)' : 'var(--text-primary)',
              border:     `1px solid ${selected ? 'var(--text-primary)' : 'var(--border)'}`,
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{label}</span>
              {selected && <Check size={14} aria-hidden="true" />}
            </div>
            {hint && (
              <p className="text-xs mt-0.5" style={{ color: selected ? 'rgba(255,255,255,0.6)' : 'var(--text-muted)' }}>
                {hint}
              </p>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default function OnboardingWizard({ onComplete }) {
  const { user, profile, refreshProfile } = useAuth()

  const [step,    setStep]    = useState(0)
  const [loading, setLoading] = useState(false)
  const [errors,  setErrors]  = useState({})

  const [data, setData] = useState({
    username:               profile?.username?.startsWith('user_') ? '' : (profile?.username || ''),
    display_name:           profile?.display_name || '',
    creator_type:           [],   // string[]
    team_role:              '',
    primary_use_case:       [],   // string[]
    referral_source:        '',
    preferred_aspect_ratio: '9:16',
  })

  const update = (patch) => setData((d) => ({ ...d, ...patch }))

  const steps = [
    {
      title:    'Pick a username',
      subtitle: 'This is how others will find you on Meckury AI.',
      validate: async () => {
        const errs = {}
        const u    = data.username.trim().toLowerCase()
        if (!u)                           errs.username = 'Username is required'
        else if (u.length < 3)            errs.username = 'At least 3 characters'
        else if (!/^[a-z0-9_]+$/.test(u)) errs.username = 'Letters, numbers and underscores only'
        if (Object.keys(errs).length) { setErrors(errs); return false }
        if (u !== profile?.username) {
          const { available } = await profiles.checkUsername(u)
          if (!available) { setErrors({ username: 'Username is taken. Try another.' }); return false }
        }
        update({ username: u, display_name: data.display_name.trim() || u })
        return true
      },
      render: () => (
        <div className="flex flex-col gap-4">
          <Input
            label="Username" value={data.username}
            onChange={(e) => update({ username: e.target.value.toLowerCase() })}
            placeholder="yourname" icon={User} error={errors.username}
            hint="Letters, numbers and underscores only" maxLength={30} autoFocus
          />
          <Input
            label="Display name (optional)" value={data.display_name}
            onChange={(e) => update({ display_name: e.target.value })}
            placeholder="Your Name" icon={User} maxLength={50}
          />
        </div>
      ),
    },
    {
      title:    'What kind of creator are you?',
      subtitle: 'Pick all that apply.',
      validate: () =>
        data.creator_type.length > 0
          ? true
          : (setErrors({ creator_type: 'Pick at least one' }), false),
      render: () => (
        <div className="flex flex-col gap-4">
          <MultiChoiceGrid
            options={CREATOR_TYPES}
            value={data.creator_type}
            onChange={(v) => update({ creator_type: v })}
          />
          <Input
            label="What do you do for your team? (optional)"
            value={data.team_role}
            onChange={(e) => update({ team_role: e.target.value })}
            placeholder="e.g. Social media manager" maxLength={120}
          />
        </div>
      ),
    },
    {
      title:    'What will you use Meckury AI for?',
      subtitle: 'Pick all that apply.',
      validate: () =>
        data.primary_use_case.length > 0
          ? true
          : (setErrors({ primary_use_case: 'Pick at least one' }), false),
      render: () => (
        <MultiChoiceGrid
          options={USE_CASES}
          value={data.primary_use_case}
          onChange={(v) => update({ primary_use_case: v })}
        />
      ),
    },
    {
      title:    'Preferred aspect ratio',
      subtitle: "We'll default new creations to this.",
      validate: () => true,
      render:   () => (
        <ChoiceGrid cols={1} options={ASPECT_RATIOS}
          value={data.preferred_aspect_ratio}
          onChange={(v) => update({ preferred_aspect_ratio: v })} />
      ),
    },
    {
      title:    'How did you hear about us?',
      subtitle: 'Last one — promise.',
      validate: () =>
        data.referral_source
          ? true
          : (setErrors({ referral_source: 'Pick one' }), false),
      render: () => (
        <ChoiceGrid
          options={REFERRAL_SOURCES}
          value={data.referral_source}
          onChange={(v) => update({ referral_source: v })}
        />
      ),
    },
  ]

  const total   = steps.length
  const current = steps[step]
  const isLast  = step === total - 1

  const next = async () => {
    setErrors({})
    const ok = await current.validate()
    if (!ok) return
    if (!isLast) { setStep((s) => s + 1); return }

    setLoading(true)
    const { error } = await profiles.completeOnboarding(user.id, {
      username:               data.username,
      display_name:           data.display_name || data.username,
      // Serialize arrays as JSON strings for the text columns
      creator_type:           JSON.stringify(data.creator_type),
      team_role:              data.team_role || null,
      primary_use_case:       JSON.stringify(data.primary_use_case),
      referral_source:        data.referral_source,
      preferred_aspect_ratio: data.preferred_aspect_ratio,
    })
    if (error) { setLoading(false); toast.error(error.message || 'Failed to save profile'); return }
    await refreshProfile()
    toast.success('Welcome to Meckury AI! 🎉')
    setLoading(false)
    onComplete?.()
  }

  const back = () => { setErrors({}); setStep((s) => Math.max(0, s - 1)) }

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Progress */}
      <div className="flex items-center gap-1.5">
        {steps.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full overflow-hidden"
            style={{ background: 'var(--bg-elevated)' }}>
            <motion.div
              initial={false}
              animate={{ width: i <= step ? '100%' : '0%' }}
              transition={{ duration: 0.3 }}
              className="h-full"
              style={{ background: 'var(--text-primary)' }}
            />
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} {...slide} transition={{ duration: 0.2 }}
          className="flex flex-col gap-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: 'var(--text-muted)' }}>
              Step {step + 1} of {total}
            </p>
            <h2 className="text-3xl font-black mb-2 tracking-tight">{current.title}</h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{current.subtitle}</p>
          </div>
          {current.render()}
          {(errors.creator_type || errors.primary_use_case || errors.referral_source) && (
            <p className="text-xs" style={{ color: '#ef4444' }}>
              {errors.creator_type || errors.primary_use_case || errors.referral_source}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="flex items-center gap-3">
        {step > 0 && (
          <button
            onClick={back}
            className="px-5 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
            style={{
              background: 'var(--bg-elevated)',
              color:      'var(--text-secondary)',
              border:     '1px solid var(--border)',
            }}
          >
            Back
          </button>
        )}
        <button
          onClick={next}
          disabled={loading}
          className="flex-1 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
          style={{
            background: 'var(--text-primary)',
            color:      'var(--text-inverse)',
            opacity:    loading ? 0.6 : 1,
            cursor:     loading ? 'not-allowed' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : isLast ? 'Finish & start creating 🎉' : 'Continue →'}
        </button>
      </div>
    </div>
  )
}
