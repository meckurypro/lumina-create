import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Save, Shield, Zap, Lock, Unlock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─── Feature definitions ──────────────────────────────────
const GATABLE_FEATURES = [
  {
    slug:        'ugc',
    label:       'UGC Characters',
    description: 'Create and use AI UGC characters for content generation.',
  },
  {
    slug:        'ugc_voices',
    label:       'UGC Voices',
    description: 'Clone voices and use the voice studio.',
  },
  {
    slug:        'copy_motion',
    label:       'Copy Motion',
    description: 'Transfer motion from video to image. Novices get a weekly limit instead of full lock.',
  },
  {
    slug:        'templates',
    label:       'Templates',
    description: 'Access to the templates library on the Create page.',
  },
  {
    slug:        'canvas',
    label:       'Canvas / Smart Prompt',
    description: 'Smart prompt canvas tab on the Create page.',
  },
  {
    slug:        'feed_publish',
    label:       'Feed Publishing',
    description: 'Ability to publish generations to the public feed.',
  },
]

const SETTING_KEYS = ['novice_copy_motion_weekly_limit', 'novice_locked_features']

// ─── Feature label map ────────────────────────────────────
const FEATURE_LABELS = {
  text_to_image:       'Text to Image',
  image_to_image:      'Image to Image',
  text_image_to_image: 'Text + Image to Image',
  text_to_video:       'Text to Video',
  image_to_video:      'Image to Video',
  image_text_to_video: 'Image + Text to Video',
  frame_to_frame:      'Frame to Frame',
  motion_transfer:     'Motion Transfer',
  lipsync:             'Lipsync',
  video_to_video:      'Video to Video',
  face_swap:           'Face Swap',
  head_swap:           'Head Swap',
  cinematic:           'Cinematic',
  prompt_to_video:     'Prompt to Video',
  image_generation:    'Image Generation',
}

// ─── Section wrapper ──────────────────────────────────────
const Section = ({ title, description, children }) => (
  <div
    className="rounded-2xl overflow-hidden"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div className="px-5 py-4" style={{ borderBottom: '1px solid var(--border-color)' }}>
      <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {description && (
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{description}</p>
      )}
    </div>
    <div className="px-5 py-4 flex flex-col gap-3">{children}</div>
  </div>
)

// ─── Feature row ──────────────────────────────────────────
const FeatureRow = ({ feature, isLocked, onToggle, saving }) => (
  <div className="flex items-center justify-between gap-4 py-1">
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{feature.label}</p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{feature.description}</p>
    </div>
    <button
      onClick={() => onToggle(feature.slug, !isLocked)}
      disabled={saving}
      className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
      style={{
        background: isLocked ? 'rgba(239,68,68,0.1)'  : 'rgba(16,185,129,0.1)',
        color:      isLocked ? '#ef4444'               : '#10b981',
        border:     `1px solid ${isLocked ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
        opacity:    saving ? 0.6 : 1,
      }}
    >
      {saving
        ? <Loader2 size={11} className="animate-spin" />
        : isLocked
          ? <><Lock   size={11} /> Master only</>
          : <><Unlock size={11} /> All users</>
      }
    </button>
  </div>
)

// ─── Model Required Section ───────────────────────────────
const ModelRequiredSection = () => {
  const [models,      setModels]      = useState([])
  const [loading,     setLoading]     = useState(true)
  const [savingModel, setSavingModel] = useState(null)

  useEffect(() => {
    supabase
      .from('models')
      .select('id, label, feature, tier_required, is_required, is_active')
      .eq('is_user_facing', true)
      .order('feature')
      .order('label')
      .then(({ data, error }) => {
        if (error) toast.error('Failed to load models')
        else setModels(data || [])
        setLoading(false)
      })
  }, [])

  const handleToggleRequired = async (model) => {
    const next = !model.is_required
    setSavingModel(model.id)
    const { error } = await supabase
      .from('models')
      .update({ is_required: next })
      .eq('id', model.id)
    if (error) {
      toast.error('Failed to update model')
    } else {
      setModels((prev) =>
        prev.map((m) => m.id === model.id ? { ...m, is_required: next } : m)
      )
      toast.success(next ? `${model.label} is now required` : `${model.label} can be muted`)
    }
    setSavingModel(null)
  }

  const grouped = models.reduce((acc, m) => {
    const key = m.feature || 'other'
    if (!acc[key]) acc[key] = []
    acc[key].push(m)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
    )
  }

  return (
    <Section
      title="Model Settings"
      description="Mark models as required to prevent users from muting them. Required models always appear in dropdowns."
    >
      {Object.entries(grouped).map(([feature, featureModels], gi) => (
        <div key={feature}>
          {gi > 0 && <div style={{ height: 1, background: 'var(--border-color)', margin: '4px 0 12px' }} />}
          <p className="text-xs font-bold uppercase tracking-widest mb-3"
             style={{ color: 'var(--text-muted)' }}>
            {FEATURE_LABELS[feature] ?? feature}
          </p>
          <div className="flex flex-col gap-3">
            {featureModels.map((model) => (
              <div key={model.id} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {model.label}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {model.tier_required === 'master' ? '⭐ Master' : '🆓 Free'} · {model.feature}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleRequired(model)}
                  disabled={savingModel === model.id}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold flex-shrink-0 transition-all"
                  style={{
                    background: model.is_required ? 'rgba(239,68,68,0.1)'  : 'rgba(100,100,100,0.1)',
                    color:      model.is_required ? '#ef4444'               : 'var(--text-muted)',
                    border:     `1px solid ${model.is_required ? 'rgba(239,68,68,0.2)' : 'var(--border-color)'}`,
                    opacity:    savingModel === model.id ? 0.6 : 1,
                  }}
                >
                  {savingModel === model.id
                    ? <Loader2 size={11} className="animate-spin" />
                    : model.is_required
                      ? <><Lock   size={11} /> Required</>
                      : <><Unlock size={11} /> Optional</>
                  }
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </Section>
  )
}

// ─── Main component ───────────────────────────────────────
export default function TierSettings() {
  const [weeklyLimit,    setWeeklyLimit]    = useState(20)
  const [lockedFeatures, setLockedFeatures] = useState([])
  const [loading,        setLoading]        = useState(true)
  const [savingLimit,    setSavingLimit]    = useState(false)
  const [savingFeature,  setSavingFeature]  = useState(null)
  const [limitDraft,     setLimitDraft]     = useState('')

  // ── Load settings ────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', SETTING_KEYS)

      if (error) { toast.error('Failed to load settings'); setLoading(false); return }

      const map = Object.fromEntries((data || []).map((r) => [r.key, r.value]))

      const limit  = parseInt(map['novice_copy_motion_weekly_limit'] ?? '20', 10)
      const locked = JSON.parse(map['novice_locked_features'] ?? '["ugc","ugc_voices"]')

      setWeeklyLimit(limit)
      setLimitDraft(String(limit))
      setLockedFeatures(locked)
      setLoading(false)
    }
    load()
  }, [])

  // ── Upsert helper ────────────────────────────────────────
  const upsert = async (key, value) => {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: JSON.stringify(value), updated_at: new Date().toISOString() }, { onConflict: 'key' })
    if (error) throw error
  }

  // ── Save weekly limit ────────────────────────────────────
  const handleSaveLimit = async () => {
    const parsed = parseInt(limitDraft, 10)
    if (isNaN(parsed) || parsed < 1 || parsed > 999) {
      toast.error('Enter a number between 1 and 999')
      return
    }
    setSavingLimit(true)
    try {
      await upsert('novice_copy_motion_weekly_limit', parsed)
      setWeeklyLimit(parsed)
      toast.success('Weekly limit updated')
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingLimit(false)
    }
  }

  // ── Toggle a feature lock ────────────────────────────────
  const handleToggleFeature = async (slug, shouldLock) => {
    setSavingFeature(slug)
    const next = shouldLock
      ? [...new Set([...lockedFeatures, slug])]
      : lockedFeatures.filter((s) => s !== slug)
    try {
      await upsert('novice_locked_features', next)
      setLockedFeatures(next)
      toast.success(shouldLock ? `${slug} locked to Master` : `${slug} opened to all`)
    } catch {
      toast.error('Failed to save')
    } finally {
      setSavingFeature(null)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-48 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)' }} />
        ))}
      </div>
    )
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5">

      {/* Intro */}
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Control what Novice users can access. Changes apply instantly — no redeploy needed.
      </p>

      {/* ── Feature gates ── */}
      <Section
        title="Feature Access"
        description="Toggle which features require a Master subscription. 'All users' means both Novice and Master can access it."
      >
        {GATABLE_FEATURES.map((feature, i) => (
          <div key={feature.slug}>
            <FeatureRow
              feature={feature}
              isLocked={lockedFeatures.includes(feature.slug)}
              onToggle={handleToggleFeature}
              saving={savingFeature === feature.slug}
            />
            {i < GATABLE_FEATURES.length - 1 && (
              <div style={{ height: 1, background: 'var(--border-color)', marginTop: 12 }} />
            )}
          </div>
        ))}
      </Section>

      {/* ── Copy Motion weekly limit ── */}
      <Section
        title="Copy Motion — Novice Weekly Limit"
        description="Novice users can use Copy Motion this many times per week. Resets every 7 days from their first use. Masters have no limit."
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 flex-1">
            <Zap size={14} style={{ color: 'var(--brand)' }} fill="currentColor" />
            <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Uses per week</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={1}
              max={999}
              value={limitDraft}
              onChange={(e) => setLimitDraft(e.target.value)}
              className="w-20 text-center text-sm font-bold rounded-xl px-3 py-2 outline-none"
              style={{
                background: 'var(--bg-elevated)',
                border:     '1px solid var(--border-color)',
                color:      'var(--text-primary)',
              }}
            />
            <button
              onClick={handleSaveLimit}
              disabled={savingLimit || limitDraft === String(weeklyLimit)}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all"
              style={{
                background: limitDraft !== String(weeklyLimit) ? 'var(--brand)' : 'var(--bg-elevated)',
                color:      limitDraft !== String(weeklyLimit) ? 'white'        : 'var(--text-muted)',
                opacity:    savingLimit ? 0.7 : 1,
              }}
            >
              {savingLimit ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Save
            </button>
          </div>
        </div>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <Shield size={13} style={{ color: 'var(--text-muted)' }} />
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            Current limit: <strong style={{ color: 'var(--text-primary)' }}>{weeklyLimit} uses / week</strong> for Novice users
          </p>
        </div>
      </Section>

      {/* ── Model required toggles ── */}
      <ModelRequiredSection />

    </motion.div>
  )
}
