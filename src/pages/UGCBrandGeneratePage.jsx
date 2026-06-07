// src/pages/UGCBrandGeneratePage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, Building2, Images,
  ImageIcon, VideoIcon, ChevronDown, Info,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcBrandProfiles, ugcBrandGenerations } from '@/lib/ugcBrands'
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

// ── Setting chips ──────────────────────────────────────────────
const SettingChips = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      {label}
    </p>
    <div className="flex gap-2 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          className="px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150"
          style={{
            background: value === opt.value ? ACCENT            : 'var(--bg-elevated)',
            color:      value === opt.value ? '#ffffff'         : 'var(--text-secondary)',
            opacity:    opt.disabled ? 0.3 : 1,
            cursor:     opt.disabled ? 'not-allowed' : 'pointer',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  </div>
)

// ── Model dropdown ─────────────────────────────────────────────
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
        <ChevronDown
          size={10}
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
        />
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
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {m.aka || m.label}
                      </p>
                      {m.description && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{m.description}</p>
                      )}
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
                        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
                          {m.label}
                        </p>
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

// ── Brand context pill ────────────────────────────────────────
const BrandContextPill = ({ brand }) => (
  <div
    className="flex items-center gap-2 px-3 py-2 rounded-xl mb-5"
    style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
  >
    {brand?.logo_url ? (
      <img src={brand.logo_url} alt={brand.brand_name} className="w-6 h-6 rounded-lg object-contain flex-shrink-0" />
    ) : (
      <Building2 size={14} style={{ color: ACCENT, flexShrink: 0 }} />
    )}
    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold truncate" style={{ color: ACCENT }}>{brand?.brand_name}</p>
      <p className="text-xs truncate" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
        {brand?.tagline}
      </p>
    </div>
    <div className="flex items-center gap-1 flex-shrink-0">
      <span className="text-xs px-2 py-0.5 rounded-lg font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: '10px' }}>
        AI Brand Adviser
      </span>
    </div>
  </div>
)

// ── Main page ──────────────────────────────────────────────────
export default function UGCBrandGeneratePage() {
  const { brandId }                                              = useParams()
  const navigate                                                 = useNavigate()
  const { user, profile: userProfile, credits, refreshProfile } = useAuth()

  const isMaster = userProfile?.user_tier === 'master'
  const skipRefinement = !(userProfile?.ai_prompt_refinement ?? true)

  const [brand,         setBrand]         = useState(null)
  const [brandLoading,  setBrandLoading]  = useState(true)
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model,         setModel]         = useState('')

  const [outputType,  setOutputType]  = useState('image')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [duration,    setDuration]    = useState('5')
  const [prompt,      setPrompt]      = useState('')
  const [withSound,   setWithSound]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)

  useEffect(() => { loadBrand(); loadModels() }, [brandId])

  const loadBrand = async () => {
    setBrandLoading(true)
    const { data, error } = await ugcBrandProfiles.getById(brandId)
    if (error || !data) {
      toast.error('Brand not found')
      navigate('/create/ugc')
      return
    }
    setBrand(data)
    setBrandLoading(false)
  }

  const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('is_active', true)
      .eq('is_user_facing', true)
      .order('sort_order')
    const list = (data || [])
    setModels(list)
    const first = list.find((m) => !m.is_locked && m.type === 'image')
    setModel(first?.value || '')
    setModelsLoading(false)
  }, [])

  const filteredModels = models.filter((m) => m.type === outputType)
  const selectedModel  = filteredModels.find((m) => m.value === model) || filteredModels[0]

  useEffect(() => {
    const first = filteredModels.find((m) => !m.is_locked)
    if (first) setModel(first.value)
  }, [outputType])

  const caps = selectedModel ? {
    supportedDurations:    selectedModel.supported_durations     ?? ['5', '8', '10'],
    supportedAspectRatios: selectedModel.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
    isFlatRate:            selectedModel.is_flat_rate            ?? false,
  } : {
    supportedDurations:    ['5'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
    isFlatRate:            false,
  }

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
  const promptEmpty = !prompt.trim()
  const btnDisabled = promptEmpty || !canAfford || submitting || !selectedModel || brandLoading

  // ── Build brand context string for the edge function ─────────
  const buildBrandContext = () => {
    if (!brand) return ''
    const parts = [
      `Brand: ${brand.brand_name}`,
      brand.tagline   ? `Tagline: ${brand.tagline}` : null,
      brand.industry  ? `Industry: ${brand.industry}` : null,
      brand.country   ? `Market: ${brand.country}` : null,
      brand.brand_tones?.length   ? `Brand personality: ${brand.brand_tones.join(', ')}` : null,
      brand.content_styles?.length ? `Content style: ${brand.content_styles.join(', ')}` : null,
      brand.visual_styles?.length  ? `Visual aesthetic: ${brand.visual_styles.join(', ')}` : null,
      brand.brand_colors?.length   ? `Brand colors: ${brand.brand_colors.join(', ')}` : null,
      brand.price_tier  ? `Price tier: ${brand.price_tier}` : null,
      brand.target_interests ? `Target audience interests: ${brand.target_interests}` : null,
      brand.offerings?.length ? `Products/services: ${brand.offerings.slice(0, 5).join(', ')}` : null,
      brand.competitor_brands ? `Brand inspirations: ${brand.competitor_brands}` : null,
    ].filter(Boolean)
    return parts.join(' | ')
  }

  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Describe the content you want')
    if (!selectedModel) return toast.error('Pick a model')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      const brandContext = buildBrandContext()

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        outputType === 'image' ? 'text_to_image' : 'text_to_video',
        status:                 'pending',
        prompt:                 prompt,
        model:                  selectedModel.value,
        aspect_ratio:           aspectRatio,
        duration:               outputType === 'video' ? duration : undefined,
        credits_charged:        creditCost,
        output_type:            outputType,
        skip_prompt_refinement: skipRefinement,
        // Pass brand context so the edge function's AI adviser can use it
        generation_metadata:    {
          brand_id:      brandId,
          brand_context: brandContext,
          with_sound:    outputType === 'video' ? withSound : false,
          mode:          'brand_adviser',
        },
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // Log to brand generations table
      await ugcBrandGenerations.create({
        generation_id:  genRow.id,
        ugc_brand_id:   brandId,
        user_id:        user.id,
        output_type:    outputType,
        scene_prompt:   prompt,
        aspect_ratio:   aspectRatio,
        with_sound:     outputType === 'video' ? withSound : false,
      })

      // Fire the appropriate edge function
      // brand-generate handles AI brand adviser prompt engineering
      const fn = outputType === 'image' ? 'brand-generate' : 'brand-generate'
      supabase.functions.invoke(fn, { body: { generationId: genRow.id } })
        .catch((e) => console.error(`${fn} invoke error`, e))

      refreshProfile()
      toast.success(
        <span>
          Generating! View in{' '}
          <button
            className="font-bold underline"
            onClick={() => navigate(`/create/ugc/brand/${brandId}/media`)}
          >
            {brand?.brand_name} Media
          </button>
        </span>,
        { duration: 5000 }
      )
      setPrompt('')

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  if (brandLoading) {
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
            style={{
              backdropFilter:       'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              background:           'rgba(0,0,0,0.4)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
              Brand adviser crafting your content…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate('/create/ugc')}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>

        <button onClick={() => navigate('/create/ugc')} className="flex items-center gap-2.5">
          {brand?.logo_url ? (
            <img
              src={brand.logo_url}
              alt={brand.brand_name}
              className="w-8 h-8 rounded-full object-contain flex-shrink-0"
              style={{ border: `2px solid ${ACCENT_BDR}`, padding: 2, background: 'var(--bg-elevated)' }}
            />
          ) : (
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: ACCENT_SUB, border: `2px solid ${ACCENT_BDR}` }}
            >
              <Building2 size={14} style={{ color: ACCENT }} />
            </div>
          )}
          <div className="flex flex-col items-start">
            <p className="text-sm font-semibold leading-none" style={{ color: 'var(--text-primary)' }}>
              {brand?.brand_name}
            </p>
            <p className="text-xs mt-0.5" style={{ color: ACCENT }}>Brand Studio</p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(`/create/ugc/brand/${brandId}/media`)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <Images size={13} />
            <span>Media</span>
          </button>

          {!modelsLoading && (
            <ModelDropdown
              models={filteredModels}
              value={selectedModel?.value || ''}
              onChange={setModel}
            />
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

          {/* Brand context pill */}
          <BrandContextPill brand={brand} />

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
                  background: outputType === value ? 'var(--bg-card)'      : 'transparent',
                  color:      outputType === value ? 'var(--text-primary)'  : 'var(--text-muted)',
                  boxShadow:  outputType === value ? 'var(--shadow)'        : 'none',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {/* Prompt */}
          <div className="mb-5">
            <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Content Direction
            </p>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder={`Describe what you want the AI to create for ${brand?.brand_name}. The brand adviser will handle the rest — styling, lighting, composition, all on-brand.`}
              rows={5}
              maxLength={600}
              className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border:     '1px solid var(--border-color)',
                color:      'var(--text-primary)',
                lineHeight: 1.6,
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--text-muted)' }}>
              {prompt.length}/600
            </p>
          </div>

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
            <>
              <SettingChips
                label="Duration"
                options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
                value={duration}
                onChange={setDuration}
              />
              {/* Sound toggle */}
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Sound
                </p>
                <div className="flex gap-2">
                  {[
                    { value: false, label: '🔇 No Sound' },
                    { value: true,  label: '🔊 With Sound' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => setWithSound(opt.value)}
                      className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all"
                      style={{
                        background: withSound === opt.value ? ACCENT : 'var(--bg-elevated)',
                        color:      withSound === opt.value ? '#fff' : 'var(--text-secondary)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Adviser info */}
          <div
            className="flex items-start gap-2 p-3 rounded-xl mt-1"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
          >
            <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0, marginTop: 1 }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              The AI brand adviser will combine your brand's personality, color palette, target audience,
              and content style to craft a hyper-photorealistic, premium output — no AI fluff.
            </p>
          </div>

          {skipRefinement && (
            <div
              className="flex items-center gap-2 p-3 rounded-xl mt-2"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI prompt refinement is off. Your direction will be sent to the model as-is.
              </p>
            </div>
          )}

        </div>
      </div>

      {/* Generate button */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4"
        style={{ borderTop: `1px solid ${ACCENT_BDR}` }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">
          <button
            onClick={handleGenerate}
            disabled={btnDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: btnDisabled ? 'var(--bg-elevated)' : ACCENT,
              color:      btnDisabled ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!canAfford && !promptEmpty
              ? 'Not enough credits'
              : `Generate${creditCost ? ` · ${creditCost} cr` : ''}`}
          </button>

          {!canAfford && (
            <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button
                onClick={() => navigate('/profile')}
                className="font-semibold"
                style={{ color: ACCENT }}
              >
                Top up
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
