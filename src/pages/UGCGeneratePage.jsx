// src/pages/UGCGeneratePage.jsx
// The generation screen for a specific UGC character profile
import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, User, Film, Sparkles,
  ImageIcon, VideoIcon, ChevronDown, Info
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcProfiles, ugcGenerations, buildUGCPromptPayload, buildPhotoSelectionPayload } from '@/lib/ugc'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      {label}
    </p>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === opt.value ? ACCENT         : 'var(--bg-elevated)',
            color:      value === opt.value ? '#000'         : 'var(--text-secondary)',
            border:     value === opt.value ? `1px solid ${ACCENT_BDR}` : '1px solid var(--border-color)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

const ModelDropdown = ({ models, value, onChange }) => {
  const [open, setOpen] = useState(false)
  const unlocked = models.filter((m) => !m.is_locked)
  const locked   = models.filter((m) =>  m.is_locked)
  const selected = models.find((m) => m.value === value) || unlocked[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
      >
        <span>{selected?.aka || selected?.label || 'Model'}</span>
        <ChevronDown size={10} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0,  scale: 1    }}
              exit={{    opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.13 }}
              className="absolute right-0 top-9 z-50 w-56 rounded-2xl overflow-hidden"
              style={{
                background: 'var(--bg-card)',
                border:     '1px solid var(--border-color)',
                boxShadow:  '0 8px 32px rgba(0,0,0,0.28)',
                maxHeight:  '60vh',
                overflowY:  'auto',
              }}
            >
              <div className="py-1">
                {unlocked.map((m) => (
                  <button
                    key={m.value}
                    onClick={() => { onChange(m.value); setOpen(false) }}
                    className="w-full flex items-center justify-between px-4 py-2.5 transition-colors text-left"
                    style={{ background: m.value === value ? ACCENT_SUB : 'transparent' }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.aka || m.label}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.sublabel}</p>
                    </div>
                    {m.value === value && <span style={{ color: ACCENT, fontSize: 14 }}>✓</span>}
                  </button>
                ))}
              </div>
              {locked.length > 0 && (
                <>
                  <div style={{ height: 1, background: 'var(--border-color)', margin: '0 12px' }} />
                  <div className="py-1">
                    {locked.map((m) => (
                      <div key={m.value} className="flex items-center justify-between px-4 py-2">
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>{m.label}</p>
                        <span style={{ fontSize: 11, opacity: 0.4 }}>🔒</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Refined prompt preview ────────────────────────────────────
const RefinedPromptPreview = ({ text, loading }) => (
  <AnimatePresence>
    {(text || loading) && (
      <motion.div
        initial={{ opacity: 0, height: 0 }}
        animate={{ opacity: 1, height: 'auto' }}
        exit={{    opacity: 0, height: 0 }}
        className="rounded-xl overflow-hidden mb-5"
        style={{ border: `1px solid ${ACCENT_BDR}`, background: ACCENT_SUB }}
      >
        <div className="px-4 py-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles size={11} style={{ color: ACCENT }} />
            <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: ACCENT }}>
              AI-Refined Prompt
            </p>
          </div>
          {loading ? (
            <div className="flex flex-col gap-1.5">
              {[...Array(3)].map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full animate-pulse"
                  style={{ background: ACCENT_BDR, width: i === 2 ? '60%' : '100%' }}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{text}</p>
          )}
        </div>
      </motion.div>
    )}
  </AnimatePresence>
)

// ── Main page ─────────────────────────────────────────────────
export default function UGCGeneratePage() {
  const { profileId }                              = useParams()
  const navigate                                   = useNavigate()
  const { user, profile: userProfile, credits, refreshProfile } = useAuth()

  const [profile,       setProfile]       = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model,         setModel]         = useState('')

  const [outputType,    setOutputType]    = useState('image')  // 'image' | 'video'
  const [filter,        setFilter]        = useState('hyper_realistic') // 'hyper_realistic' | 'cinematic'
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [duration,      setDuration]      = useState('5')
  const [scene,         setScene]         = useState('')
  const [refinedPrompt, setRefinedPrompt] = useState('')
  const [refining,      setRefining]      = useState(false)
  const [submitting,    setSubmitting]    = useState(false)

  const skipRefinement = !(userProfile?.ai_prompt_refinement ?? true)

  useEffect(() => {
    loadProfile()
    loadModels()
  }, [profileId])

  const loadProfile = async () => {
    setProfileLoading(true)
    const { data, error } = await ugcProfiles.getById(profileId)
    if (error || !data) {
      toast.error('Character not found')
      navigate('/create/ugc')
      return
    }
    setProfile(data)
    setProfileLoading(false)
  }

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = data || []
    setModels(list)
    const firstUnlocked = list.find((m) => !m.is_locked && m.type === 'image')
    setModel(firstUnlocked?.value || '')
    setModelsLoading(false)
  }, [])

  // Filter models by output type
  const filteredModels = models.filter((m) => m.type === outputType)
  const selectedModel  = filteredModels.find((m) => m.value === model) || filteredModels[0]

  // Switch to first available model when output type changes
  useEffect(() => {
    const first = filteredModels.find((m) => !m.is_locked)
    if (first) setModel(first.value)
  }, [outputType])

  const caps = selectedModel ? {
    supportedDurations:    selectedModel.supported_durations    ?? ['5', '8', '10'],
    supportedAspectRatios: selectedModel.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    supportsSound:         selectedModel.supports_sound         ?? false,
    isFlatRate:            selectedModel.is_flat_rate           ?? false,
  } : { supportedDurations: ['5'], supportedAspectRatios: ['9:16', '16:9', '1:1'], supportsSound: false, isFlatRate: false }

  const creditCost = (() => {
    if (!selectedModel) return 0
    const base = outputType === 'image'
      ? selectedModel.credit_cost_t2i || 0
      : caps.isFlatRate
        ? selectedModel.credit_cost_t2i || 0
        : (selectedModel.credit_cost_t2i || 0) * parseInt(duration)
    return Math.ceil(base)
  })()

  const canAfford   = credits >= creditCost
  const sceneEmpty  = !scene.trim()
  const btnDisabled = sceneEmpty || !canAfford || submitting || !selectedModel || profileLoading

  // ── AI prompt refinement ──────────────────────────────────
  const refinePrompt = useCallback(async (sceneText) => {
    if (!profile || skipRefinement || !sceneText.trim()) return
    setRefining(true)
    setRefinedPrompt('')
    try {
      // First: select 4 best reference photos
      const { systemPrompt: selSys, userMessage: selMsg } = buildPhotoSelectionPayload({
        profile,
        sceneDescription: sceneText,
        outputType,
      })

      const selRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 500,
          system:     selSys,
          messages:   [{ role: 'user', content: selMsg }],
        }),
      })
      const selData  = await selRes.json()
      const selText  = selData.content?.find((b) => b.type === 'text')?.text || '[]'
      let selectedPhotos = []
      try { selectedPhotos = JSON.parse(selText.replace(/```json|```/g, '').trim()) } catch { /* use empty */ }

      // Second: refine the generation prompt
      const { systemPrompt, userMessage } = buildUGCPromptPayload({
        profile,
        sceneDescription:  sceneText,
        outputType,
        filter,
        selectedPhotos,
        skipRefinement: false,
      })

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:      'claude-sonnet-4-20250514',
          max_tokens: 400,
          system:     systemPrompt,
          messages:   [{ role: 'user', content: userMessage }],
        }),
      })
      const data   = await res.json()
      const refined = data.content?.find((b) => b.type === 'text')?.text || sceneText
      setRefinedPrompt(refined.trim())
    } catch (err) {
      console.error('Prompt refinement error:', err)
      setRefinedPrompt('')
    } finally {
      setRefining(false)
    }
  }, [profile, outputType, filter, skipRefinement])

  // Debounce refinement
  useEffect(() => {
    if (sceneEmpty || !profile) return
    const timer = setTimeout(() => refinePrompt(scene), 1200)
    return () => clearTimeout(timer)
  }, [scene, outputType, filter])

  // ── Generate ──────────────────────────────────────────────
  const handleGenerate = async () => {
    if (sceneEmpty)     return toast.error('Describe the scene')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      // Get selected photos (re-select if refinement wasn't triggered)
      let selectedPhotos = []
      const { systemPrompt: selSys, userMessage: selMsg } = buildPhotoSelectionPayload({
        profile,
        sceneDescription: scene,
        outputType,
      })
      try {
        const selRes  = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 500,
            system:     selSys,
            messages:   [{ role: 'user', content: selMsg }],
          }),
        })
        const selData = await selRes.json()
        const selText = selData.content?.find((b) => b.type === 'text')?.text || '[]'
        selectedPhotos = JSON.parse(selText.replace(/```json|```/g, '').trim())
      } catch { /* proceed without */ }

      const finalPrompt = refinedPrompt || scene

      // Create generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        outputType === 'image' ? 'text_to_image' : 'text_to_video',
        status:                 'pending',
        prompt:                 scene,
        enhanced_prompt:        finalPrompt,
        model:                  selectedModel.value,
        aspect_ratio:           aspectRatio,
        duration:               outputType === 'video' ? duration : undefined,
        credits_charged:        creditCost,
        output_type:            outputType,
        skip_prompt_refinement: skipRefinement,
        prompt_engineering_used: !skipRefinement,
        input_image_urls:       selectedPhotos.length ? selectedPhotos : null,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Record UGC-specific metadata
      await ugcGenerations.create({
        generation_id:  genRow.id,
        ugc_profile_id: profileId,
        user_id:        user.id,
        output_type:    outputType,
        filter_applied: filter,
        scene_prompt:   scene,
        refined_prompt: finalPrompt,
        selected_photos: selectedPhotos,
        aspect_ratio:   aspectRatio,
      })

      // Invoke edge function
      const fn = outputType === 'image' ? 'image-generate' : 'video-generate'
      supabase.functions.invoke(fn, { body: { generationId: genRow.id } })
        .catch((e) => console.error(`${fn} invoke error`, e))

      refreshProfile()
      toast.success(`Your ${outputType} is being generated. Check your Media page.`, { duration: 4000 })
      setScene('')
      setRefinedPrompt('')

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (profileLoading) {
    return (
      <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
          className="w-8 h-8 rounded-full border-2"
          style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
        />
      </div>
    )
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Generating overlay */}
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>Generating…</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button onClick={() => navigate('/create/ugc')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>

        {/* Character identity */}
        <button
          onClick={() => navigate('/create/ugc')}
          className="flex items-center gap-2.5"
        >
          {profile?.thumbnail_url ? (
            <img
              src={profile.thumbnail_url}
              alt={profile.name}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
              style={{ border: `2px solid ${ACCENT_BDR}` }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
            >
              <User size={14} style={{ color: ACCENT }} />
            </div>
          )}
          <div className="flex flex-col items-start">
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>{profile?.name}</p>
            <p className="text-xs mt-0.5" style={{ color: ACCENT }}>UGC</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown models={filteredModels} value={selectedModel?.value || ''} onChange={setModel} />
          )}
          <div
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-1">

          {/* Output type toggle */}
          <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'var(--bg-elevated)' }}>
            {[
              { value: 'image', label: 'Image', Icon: ImageIcon },
              { value: 'video', label: 'Video', Icon: VideoIcon },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setOutputType(value)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: outputType === value ? 'var(--bg-card)' : 'transparent',
                  color:      outputType === value ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  outputType === value ? 'var(--shadow)' : 'none',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Scene description */}
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Scene Description
            </p>
            <textarea
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder={`Describe what ${profile?.name} is doing, where they are, the vibe of the moment…`}
              rows={4}
              maxLength={600}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background:  'var(--bg-elevated)',
                border:      '1px solid var(--border-color)',
                color:       'var(--text-primary)',
                lineHeight:  1.6,
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
              {scene.length}/600
            </p>
          </div>

          {/* Refined prompt preview */}
          <RefinedPromptPreview text={refinedPrompt} loading={refining} />

          {/* Filter */}
          <SettingChips
            label="Style Filter"
            options={[
              { value: 'hyper_realistic', label: '📱 Hyper Realistic' },
              { value: 'cinematic',       label: '🎬 Cinematic'       },
            ]}
            value={filter}
            onChange={setFilter}
          />

          {/* Aspect ratio */}
          <SettingChips
            label="Aspect Ratio"
            options={ALL_ASPECT_RATIOS.map((o) => ({
              ...o,
              disabled: !caps.supportedAspectRatios.includes(o.value),
            }))}
            value={aspectRatio}
            onChange={setAspectRatio}
          />

          {/* Duration (video only) */}
          {outputType === 'video' && (
            <SettingChips
              label="Duration"
              options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
              value={duration}
              onChange={setDuration}
            />
          )}

          {/* Prompt refinement notice */}
          {skipRefinement && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl mt-1"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI prompt refinement is off. Your scene description will be sent to the model as-is.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Generate button */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={btnDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: btnDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      btnDisabled ? 'var(--text-muted)'  : '#000',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!canAfford && !sceneEmpty
              ? 'Not enough credits'
              : `Generate${creditCost ? ` · ${creditCost} cr` : ''}`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                Top up
              </button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
