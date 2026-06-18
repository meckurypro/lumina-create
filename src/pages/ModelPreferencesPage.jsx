// src/pages/ModelPreferencesPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import toast from 'react-hot-toast'

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

// ─── Model row ────────────────────────────────────────────
const ModelRow = ({ model, isActive, isRequired, isMasterOnly, onToggle, saving }) => {
  const disabled = isRequired || isMasterOnly

  return (
    <div
      className="flex items-center justify-between gap-3 py-3"
      style={{ borderBottom: '1px solid var(--border-color)', opacity: isMasterOnly ? 0.45 : 1 }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
           {model.label || '—'}
          </p>
          {isMasterOnly && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
              style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}
            >
              ⭐ Master
            </span>
          )}
          {isRequired && !isMasterOnly && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-md font-semibold flex-shrink-0"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#ef4444' }}
            >
              Required
            </span>
          )}
        </div>
        {model.description && (
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', lineHeight: '1.4' }}>
            {model.description}
          </p>
        )}
      </div>

      {disabled
        ? <Lock size={15} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        : (
          <button
            role="switch"
            aria-checked={isActive}
            onClick={() => onToggle(model.id, !isActive)}
            disabled={saving}
            className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors duration-200"
            style={{
              background: isActive ? 'var(--text-primary)' : 'var(--bg-elevated)',
              opacity:    saving ? 0.5 : 1,
            }}
          >
            <span
              className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full transition-transform duration-200"
              style={{
                background: isActive ? 'var(--text-inverse)' : 'var(--text-muted)',
                transform:  isActive ? 'translateX(20px)' : 'translateX(0)',
              }}
            />
          </button>
        )
      }
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────
export default function ModelPreferencesPage() {
  const navigate          = useNavigate()
  const { user, profile } = useAuth()
  const isMaster          = profile?.user_tier === 'master'

  const [models,   setModels]   = useState([])
  const [prefs,    setPrefs]    = useState({})   // { [model_id]: is_active }
  const [loading,  setLoading]  = useState(true)
  const [savingId, setSavingId] = useState(null)

  // ── Load models + user prefs ─────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const load = async () => {
      const [{ data: modelsData }, { data: prefsData }] = await Promise.all([
        supabase
          .from('models')
          .select('id, label, description, feature, tier_required, is_required')
          .eq('is_user_facing', true)
          .eq('is_active', true)
          .order('feature')
          .order('label'),
        supabase
          .from('user_model_preferences')
          .select('model_id, is_active')
          .eq('user_id', user.id),
      ])

      setModels(modelsData || [])

      const map = {}
      ;(prefsData || []).forEach((p) => { map[p.model_id] = p.is_active })
      setPrefs(map)
      setLoading(false)
    }
    load()
  }, [user?.id])

  // ── Toggle handler ───────────────────────────────────────
  const handleToggle = async (modelId, nextActive) => {
    setSavingId(modelId)
    setPrefs((prev) => ({ ...prev, [modelId]: nextActive }))

    const { error } = await supabase
      .from('user_model_preferences')
      .upsert(
        { user_id: user.id, model_id: modelId, is_active: nextActive },
        { onConflict: 'user_id,model_id' }
      )

    if (error) {
      setPrefs((prev) => ({ ...prev, [modelId]: !nextActive }))
      toast.error('Could not save preference')
    }

    setSavingId(null)
  }

  // ── Group by feature ─────────────────────────────────────
  const grouped = useMemo(() => {
    return models.reduce((acc, m) => {
      const key = m.feature || 'other'
      if (!acc[key]) acc[key] = []
      acc[key].push(m)
      return acc
    }, {})
  }, [models])

  // ── Skeleton ─────────────────────────────────────────────
  if (loading) {
    return (
      <div className="h-dvh flex flex-col" style={{ background: 'var(--bg-primary)' }}>
        <div
          className="flex-shrink-0 flex items-center gap-2 px-4 h-14"
          style={{ borderBottom: '1px solid var(--border-color)' }}
        >
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl"
                  style={{ color: 'var(--text-secondary)' }}>
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            Model Preferences
          </h1>
        </div>
        <div className="flex-1 p-4 flex flex-col gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 rounded-2xl animate-pulse"
                 style={{ background: 'var(--bg-card)' }} />
          ))}
        </div>
      </div>
    )
  }

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
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Model Preferences
        </h1>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-1">

          <p className="text-xs mb-5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
            Toggle which models appear in your dropdowns. Deactivated models are hidden from
            selectors but still accessible here.
            {!isMaster && (
              <> <span style={{ color: '#f59e0b' }}>⭐ Master</span> models require an upgrade.</>
            )}
          </p>

          {Object.entries(grouped).map(([feature, featureModels]) => (
            <div
              key={feature}
              className="rounded-2xl overflow-hidden mb-4"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              {/* Group header */}
              <div className="px-4 pt-4 pb-2">
                <p className="text-xs font-bold uppercase tracking-widest"
                   style={{ color: 'var(--text-muted)' }}>
                  {FEATURE_LABELS[feature] ?? feature}
                </p>
              </div>

              {/* Model rows */}
              <div className="px-4">
                {featureModels.map((model) => {
                  const isMasterOnly = model.tier_required === 'master' && !isMaster
                  const isRequired   = model.is_required
                 const isActive = prefs[model.id] ?? false

                  return (
                    <ModelRow
                      key={model.id}
                      model={model}
                      isActive={isRequired || isMasterOnly ? true : isActive}
                      isRequired={isRequired}
                      isMasterOnly={isMasterOnly}
                      onToggle={handleToggle}
                      saving={savingId === model.id}
                    />
                  )
                })}
              </div>

              <div style={{ height: 8 }} />
            </div>
          ))}

        </div>
      </div>
    </div>
  )
}
