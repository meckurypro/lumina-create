// src/pages/UGCBrandGeneratePage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, Building2,
  ImageIcon, VideoIcon, Info,
  X, Plus, Maximize2, Crown, Package,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowEligibility } from '@/hooks/useRenderWindowEligibility'
import { ugcBrandProfiles, ugcBrandGenerations, ugcBrandProducts, MAX_BRAND_PRODUCTS } from '@/lib/ugcBrands'
import { supabase, generations as generationsDb } from '@/lib/supabase'
import { getActiveRenderWindowModelIds } from '@/lib/renderWindowModels'
import BrandProductManager from '@/components/BrandProductManager'
import toast from 'react-hot-toast'
import { compressImage, tagForSlot } from '@/lib/mediaUtils'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { applyModelPreferences } from '@/hooks/useModelPreferences'
import { watchForEarlyFailure } from '@/lib/generationWatch'
import {
  calculateModelCostUsd, fetchGlobalPricingSettings, fetchToolMargin,
} from '@/lib/pricing'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

// NOTE: no existing draft-key or snake_case identity string elsewhere in
// this file to anchor on — confirm this matches the tool_margins row for
// this page before shipping, or pricing will silently come back unpriced.
const TOOL_KEY = 'ugc_brand'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ── Helpers (page-specific — not duplicated elsewhere) ──────────────────────
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Detects a live "/query" being typed right before the cursor.
// Triggers after whitespace, string-start, OR any non-word character
// (so "(/shoes", "\"/shoes", etc. all work — not just "/shoes" after a space).
function getSlashMatch(text, cursorPos) {
  const upto = text.slice(0, cursorPos)
  const m = /(^|[^\w])\/([a-zA-Z0-9 _-]{0,40})$/.exec(upto)
  if (!m) return null
  return { query: m[2].trim().toLowerCase(), start: m.index + m[1].length }
}
// ── Multi-image grid ───────────────────────────────────────────
const MultiImageGrid = ({ images, maxImages, onAdd, onRemove, onTagInsert, onFullscreen }) => {
  const filledCount  = images.filter(Boolean).length
  const visibleSlots = filledCount < maxImages ? filledCount + 1 : filledCount
  const slots        = Array.from({ length: visibleSlots }, (_, i) => images[i] || null)

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        Reference up to {maxImages} images. Insert{' '}
        {Array.from({ length: Math.min(maxImages, 4) }, (_, i) => (
          <span key={i}>
            <button
              onClick={() => onTagInsert(tagForSlot(i))}
              className="px-1.5 py-0.5 rounded-md text-xs font-mono font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              {tagForSlot(i)}
            </button>
            {i < Math.min(maxImages, 4) - 1 ? ' ' : ''}
          </span>
        ))}{' '}
        tags into your prompt to describe how each image is used.
      </p>

      <div className="flex flex-wrap gap-3">
        {slots.map((img, idx) => {
          const isNextSlot = idx === filledCount
          return (
            <div key={idx} style={{ width: 'calc(25% - 9px)', minWidth: 64 }} className="flex flex-col gap-1.5">
              {img ? (
                <div className="relative group">
                  <div
                    className="relative overflow-hidden rounded-xl cursor-pointer"
                    style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
                    onClick={() => onFullscreen(idx)}
                  >
                    <img src={img.url} alt={`ref ${idx + 1}`} className="w-full h-full" style={{ objectFit: 'cover' }} />
                    <div
                      className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ background: 'rgba(0,0,0,0.45)' }}
                    >
                      <Maximize2 size={16} color="white" />
                    </div>
                  </div>
                  <button
                    onClick={() => onTagInsert(tagForSlot(idx))}
                    className="w-full py-1 rounded-lg text-xs font-mono font-semibold transition-all"
                    style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
                  >
                    {tagForSlot(idx)}
                  </button>
                  <button
                    onClick={() => onRemove(idx)}
                    className="absolute -top-2 -right-2 w-6 h-6 rounded-full flex items-center justify-center z-10"
                    style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
                  >
                    <X size={11} />
                  </button>
                </div>
              ) : isNextSlot ? (
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => onAdd(e, idx)}
                  />
                  <div
                    className="flex flex-col items-center justify-center rounded-xl transition-all"
                    style={{ aspectRatio: '1/1', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
                  >
                    <Plus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
                    <span className="text-xs font-medium" style={{ color: ACCENT }}>img{idx + 1}</span>
                  </div>
                  <div
                    className="w-full mt-1.5 py-1 rounded-lg text-xs font-mono font-semibold text-center"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: 0.4 }}
                  >
                    {tagForSlot(idx)}
                  </div>
                </label>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────
export default function UGCBrandGeneratePage() {
  const { brandId }                                              = useParams()
  const navigate                                                 = useNavigate()
 const { user, profile: userProfile, credits, refreshProfile } = useAuth()
const { eligible: canUseRWModels } = useRenderWindowEligibility()
  const isMaster     = userProfile?.user_tier === 'master'
  const textareaRef  = useRef(null)

  const skipRefinement = !(userProfile?.ai_prompt_refinement ?? true)

  const [brand,         setBrand]         = useState(null)
  const [brandLoading,  setBrandLoading]  = useState(true)
  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [model,         setModel]         = useState('')

  const [products,      setProducts]      = useState([])

  const [outputType,    setOutputType]    = useState('image') // 'image' | 'video' | 'products'
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [duration,      setDuration]      = useState('5')
  const [prompt,        setPrompt]        = useState('')
  const [filter,        setFilter]        = useState('hyper_realistic')
  const [withSound,     setWithSound]     = useState(true)
  const [submitting,    setSubmitting]    = useState(false)

  const [images,        setImages]        = useState([])
  const [fullscreenIdx, setFullscreenIdx] = useState(null)

  // Slash-command picker state
  const [slashOpen,      setSlashOpen]      = useState(false)
  const [slashQuery,     setSlashQuery]     = useState('')
  const [slashStart,     setSlashStart]     = useState(null)
  const [slashActiveIdx, setSlashActiveIdx] = useState(0)

  // Explicitly tagged products/services — tracked by id (not re-derived
  // from prompt text) so renames, retyping, or overlapping names never
  // break the link between a visible chip and its underlying item.
  const [taggedItems, setTaggedItems] = useState([])

  // ── pricing engine state ──────────────────────────────────────────────
  const [globalSettings, setGlobalSettings] = useState(null)
  const [toolMargin,     setToolMargin]     = useState(null)

  useEffect(() => {
    (async () => {
      const [gs, margin] = await Promise.all([
        fetchGlobalPricingSettings(),
        fetchToolMargin(TOOL_KEY),
      ])
      setGlobalSettings(gs)
      setToolMargin(margin)
    })()
  }, [])

  useEffect(() => { loadBrand(); loadModels(); loadProducts() }, [brandId, userProfile?.user_tier])

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

  const loadProducts = async () => {
    const { data } = await ugcBrandProducts.getAll(brandId)
    setProducts(data || [])
  }

const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const [{ data }, activeRWModelIds] = await Promise.all([
      supabase
        .from('models')
        .select('*')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .eq('supports_multi_image', true)
        .order('sort_order'),
      canUseRWModels ? getActiveRenderWindowModelIds() : Promise.resolve(new Set()),
    ])
    const tierFiltered = (data || [])
      .filter((m) => isMaster || m.tier_required !== 'master')
      // Render-window (ComfyUI) models only show with an active subscription
      // AND a currently-open window AND being attached to that live window.
      .filter((m) => m.model_access_type !== 'render_window' || (canUseRWModels && activeRWModelIds.has(m.id)))
    const list = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    const first = list.find((m) => !m.is_locked && m.type === 'image')
    setModel(first?.value || '')
    setModelsLoading(false)
  }, [isMaster, user?.id, canUseRWModels])

  const filteredModels = models.filter((m) => m.type === outputType)
  const selectedModel  = filteredModels.find((m) => m.value === model) || filteredModels[0]

  const modelMaxRefImages = selectedModel?.max_ref_images ?? 4

  useEffect(() => {
    const first = filteredModels.find((m) => !m.is_locked)
    if (first) setModel(first.value)
  }, [outputType])

// Clear images and tags when output type switches
  useEffect(() => {
    setImages([])
    setTaggedItems([])
    setAutoRatio(false)
    setAspectRatio('9:16')
  }, [outputType])

  const caps = selectedModel ? {
    supportedDurations:    selectedModel.supported_durations     ?? ['5', '8', '10'],
    supportedAspectRatios: selectedModel.supported_aspect_ratios ?? ['9:16', '16:9', '1:1'],
  } : {
    supportedDurations:    ['5'],
    supportedAspectRatios: ['9:16', '16:9', '1:1'],
  }

  const hasImages = images.filter(Boolean).length > 0

  // ── Price via the shared pricing engine ──────────────────────────────
  // Real cost scales with duration via the model's cost_usd_* fields,
  // resolved inside calculateModelCostUsd — no separate hand-rolled
  // isFlatRate/duration-multiplier branch, and no i2i-vs-t2i split (the
  // engine prices off the model's real $ cost, not the credit tier).
  // Products tab has no model selection, so pricing simply doesn't apply there.
  const priced = (() => {
    if (outputType === 'products') return null
    if (!selectedModel || !globalSettings || !toolMargin) return null
    const costUsd = calculateModelCostUsd({
      model:      selectedModel,
      resolution: undefined,
      duration:   outputType === 'video' ? parseInt(duration, 10) : undefined,
    })
    if (costUsd == null) return null

    const priceUsd = costUsd * toolMargin
    const credits  = Math.ceil(priceUsd / globalSettings.usdPerCredit)
    return { costUsd, priceUsd, credits }
  })()

  const isPriced   = outputType === 'products' ? true : priced !== null
  const creditCost = priced?.credits ?? 0

  const canAfford   = credits >= creditCost
  const promptEmpty = !prompt.trim()
  const btnDisabled = promptEmpty || !canAfford || submitting || !selectedModel || brandLoading || !isPriced

  // ── Image handlers ─────────────────────────────────────────────
  const handleAddImage = async (e, slotIdx) => {
    const file = e.target.files?.[0]
    if (!file) return
    const compressed = await compressImage(file)
    setImages((prev) => {
      const next = [...prev]
      next[slotIdx] = compressed
      const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
      if (slotIdx === 0) { setAspectRatio(compressed.ar); setAutoRatio(true) }
      return trimmed
    })
  }

  const handleRemoveImage = (idx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      if (idx === 0 && next.length === 0) { setAutoRatio(false); setAspectRatio('9:16') }
      return next
    })
  }

const clearAllImages = () => {
    setImages([])
    setTaggedItems([])
    setAutoRatio(false)
    setAspectRatio('9:16')
  }

  // ── Tag insertion (manual ref [img1] buttons) ───────────────────
  const handleTagInsert = (tag) => {
    const el = textareaRef.current
    if (!el) { setPrompt((p) => p ? `${p} ${tag}` : tag); return }
    const start      = el.selectionStart
    const end        = el.selectionEnd
    const before     = prompt.slice(0, start)
    const after      = prompt.slice(end)
    const needsSpace = before.length > 0 && !before.endsWith(' ')
    const inserted   = `${needsSpace ? ' ' : ''}${tag} `
    const next       = before + inserted + after
    setPrompt(next)
    requestAnimationFrame(() => {
      el.focus()
      const cursor = start + inserted.length
      el.setSelectionRange(cursor, cursor)
    })
  }

  // ── Slash-command product picker ────────────────────────────────
  const slashResults = products
    .filter((p) => p.name.toLowerCase().includes(slashQuery))
    .slice(0, 6)

  const handlePromptChange = (e) => {
    const val    = e.target.value
    const cursor = e.target.selectionStart
    setPrompt(val)

    const match = getSlashMatch(val, cursor)
    if (match && products.length > 0) {
      setSlashOpen(true)
      setSlashQuery(match.query)
      setSlashStart(match.start)
      setSlashActiveIdx(0)
    } else {
      setSlashOpen(false)
    }
  }

const selectSlashProduct = (product) => {
    const el     = textareaRef.current
    const cursor = el ? el.selectionStart : prompt.length
    const before = prompt.slice(0, slashStart)
    const after  = prompt.slice(cursor)
    const inserted = `/${product.name} `
    const next = before + inserted + after
    setPrompt(next)
    setSlashOpen(false)
    setTaggedItems((prev) => (prev.some((t) => t.id === product.id) ? prev : [...prev, product]))
    requestAnimationFrame(() => {
      el?.focus()
      const pos = before.length + inserted.length
      el?.setSelectionRange(pos, pos)
    })
  }

  // Removing a chip untags the item and strips its first "/Name" occurrence
  // from the prompt text (best-effort — if the user already edited that
  // text manually, only the tag link is removed, not any leftover text).
  const handleRemoveTag = (itemId) => {
    const item = taggedItems.find((t) => t.id === itemId)
    setTaggedItems((prev) => prev.filter((t) => t.id !== itemId))
    if (item) {
      const re = new RegExp(`/${escapeRegex(item.name)}\\s?`)
      setPrompt((prev) => prev.replace(re, ''))
    }
  }

  const handlePromptKeyDown = (e) => {
    if (!slashOpen || slashResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSlashActiveIdx((i) => (i + 1) % slashResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSlashActiveIdx((i) => (i - 1 + slashResults.length) % slashResults.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      selectSlashProduct(slashResults[slashActiveIdx])
    } else if (e.key === 'Escape') {
      setSlashOpen(false)
    }
  }

// Fallback for items the user typed manually (e.g. "/Shoes)") without
  // going through the picker. Explicit picker selections are tracked
  // separately in `taggedItems` and take priority — this only catches
  // typed-but-unpicked mentions.
  const resolveMentionedProducts = (text) => {
    const mentioned = []
    for (const p of products) {
      const re = new RegExp(`/${escapeRegex(p.name)}(?=[^\\w]|$)`)
      if (re.test(text)) mentioned.push(p)
    }
    return mentioned
  }

  // ── Brand context ──────────────────────────────────────────────
  const buildBrandContext = () => {
    if (!brand) return ''
    return [
      `Brand: ${brand.brand_name}`,
      brand.tagline            ? `Tagline: ${brand.tagline}` : null,
      brand.industry           ? `Industry: ${brand.industry}` : null,
      brand.country            ? `Market: ${brand.country}` : null,
      brand.brand_tones?.length    ? `Brand personality: ${brand.brand_tones.join(', ')}` : null,
      brand.content_styles?.length ? `Content style: ${brand.content_styles.join(', ')}` : null,
      brand.visual_styles?.length  ? `Visual aesthetic: ${brand.visual_styles.join(', ')}` : null,
      brand.brand_colors?.length   ? `Brand colors: ${brand.brand_colors.join(', ')}` : null,
      brand.price_tier         ? `Price tier: ${brand.price_tier}` : null,
      brand.target_interests   ? `Target audience interests: ${brand.target_interests}` : null,
      products.length           ? `Products/services: ${products.slice(0, 10).map((p) => p.name).join(', ')}` : null,
      brand.competitor_brands  ? `Brand inspirations: ${brand.competitor_brands}` : null,
    ].filter(Boolean).join(' | ')
  }

  // ── Generate ───────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Describe the content you want')
    if (!selectedModel) return toast.error('Pick a model')
    if (!isPriced)       return toast.error('This model isn\'t priced yet — contact support')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
      const brandContext = buildBrandContext()

      // Build the reference image list in priority order:
      // brand logo → Master-tier manual refs → "/product" mentions
      const inputImageUrls = []

      if (brand?.logo_url) {
        inputImageUrls.push({ url: brand.logo_url, role: 'brand logo' })
      }

      if (isMaster) {
        for (const img of images) {
          if (!img) continue
          let url = img.url
          if (img.file) {
            const contentType = img.file.type || 'image/jpeg'
            const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
            const path = `${user.id}/${crypto.randomUUID()}.${ext}`
            const { data: uploadData, error: upErr } = await supabase.storage
              .from('generation-uploads')
              .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
            if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)
            url = supabase.storage
              .from('generation-uploads')
              .getPublicUrl(uploadData.path).data.publicUrl
          }
          inputImageUrls.push({ url, role: 'reference' })
        }
      }

 // Explicit picker tags take priority (highest confidence), then
      // fill remaining slots with any names typed but not picked.
      const fallbackMentions = resolveMentionedProducts(prompt)
        .filter((p) => !taggedItems.some((t) => t.id === p.id))
      const priorityItems = [...taggedItems, ...fallbackMentions]

      const remainingSlots = Math.max(0, modelMaxRefImages - inputImageUrls.length)
      for (const item of priorityItems.slice(0, remainingSlots)) {
        if (!item.image_url) continue // no photo — AI still sees it by name via the prompt text
        inputImageUrls.push({ url: item.image_url, role: `${item.item_type || 'product'}: ${item.name}` })
      }

     const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:                user.id,
        generation_type:        outputType === 'image' ? 'text_to_image' : 'text_to_video',
        status:                 'pending',
        prompt,
        model:                  selectedModel.value,
        aspect_ratio:           aspectRatio,
        duration:               outputType === 'video' ? duration : undefined,
        credits_charged:        creditCost,
        output_type:            outputType,
        input_image_urls:       inputImageUrls.length ? inputImageUrls : null,
        skip_prompt_refinement: skipRefinement,
        is_system_prompt:       false,
        generation_metadata: {
          brand_id:         brandId,
          brand_context:    brandContext,
          with_sound:       outputType === 'video' ? withSound : false,
          filter_applied:   filter,
          mode:             'brand_adviser',
          // Explicitly-picked items — the edge function trusts these as
          // already-resolved and only runs AI detection for anything else.
          tagged_item_ids:  taggedItems.map((t) => t.id),
        },
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      await ugcBrandGenerations.create({
        generation_id: genRow.id,
        ugc_brand_id:  brandId,
        user_id:       user.id,
        output_type:   outputType,
        scene_prompt:  prompt,
        aspect_ratio:  aspectRatio,
        with_sound:    outputType === 'video' ? withSound : false,
      })

      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('brand-generate', { body: { generationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        const msg = invokeData?.error || invokeErr?.message || 'Generation blocked'
        toast.error(msg)
        await refreshProfile()
        return
      }

      const { failed, message } = await watchForEarlyFailure(genRow.id)
      await refreshProfile()

      if (failed) {
        toast.error(message)
        return
      }

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
      clearAllImages()

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const fullscreenImage = fullscreenIdx !== null ? images[fullscreenIdx] : null

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
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

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
            <p className="text-sm font-semibold" style={{ color: '#ffffff' }}>
              Brand adviser crafting your content…
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fullscreen viewer */}
      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}
          >
            <button
              onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              src={fullscreenImage.url} alt="Reference"
              className="rounded-2xl"
              style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate('/create/ugc', { state: { tab: 'brands' } })}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>

        <button onClick={() => navigate('/create/ugc', { state: { tab: 'brands' } })} className="flex items-center gap-2.5">
          {brand?.logo_url ? (
            <img
              src={brand.logo_url} alt={brand.brand_name}
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
              {brand?.brand_name?.length > 15 ? `${brand.brand_name.slice(0, 15)}…` : brand?.brand_name}
            </p>
          </div>
        </button>

        <div className="flex items-center gap-2">
          {outputType !== 'products' && !modelsLoading && (
            <ModelDropdown
              models={filteredModels}
              value={selectedModel?.value || ''}
              onChange={setModel}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
            />
          )}
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-1">

          {/* Output type toggle */}
          <div className="flex gap-1 p-1 rounded-2xl mb-5" style={{ background: 'var(--bg-elevated)' }}>
            {[
              { value: 'image',    label: 'Image',    Icon: ImageIcon },
              { value: 'video',    label: 'Video',    Icon: VideoIcon },
              { value: 'products', label: 'Products', Icon: Package   },
            ].map(({ value, label, Icon }) => (
              <button
                key={value}
                onClick={() => setOutputType(value)}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: outputType === value ? 'var(--bg-card)'     : 'transparent',
                  color:      outputType === value ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  outputType === value ? 'var(--shadow)'       : 'none',
                }}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>

          {outputType === 'products' ? (
            <BrandProductManager
              brandId={brandId}
              userId={user.id}
              products={products}
              onProductsChange={setProducts}
              maxProducts={MAX_BRAND_PRODUCTS}
            />
          ) : (
            <>
              {/* Reference images — Master only */}
              {isMaster && selectedModel?.supports_multi_image && (
                <div className="mb-5">
                  <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                    Reference Images
                    <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}> — optional</span>
                  </p>
                  <MultiImageGrid
                    images={images}
                    maxImages={modelMaxRefImages}
                    onAdd={handleAddImage}
                    onRemove={handleRemoveImage}
                    onTagInsert={handleTagInsert}
                    onFullscreen={(idx) => setFullscreenIdx(idx)}
                  />
                </div>
              )}

              {/* Prompt */}
              <div className="mb-5">
                <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                  Content Direction
                </p>

                {slashOpen && slashResults.length > 0 && (
                  <div
                    className="mb-2 rounded-xl overflow-hidden"
                    style={{ border: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-card)' }}
                  >
                    {slashResults.map((p, i) => (
                      <button
                        key={p.id}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => selectSlashProduct(p)}
                        className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors"
                        style={{ background: i === slashActiveIdx ? ACCENT_SUB : 'transparent' }}
                      >
                        <img src={p.image_url} alt={p.name} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" />
                        <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {p.name}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                <textarea
                  ref={textareaRef}
                  value={prompt}
                  onChange={handlePromptChange}
                  onKeyDown={handlePromptKeyDown}
                  onBlur={() => setTimeout(() => setSlashOpen(false), 150)}
                  placeholder={
                    isMaster && hasImages
                      ? `Describe how to use the references — e.g. person in ${tagForSlot(0)} inside the space in ${tagForSlot(1)}, brand logo on the wall`
                      : products.length > 0
                        ? `Describe what you want created for ${brand?.brand_name}… Type / to pull in a product`
                        : `Describe what you want created for ${brand?.brand_name}…`
                  }
                  rows={5}
                  maxLength={100000}
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

                {taggedItems.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {taggedItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-full"
                        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
                      >
                        <div
                          className="w-5 h-5 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                          style={{ background: 'var(--bg-elevated)' }}
                        >
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package size={10} style={{ color: 'var(--text-muted)' }} />
                          )}
                        </div>
                        <span className="text-xs font-semibold" style={{ color: ACCENT }}>
                          {item.item_type === 'service' ? '🛠' : '📦'} {item.name}
                        </span>
                        <button onClick={() => handleRemoveTag(item.id)} style={{ color: ACCENT }}>
                          <X size={11} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {!isMaster && (
                  <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                    <Crown size={10} style={{ display: 'inline', marginRight: 3, color: ACCENT }} />
                    <button onClick={() => navigate('/profile')} className="font-semibold underline" style={{ color: ACCENT }}>Upgrade to Master</button>
                    {' '}to attach reference images to your generations.
                  </p>
                )}
              </div>

              {/* Style filter */}
              <SettingChips
                label="Style Filter"
                options={[
                  { value: 'hyper_realistic', label: '📱 Hyper Realistic' },
                  { value: 'cinematic',       label: '🎬 Cinematic'       },
                ]}
                value={filter}
                onChange={setFilter}
                accent={ACCENT}
              />

              {/* Aspect ratio */}
              <SettingChips
                label="Aspect Ratio"
                options={ALL_ASPECT_RATIOS.map((o) => ({
                  ...o,
                  disabled: !caps.supportedAspectRatios.includes(o.value),
                }))}
                value={aspectRatio}
                onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
                accent={ACCENT}
              />

              {autoRatio && (
                <p className="text-xs -mt-3 mb-4" style={{ color: 'var(--text-muted)' }}>
                  Aspect ratio auto-set to <strong>{aspectRatio}</strong> from uploaded image
                </p>
              )}

              {/* Duration + Sound (video only) */}
              {outputType === 'video' && (
                <>
                  <SettingChips
                    label="Duration"
                    options={caps.supportedDurations.map((d) => ({ label: `${d}s`, value: d }))}
                    value={duration}
                    onChange={setDuration}
                    accent={ACCENT}
                  />
                  <div className="mb-5">
                    <p className="text-xs font-semibold mb-2.5 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                      Sound
                    </p>
                    <div className="flex gap-2">
                      {[
                        { value: false, label: '🔇 No Sound'   },
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

              {selectedModel && !isPriced && (
                <p className="text-xs text-center mb-4" style={{ color: '#fbbf24' }}>
                  This model isn't priced yet — contact support.
                </p>
              )}

              {/* Refinement off notice */}
              {skipRefinement && (
                <div
                  className="flex items-center gap-2 p-3 rounded-xl mt-1"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                >
                  <Info size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    AI prompt refinement is off. Your direction will be sent to the model as-is.
                  </p>
                </div>
              )}
            </>
          )}

        </div>
      </div>

      {/* Generate button */}
      {outputType !== 'products' && (
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
                <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>
                  Top up
                </button>
              </p>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
