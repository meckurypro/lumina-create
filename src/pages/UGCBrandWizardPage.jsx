// src/pages/UGCBrandWizardPage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Check, X,
  Building2, Camera, Upload, AlertCircle,
  Plus, Loader2,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { ugcBrandProfiles, BRAND_CREDIT_COST,
  INDUSTRY_OPTIONS, BRAND_TONE_OPTIONS, CONTENT_STYLE_OPTIONS,
  PRICE_TIER_OPTIONS, AGE_RANGE_OPTIONS, GENDER_AUDIENCE_OPTIONS,
  PLATFORM_OPTIONS, OFFERING_TYPE_OPTIONS, VISUAL_STYLE_OPTIONS,
} from '@/lib/ugcBrands'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const STEPS = [
  { id: 1, label: 'Identity'   },
  { id: 2, label: 'Audience'   },
  { id: 3, label: 'Offerings'  },
  { id: 4, label: 'Voice'      },
  { id: 5, label: 'Visuals'    },
]

// ── Form primitives (same pattern as character wizard) ────────

const Label = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>
    {children}
  </p>
)

const Input = ({ label, ...props }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <input
      className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border:     '1px solid var(--border-color)',
        color:      'var(--text-primary)',
      }}
      {...props}
    />
  </div>
)

const TextArea = ({ label, ...props }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <textarea
      className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-none transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border:     '1px solid var(--border-color)',
        color:      'var(--text-primary)',
        lineHeight: 1.6,
      }}
      rows={3}
      {...props}
    />
  </div>
)

const Select = ({ label, options, value, onChange }) => (
  <div className="mb-5">
    {label && <Label>{label}</Label>}
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-3 rounded-xl text-sm outline-none appearance-none transition-all"
      style={{
        background: 'var(--bg-elevated)',
        border:     '1px solid var(--border-color)',
        color:      value ? 'var(--text-primary)' : 'var(--text-muted)',
      }}
    >
      <option value="">Select…</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  </div>
)

const Chips = ({ label, options, value = [], onChange, max }) => (
  <div className="mb-5">
    {label && <Label>{label}{max ? ` (up to ${max})` : ''}</Label>}
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = value.includes(opt.value)
        const disabled = !selected && max && value.length >= max
        return (
          <button
            key={opt.value}
            onClick={() => {
              if (disabled) return
              onChange(selected ? value.filter((v) => v !== opt.value) : [...value, opt.value])
            }}
            className="px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
            style={{
              background: selected ? ACCENT              : 'var(--bg-elevated)',
              color:      selected ? '#ffffff'           : 'var(--text-secondary)',
              opacity:    disabled ? 0.35               : 1,
              border:     selected ? `1px solid ${ACCENT_BDR}` : '1px solid var(--border-color)',
            }}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  </div>
)

// ── Offering list input ───────────────────────────────────────
const OfferingList = ({ value = [], onChange }) => {
  const [input, setInput] = useState('')

  const add = () => {
    const clean = input.trim()
    if (!clean || value.length >= 10 || value.includes(clean)) return
    onChange([...value, clean])
    setInput('')
  }

  return (
    <div className="mb-5">
      <Label>Products / Services (up to 10)</Label>
      <div className="flex gap-2 mb-3">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
          placeholder="e.g. Moisturising face cream"
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none"
          style={{
            background: 'var(--bg-elevated)',
            border:     '1px solid var(--border-color)',
            color:      'var(--text-primary)',
          }}
        />
        <button
          onClick={add}
          disabled={!input.trim() || value.length >= 10}
          className="px-4 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.97]"
          style={{ background: ACCENT, color: '#fff', opacity: (!input.trim() || value.length >= 10) ? 0.4 : 1 }}
        >
          <Plus size={15} />
        </button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-col gap-2">
          {value.map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between px-3 py-2 rounded-xl text-sm"
              style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{item}</span>
              <button onClick={() => onChange(value.filter((_, idx) => idx !== i))} style={{ color: 'var(--text-muted)' }}>
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Logo upload slot ──────────────────────────────────────────
const LogoSlot = ({ value, onChange, onRemove, uploading }) => (
  <div className="mb-5">
    <Label>Brand Logo</Label>
    {value?.url ? (
      <div className="relative inline-block">
        <div
          className="w-32 h-32 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)', border: `2px solid ${ACCENT_BDR}` }}
        >
          <img src={value.url} alt="logo" className="w-full h-full object-contain p-2" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center rounded-2xl" style={{ background: 'rgba(0,0,0,0.5)' }}>
              <Loader2 size={20} className="animate-spin" style={{ color: '#fff' }} />
            </div>
          )}
        </div>
        {!uploading && (
          <button
            onClick={onRemove}
            className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            <X size={11} />
          </button>
        )}
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center w-32 h-32 rounded-2xl cursor-pointer transition-all"
        style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
      >
        <input type="file" accept="image/*" className="hidden" onChange={(e) => onChange(e.target.files?.[0])} />
        <Upload size={22} style={{ color: ACCENT }} />
        <span className="text-xs font-medium mt-2" style={{ color: ACCENT }}>Upload Logo</span>
        <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>PNG, SVG, JPG</span>
      </label>
    )}
  </div>
)

// ── Color pair input ──────────────────────────────────────────
const ColorPalette = ({ value = [], onChange }) => {
  const presets = ['#000000', '#ffffff', '#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6']

  const toggle = (color) => {
    if (value.includes(color)) {
      onChange(value.filter((c) => c !== color))
    } else if (value.length < 4) {
      onChange([...value, color])
    }
  }

  return (
    <div className="mb-5">
      <Label>Brand Colors (up to 4)</Label>
      <div className="flex flex-wrap gap-2">
        {presets.map((color) => {
          const selected = value.includes(color)
          return (
            <button
              key={color}
              onClick={() => toggle(color)}
              className="w-9 h-9 rounded-xl transition-all"
              style={{
                background:  color,
                border:      selected ? `2px solid ${ACCENT}` : '2px solid var(--border-color)',
                transform:   selected ? 'scale(1.15)' : 'scale(1)',
                boxShadow:   selected ? `0 0 0 2px ${ACCENT_BDR}` : 'none',
              }}
            />
          )
        })}
        {/* Custom color input */}
        <label
          className="w-9 h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all overflow-hidden"
          style={{ border: '2px dashed var(--border-color)', background: 'var(--bg-elevated)' }}
          title="Custom color"
        >
          <input
            type="color"
            className="opacity-0 absolute w-0 h-0"
            onChange={(e) => {
              if (value.length < 4 && !value.includes(e.target.value)) {
                onChange([...value, e.target.value])
              }
            }}
          />
          <Plus size={14} style={{ color: 'var(--text-muted)' }} />
        </label>
      </div>
      {value.length > 0 && (
        <div className="flex gap-2 mt-2">
          {value.map((c) => (
            <div
              key={c}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-mono"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', color: 'var(--text-muted)' }}
            >
              <div className="w-3 h-3 rounded-sm" style={{ background: c }} />
              {c}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Step validation ───────────────────────────────────────────
const stepIsValid = (step, form) => {
  switch (step) {
    case 1: return form.brand_name?.trim() && form.tagline?.trim() && form.industry && form.country?.trim()
    case 2: return form.target_age_ranges?.length > 0 && form.target_genders?.length > 0 && form.target_interests?.trim()
    case 3: return form.offering_type && form.offerings?.length > 0 && form.price_tier
    case 4: return form.brand_tones?.length > 0 && form.content_styles?.length > 0
    case 5: return form.platforms?.length > 0
    default: return false
  }
}

// ── Main wizard ───────────────────────────────────────────────
export default function UGCBrandWizardPage() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const { user, credits, refreshProfile } = useAuth()

  const resumeId = location.state?.resumeBrandId || null
  const editId   = location.state?.editBrandId   || null
  const loadId   = resumeId || editId
  const isEdit   = !!editId

  const [step,         setStep]         = useState(1)
  const [brandId,      setBrandId]      = useState(loadId)
  const [saving,       setSaving]       = useState(false)
  const [uploadingLogo, setUploadingLogo] = useState(false)

  const [form, setForm] = useState({
    brand_name:         '',
    tagline:            '',
    industry:           '',
    country:            '',
    website:            '',
    // Step 2
    target_age_ranges:  [],
    target_genders:     [],
    target_interests:   '',
    target_markets:     '',
    // Step 3
    offering_type:      '',
    offerings:          [],
    price_tier:         '',
    // Step 4
    brand_tones:        [],
    content_styles:     [],
    competitor_brands:  '',
    brand_bio:          '',
    // Step 5
    platforms:          [],
    visual_styles:      [],
    brand_colors:       [],
    logo_url:           null,
  })

  // Load if resuming or editing
  useEffect(() => {
    if (!loadId) return
    const load = async () => {
      const { data } = await ugcBrandProfiles.getById(loadId)
      if (data) {
        setForm((prev) => ({
          ...prev,
          ...data,
          logo_url: data.logo_url ? { url: data.logo_url } : null,
        }))
      }
    }
    load()
  }, [loadId])

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  const buildPayload = () => ({
    brand_name:        form.brand_name,
    tagline:           form.tagline,
    industry:          form.industry     || null,
    country:           form.country,
    website:           form.website      || null,
    target_age_ranges: form.target_age_ranges,
    target_genders:    form.target_genders,
    target_interests:  form.target_interests,
    target_markets:    form.target_markets || null,
    offering_type:     form.offering_type || null,
    offerings:         form.offerings,
    price_tier:        form.price_tier   || null,
    brand_tones:       form.brand_tones,
    content_styles:    form.content_styles,
    competitor_brands: form.competitor_brands || null,
    brand_bio:         form.brand_bio    || null,
    platforms:         form.platforms,
    visual_styles:     form.visual_styles,
    brand_colors:      form.brand_colors,
    logo_url:          form.logo_url?.url || null,
    // thumbnail for the grid card — use logo
    thumbnail_url:     form.logo_url?.url || null,
  })

  const saveStep = async (nextStep) => {
    setSaving(true)
    try {
      const payload = buildPayload()
      if (!brandId) {
        const { data, error } = await ugcBrandProfiles.create(user.id, payload)
        if (error) throw error
        setBrandId(data.id)
      } else {
        const { error } = await ugcBrandProfiles.update(brandId, payload)
        if (error) throw error
      }
      setStep(nextStep)
    } catch (err) {
      toast.error(err.message || 'Could not save. Try again.')
    } finally {
      setSaving(false)
    }
  }

  const handleLogoUpload = async (file) => {
    if (!file) return
    const previewUrl = URL.createObjectURL(file)
    set('logo_url', { file, url: previewUrl })

    let bid = brandId
    if (!bid) {
      setSaving(true)
      try {
        const { data, error } = await ugcBrandProfiles.create(user.id, { ...buildPayload(), logo_url: null })
        if (error) throw error
        bid = data.id
        setBrandId(bid)
      } catch (err) {
        toast.error('Could not initialise brand')
        setSaving(false)
        return
      } finally {
        setSaving(false)
      }
    }

    setUploadingLogo(true)
    try {
      const publicUrl = await ugcBrandProfiles.uploadLogo(user.id, bid, file)
      set('logo_url', { file, url: publicUrl })
      await ugcBrandProfiles.update(bid, { logo_url: publicUrl, thumbnail_url: publicUrl })
    } catch (err) {
      toast.error(err.message || 'Logo upload failed')
      set('logo_url', null)
    } finally {
      setUploadingLogo(false)
    }
  }

  const handleLogoRemove = async () => {
    set('logo_url', null)
    if (brandId) {
      await ugcBrandProfiles.update(brandId, { logo_url: null, thumbnail_url: null })
      await ugcBrandProfiles.deleteLogo(user.id, brandId)
    }
  }

  const handleFinish = async () => {
    setSaving(true)
    try {
      const payload = buildPayload()

      if (isEdit) {
        const { error } = await ugcBrandProfiles.edit(brandId, payload)
        if (error) throw error
        toast.success('Brand updated!')
        navigate(`/create/ugc/brand/${brandId}`, { replace: true })
        return
      }

      let bid = brandId

      if (!bid) {
        const { data, error } = await ugcBrandProfiles.create(user.id, { ...payload, status: 'active' })
        if (error) throw error
        bid = data.id
      } else {
        const { error } = await ugcBrandProfiles.activate(brandId)
        if (error) throw error
      }

      // ── Deduct 600 credits for brand profile creation ──────
      const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
        p_user_id:       user.id,
        p_amount:        BRAND_CREDIT_COST,
        p_generation_id: null,
        p_description:   'Brand profile — ' + payload.brand_name,
      })
      if (dErr || !deduct?.success) {
        // Non-fatal — brand still created, log the issue
        console.error('[BrandWizard] credit deduction failed:', dErr?.message || deduct?.error)
        toast.error('Credits could not be deducted. Contact support.', { duration: 5000 })
      } else {
        refreshProfile()
      }

      toast.success('Brand created! Ready to generate.')
      navigate(`/create/ugc/brand/${bid}`, { replace: true })

    } catch (err) {
      toast.error(err.message || 'Could not finish setup')
    } finally {
      setSaving(false)
    }
  }

  const valid = stepIsValid(step, form)

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => step === 1 ? navigate(-1) : setStep(step - 1)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {isEdit ? 'Edit Brand' : resumeId ? 'Complete Brand' : 'New Brand'}
          </h1>
          <span className="text-xs" style={{ color: ACCENT }}>Step {step} of {STEPS.length}</span>
        </div>
        <div className="w-10" />
      </div>

      {/* Progress bar */}
      <div className="flex-shrink-0 flex gap-1 px-4 py-3">
        {STEPS.map((s) => (
          <div
            key={s.id}
            className="flex-1 h-1 rounded-full transition-all duration-300"
            style={{
              background: s.id <= step ? ACCENT : 'var(--bg-elevated)',
              opacity:    s.id < step ? 0.5 : 1,
            }}
          />
        ))}
      </div>

      {/* Step label */}
      <div className="flex-shrink-0 px-4 pb-4">
        <p className="text-lg font-black" style={{ color: 'var(--text-primary)' }}>
          {STEPS[step - 1].label}
        </p>
      </div>

      {/* Scrollable form */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 pb-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0  }}
              exit={{    opacity: 0, x: -20}}
              transition={{ duration: 0.18 }}
            >

              {/* Step 1: Identity */}
              {step === 1 && (
                <>
                  <LogoSlot
                    value={form.logo_url}
                    onChange={handleLogoUpload}
                    onRemove={handleLogoRemove}
                    uploading={uploadingLogo}
                  />
                  <Input
                    label="Brand Name"
                    value={form.brand_name}
                    onChange={(e) => set('brand_name', e.target.value)}
                    placeholder="e.g. Lumina Studios"
                  />
                  <Input
                    label="Tagline / Slogan"
                    value={form.tagline}
                    onChange={(e) => set('tagline', e.target.value)}
                    placeholder="e.g. Create without limits"
                  />
                  <Select
                    label="Industry"
                    options={INDUSTRY_OPTIONS}
                    value={form.industry}
                    onChange={(v) => set('industry', v)}
                  />
                  <Input
                    label="Country / Primary Market"
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                    placeholder="e.g. Nigeria"
                  />
                  <Input
                    label="Website (optional)"
                    value={form.website}
                    onChange={(e) => set('website', e.target.value)}
                    placeholder="https://yourbrand.com"
                  />
                </>
              )}

              {/* Step 2: Audience */}
              {step === 2 && (
                <>
                  <Chips
                    label="Target Age Ranges"
                    options={AGE_RANGE_OPTIONS}
                    value={form.target_age_ranges}
                    onChange={(v) => set('target_age_ranges', v)}
                  />
                  <Chips
                    label="Target Gender"
                    options={GENDER_AUDIENCE_OPTIONS}
                    value={form.target_genders}
                    onChange={(v) => set('target_genders', v)}
                  />
                  <TextArea
                    label="Target Interests & Lifestyle"
                    value={form.target_interests}
                    onChange={(e) => set('target_interests', e.target.value)}
                    placeholder="What does your audience care about? What are their habits, values, aspirations?"
                    rows={4}
                  />
                  <Input
                    label="Other Target Markets (optional)"
                    value={form.target_markets}
                    onChange={(e) => set('target_markets', e.target.value)}
                    placeholder="e.g. UK, US, South Africa"
                  />
                </>
              )}

              {/* Step 3: Offerings */}
              {step === 3 && (
                <>
                  <Chips
                    label="Offering Type"
                    options={OFFERING_TYPE_OPTIONS}
                    value={form.offering_type ? [form.offering_type] : []}
                    onChange={(v) => set('offering_type', v[v.length - 1] || '')}
                    max={1}
                  />
                  <OfferingList
                    value={form.offerings}
                    onChange={(v) => set('offerings', v)}
                  />
                  <Chips
                    label="Price Tier"
                    options={PRICE_TIER_OPTIONS}
                    value={form.price_tier ? [form.price_tier] : []}
                    onChange={(v) => set('price_tier', v[v.length - 1] || '')}
                    max={1}
                  />
                </>
              )}

              {/* Step 4: Voice & Tone */}
              {step === 4 && (
                <>
                  <Chips
                    label="Brand Personality"
                    options={BRAND_TONE_OPTIONS}
                    value={form.brand_tones}
                    onChange={(v) => set('brand_tones', v)}
                    max={4}
                  />
                  <Chips
                    label="Content Style"
                    options={CONTENT_STYLE_OPTIONS}
                    value={form.content_styles}
                    onChange={(v) => set('content_styles', v)}
                    max={3}
                  />
                  <TextArea
                    label="Brand Bio / Story (optional)"
                    value={form.brand_bio}
                    onChange={(e) => set('brand_bio', e.target.value)}
                    placeholder="What's the brand's story? What problem does it solve? What makes it different?"
                    rows={4}
                  />
                  <Input
                    label="Competitor / Inspiration Brands (optional)"
                    value={form.competitor_brands}
                    onChange={(e) => set('competitor_brands', e.target.value)}
                    placeholder="e.g. Apple, Fenty Beauty, Zara"
                  />
                </>
              )}

              {/* Step 5: Visuals */}
              {step === 5 && (
                <>
                  <div
                    className="flex items-start gap-3 p-3 rounded-xl mb-5"
                    style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                  >
                    <AlertCircle size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      These visual preferences guide the AI when generating content for your brand.
                      The more specific you are, the more on-brand your outputs will be.
                    </p>
                  </div>

                  <Chips
                    label="Platforms"
                    options={PLATFORM_OPTIONS}
                    value={form.platforms}
                    onChange={(v) => set('platforms', v)}
                  />
                  <Chips
                    label="Visual Style"
                    options={VISUAL_STYLE_OPTIONS}
                    value={form.visual_styles}
                    onChange={(v) => set('visual_styles', v)}
                    max={3}
                  />
                  <ColorPalette
                    value={form.brand_colors}
                    onChange={(v) => set('brand_colors', v)}
                  />

                  {/* Logo (if not uploaded in step 1) */}
                  {!form.logo_url?.url && (
                    <LogoSlot
                      value={form.logo_url}
                      onChange={handleLogoUpload}
                      onRemove={handleLogoRemove}
                      uploading={uploadingLogo}
                    />
                  )}

                  {/* Credit cost notice */}
                  {!isEdit && (
                    <div
                      className="flex items-start gap-3 p-3 rounded-xl mt-2"
                      style={{ background: 'var(--bg-card)', border: `1px solid ${ACCENT_BDR}` }}
                    >
                      <Building2 size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        Creating a brand profile costs{' '}
                        <strong style={{ color: ACCENT }}>{BRAND_CREDIT_COST} credits</strong>
                        . You currently have{' '}
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {Math.floor(credits || 0)} credits
                        </strong>
                        .
                      </p>
                    </div>
                  )}
                </>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="flex-shrink-0 px-4 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={step === STEPS.length ? handleFinish : () => saveStep(step + 1)}
            disabled={!valid || saving || uploadingLogo}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: (!valid || saving) ? 'var(--bg-elevated)' : ACCENT,
              color:      (!valid || saving) ? 'var(--text-muted)'  : '#ffffff',
            }}
          >
            {saving ? (
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}
                className="w-4 h-4 rounded-full border-2"
                style={{ borderColor: 'rgba(255,255,255,0.3)', borderTopColor: '#ffffff' }}
              />
            ) : step === STEPS.length ? (
              isEdit
                ? <><Check size={15} /> Save Changes</>
                : <><Check size={15} /> Create Brand · {BRAND_CREDIT_COST} cr</>
            ) : (
              <>Continue <ArrowRight size={15} /></>
            )}
          </button>
        </div>
      </div>

    </div>
  )
}
