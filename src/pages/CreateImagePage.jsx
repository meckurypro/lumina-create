// src/pages/CreateImagePage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { GenerationPreviewPane } from '@/components/create/GenerationPreviewPane'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, Maximize2, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useRenderWindowEligibility } from '@/hooks/useRenderWindowEligibility'
import { useModelConcurrency } from '@/hooks/useModelConcurrency'
import { Textarea } from '@/components/ui/Input'
import { supabase, generations as generationsDb, profiles as profilesApi } from '@/lib/supabase'
import { getActiveRenderWindowModelIds } from '@/lib/renderWindowModels'
import toast from 'react-hot-toast'
import { applyModelPreferences } from '@/hooks/useModelPreferences'
import { detectAspectRatio, compressImage, tagForSlot } from '@/lib/mediaUtils'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { MentionPicker } from '@/components/create/MentionPicker'
import UploadZone from '@/components/create/UploadZone'
import { usePromptTagging } from '@/hooks/usePromptTagging'
import { fetchMentionLibrary, fetchBrandProducts } from '@/lib/ugcMentions'
import { saveDraftImages, loadDraftImages, saveDraftJSON, loadDraftJSON, draftDelete } from '@/lib/draftCache'
import { watchForEarlyFailure } from '@/lib/generationWatch'
import {
  modelSupportsResolutionChoice, fetchGlobalPricingSettings, fetchToolMargin, calculatePrice,
} from '@/lib/pricing'

const ACCENT     = 'var(--tool-image)'
const ACCENT_SUB = 'var(--tool-image-subtle)'
const ACCENT_BDR = 'var(--tool-image-border)'

const DRAFT_PROMPT = 'create_image:prompt'
const DRAFT_IMAGES = 'create_image:images'

const MAX_SINGLE_IMAGES = 1
const TOOL_KEY = 'create_image'

const ALL_ASPECT_RATIOS = [
  { label: '9:16', value: '9:16' },
  { label: '16:9', value: '16:9' },
  { label: '1:1',  value: '1:1'  },
]

// ─── single image slot ────────────────────────────────────────────────────────

const SingleImageSlot = ({ image, onFile, onPick, onRemove, onFullscreen, modelSupportsImage }) => {
  if (image) {
    const ar = image.w && image.h ? `${image.w} / ${image.h}` : '1 / 1'
    const maxW = image.w && image.h ? (image.w > image.h ? '100%' : '200px') : '140px'
    return (
      <div className="flex justify-center">
        <div className="relative" style={{ width: '100%', maxWidth: maxW }}>
          <div
            className="relative overflow-hidden rounded-2xl cursor-pointer w-full"
            style={{ aspectRatio: ar, maxHeight: '300px', background: 'var(--bg-elevated)' }}
            onClick={onFullscreen}
          >
            <img src={image.url} alt="Reference" className="w-full h-full" style={{ objectFit: 'contain' }} />
            <div className="absolute bottom-2 right-2 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
              <Maximize2 size={11} />
            </div>
            {image.ar && (
              <div className="absolute bottom-2 left-2 px-2 py-0.5 rounded-full text-xs font-medium" style={{ background: 'rgba(0,0,0,0.5)', color: 'white' }}>
                {image.ar}
              </div>
            )}
          </div>
          <button onClick={onRemove}
            className="absolute -top-2.5 -right-2.5 w-7 h-7 rounded-full flex items-center justify-center z-10"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            <X size={13} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex justify-center">
      <UploadZone
        kind="image"
        accent={ACCENT} accentSub={ACCENT_SUB} accentBorder={ACCENT_BDR}
        label={modelSupportsImage ? 'Add reference' : 'Not supported'}
        disabled={!modelSupportsImage}
        size="sm"
        aspectRatio="1/1"
        className="w-[140px]"
        onFile={onFile}
        onPick={onPick}
      />
    </div>
  )
}

// ─── multi-image grid ────────────────────────────────────────────────────────

const MultiImageGrid = ({ images, maxImages, onAdd, onAddPick, onRemove, onTagInsert, onFullscreen }) => {
  const filledCount = images.filter(Boolean).length
  const visibleSlots = filledCount < maxImages ? filledCount + 1 : filledCount
  const slots = Array.from({ length: visibleSlots }, (_, i) => images[i] || null)

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
                <div className="flex flex-col gap-1.5">
                  <UploadZone
                    kind="image"
                    accent={ACCENT} accentSub={ACCENT_SUB} accentBorder={ACCENT_BDR}
                    label={`img${idx + 1}`}
                    size="sm"
                    aspectRatio="1/1"
                    onFile={(file) => onAdd(file, idx)}
                    onPick={(picked) => onAddPick(picked, idx)}
                  />
                  <div
                    className="w-full py-1 rounded-lg text-xs font-mono font-semibold text-center"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', opacity: 0.4 }}
                  >
                    {tagForSlot(idx)}
                  </div>
                </div>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── main page ───────────────────────────────────────────────────────────────

export default function CreateImagePage() {
  const navigate = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()
 const { eligible: canUseRWModels } = useRenderWindowEligibility()
  const textareaRef = useRef(null)

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [prompt,        setPrompt]        = useState('')
  const [images,        setImages]        = useState([])
  const [aspectRatio,   setAspectRatio]   = useState('9:16')
  const [autoRatio,     setAutoRatio]     = useState(false)
  const [model,         setModel]         = useState('')
  const [resolution,    setResolution]    = useState(null)
const [fullscreenIdx, setFullscreenIdx] = useState(null)
  const [submitting,    setSubmitting]    = useState(false)

  const [mentionLibrary,       setMentionLibrary]       = useState({ characters: [], brands: [] })
  const [brandProducts,        setBrandProducts]        = useState([])
  const [brandProductsLoading, setBrandProductsLoading] = useState(false)

  // ── pricing engine state — real $ cost × this tool's margin ÷ $/credit ────
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

  const skipRefinement = !(profile?.ai_prompt_refinement ?? true)

  const {
    trackSelection, insertAtCursor, handlePromptChange,
    mention, resolveMention, drillIntoBrand: drillMentionBrand, backToRoot, closeMention,
  } = usePromptTagging({ textareaRef, getPrompt: () => prompt, setPrompt })

  useEffect(() => {
    if (!user) return
    fetchMentionLibrary(user.id).then(setMentionLibrary)
  }, [user])

  const handleDrillIntoBrand = async (brand) => {
    drillMentionBrand(brand)
    setBrandProductsLoading(true)
    const products = await fetchBrandProducts(brand.id)
    setBrandProducts(products)
    setBrandProductsLoading(false)
  }

  useEffect(() => {
    loadDraftJSON(DRAFT_PROMPT).then((p) => { if (p) setPrompt(p) })
    loadDraftImages(DRAFT_IMAGES).then((restored) => {
      if (!restored.length) return
      setImages(restored)
      if (restored.length === 1) { setAspectRatio(restored[0].ar); setAutoRatio(true) }
    })
  }, [])

  useEffect(() => {
    return () => {
      try {
        draftDelete(DRAFT_PROMPT)
        draftDelete(DRAFT_IMAGES)
      } catch {}
    }
  }, [])

  useEffect(() => {
    saveDraftJSON(DRAFT_PROMPT, prompt)
  }, [prompt])

const loadModels = useCallback(async () => {
    setModelsLoading(true)
    const [{ data }, activeRWModelIds] = await Promise.all([
      supabase
        .from('models')
        .select('*')
        .eq('type', 'image')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .order('sort_order'),
      canUseRWModels ? getActiveRenderWindowModelIds() : Promise.resolve(new Set()),
    ])
    const isMaster = profile?.user_tier === 'master'
    const tierFiltered = (data || [])
      .filter((m) => isMaster || m.tier_required !== 'master')
      // Render-window (ComfyUI) models only show with an active subscription
      // AND a currently-open window AND being attached to that live window.
      .filter((m) => m.model_access_type !== 'render_window' || (canUseRWModels && activeRWModelIds.has(m.id)))
    const list = await applyModelPreferences(tierFiltered, user?.id)
    setModels(list)
    const unlocked = list.filter((m) => !m.is_locked)
    const preferred = profile?.preferred_model
    const match = preferred && unlocked.find((m) => m.value === preferred)
    setModel((match || unlocked[0])?.value || '')
    setModelsLoading(false)
  }, [canUseRWModels]) // eslint-disable-line

  useEffect(() => { loadModels() }, [loadModels])

  const selectedModel      = models.find((m) => m.value === model)
  const modelSupportsImage = selectedModel?.supports_image !== false
  const modelRequiresImage = selectedModel?.requires_image === true
  const modelSupportsMulti = selectedModel?.supports_multi_image === true
  const modelMaxRefImages  = selectedModel?.max_ref_images ?? 1
  const [multiMode, setMultiMode] = useState(false)

  // ── resolution tiers now come from cost_usd_resolution, not the old
  // credit_cost_resolution column. Snap to the model's first real tier
  // whenever the model changes.
  const supportsResolutionChoice = modelSupportsResolutionChoice(selectedModel)
  useEffect(() => {
    if (!selectedModel) { setResolution(null); return }
    const keys = Object.keys(selectedModel.cost_usd_resolution || {}).filter((k) => k !== 'standard')
    setResolution(keys.length ? keys[0] : null)
  }, [model]) // eslint-disable-line

  useEffect(() => {
    setMultiMode(false)
    if (!modelSupportsImage) {
      clearAllImages()
    } else if (!modelSupportsMulti && images.length > 1) {
      setImages([images[0]])
    }
  }, [model]) // eslint-disable-line

  const maxImages = (modelSupportsMulti && multiMode) ? modelMaxRefImages : MAX_SINGLE_IMAGES
  const supportedRatios = selectedModel?.supported_aspect_ratios ?? ['9:16', '16:9', '1:1']

  const hasImages = images.length > 0
  const type = hasImages && modelSupportsImage ? 'image_to_image' : 'text_to_image'

  // ── price this generation via the shared pricing engine ───────────────
  const priced = (selectedModel && globalSettings && toolMargin)
    ? calculatePrice({
        model: selectedModel,
        resolution: supportsResolutionChoice ? resolution : undefined,
        duration: undefined,
        marginMultiplier: toolMargin,
        globalSettings,
      })
    : null
  const isPriced   = priced !== null
  const creditCost = priced?.credits ?? 0

  // Per-resolution credit labels for the Quality chips — computed live so
  // margin/rate changes in admin are reflected without touching this page.
  const resolutionOptions = (supportsResolutionChoice && selectedModel && globalSettings && toolMargin)
    ? Object.keys(selectedModel.cost_usd_resolution || {})
        .filter((k) => k !== 'standard')
        .map((key) => {
          const p = calculatePrice({ model: selectedModel, resolution: key, marginMultiplier: toolMargin, globalSettings })
          return { key, label: `${key.toUpperCase()} · ${p?.credits ?? '—'} cr` }
        })
    : []

const canAfford      = credits >= creditCost
  const promptEmpty    = !prompt.trim()
  const imageRequired  = modelRequiresImage && !hasImages
  const { blocked: concurrencyBlocked, reason: concurrencyReason } = useModelConcurrency(selectedModel)
  const buttonDisabled = promptEmpty || !canAfford || submitting || !selectedModel || imageRequired || concurrencyBlocked
    || !isPriced

  useEffect(() => {
    if (!selectedModel) return
    if (!autoRatio && !supportedRatios.includes(aspectRatio)) {
      setAspectRatio(supportedRatios[0] || '9:16')
    }
  }, [model]) // eslint-disable-line

  useEffect(() => {
    if (!modelSupportsImage) {
      clearAllImages()
    } else if (!modelSupportsMulti && images.length > 1) {
      setImages((prev) => [prev[0]])
      persistImages([images[0]])
    }
  }, [model]) // eslint-disable-line

  const handleModelChange = async (value) => {
    setModel(value)
    if (user && value && value !== profile?.preferred_model) {
      try { await profilesApi.update(user.id, { preferred_model: value }) } catch { /* noop */ }
    }
  }

  const persistImages = (imgs) => { saveDraftImages(DRAFT_IMAGES, imgs) }

  const clearAllImages = () => {
    setImages([])
    setAutoRatio(false)
    setAspectRatio('9:16')
    draftDelete(DRAFT_IMAGES)
  }

  const handleAddImage = async (file, slotIdx) => {
    if (!file) return
    const compressed = await compressImage(file)
    setImages((prev) => {
      const next = [...prev]
      next[slotIdx] = compressed
      const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
      persistImages(trimmed)
      if (slotIdx === 0) { setAspectRatio(compressed.ar); setAutoRatio(true) }
      return trimmed
    })
  }

  // picked = { url, name, mimeType, aspectRatio, thumbnailUrl, isVideo, source }
  // from UploadZone's Media/Assets browser — no local File, so we build the
  // slot straight from the URL instead of running it through compressImage.
  const handleAddImagePick = (picked, slotIdx) => {
    const img = { file: null, url: picked.url, ar: picked.aspectRatio || '1:1' }
    setImages((prev) => {
      const next = [...prev]
      next[slotIdx] = img
      const trimmed = next.filter((_, i) => i <= slotIdx || next[i] != null)
      persistImages(trimmed)
      return trimmed
    })
    if (slotIdx === 0) {
      setAspectRatio(picked.aspectRatio || '1:1')
      setAutoRatio(!!picked.aspectRatio)
    }
  }

  const handleSingleImageUpload = async (file) => {
    if (!file) return
    const compressed = await compressImage(file)
    setImages([compressed])
    persistImages([compressed])
    setAspectRatio(compressed.ar)
    setAutoRatio(true)
  }

  const handleSingleImagePick = (picked) => {
    const img = { file: null, url: picked.url, ar: picked.aspectRatio || '1:1' }
    setImages([img])
    persistImages([img])
    if (picked.aspectRatio) { setAspectRatio(picked.aspectRatio); setAutoRatio(true) }
  }

  const handleRemoveImage = (idx) => {
    setImages((prev) => {
      const next = prev.filter((_, i) => i !== idx)
      persistImages(next)
      if (idx === 0 && next.length === 0) { setAutoRatio(false); setAspectRatio('9:16') }
      return next
    })
  }

 const addMentionImage = (url, role, label) => {
    if (!modelSupportsMulti) {
      toast.error('Switch to a multi-reference model to tag characters or brands')
      return null
    }
    const filled = images.filter(Boolean)
    if (filled.length >= modelMaxRefImages) {
      toast.error(`This model supports up to ${modelMaxRefImages} reference images`)
      return null
    }
    if (!multiMode) setMultiMode(true)
    const idx = filled.length
    const next = [...images]
    next[idx] = { file: null, url, ar: '1:1', role, label }
    setImages(next)
    persistImages(next)
    return idx
  }

  const handleSelectMentionUpload = (idx) => resolveMention(tagForSlot(idx))

  const handleSelectMentionCharacter = (character) => {
    const idx = addMentionImage(character.photo_face_front, 'character_face', character.name)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }

  const handleSelectMentionLogo = (brand) => {
    const idx = addMentionImage(brand.logo_url, 'brand_logo', brand.brand_name)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }

  const handleSelectMentionProduct = (brand, product) => {
    const idx = addMentionImage(product.image_url, 'product', `${brand.brand_name} — ${product.name}`)
    if (idx !== null) resolveMention(tagForSlot(idx))
  }

  const handleGenerate = async () => {
    if (promptEmpty)    return toast.error('Enter a prompt')
    if (!selectedModel) return toast.error('Pick a model')
    if (!isPriced)       return toast.error('This model isn\'t priced yet — contact support')
    if (!canAfford)     return toast.error('Not enough credits')
    if (!user)          return toast.error('Please sign in')

    setSubmitting(true)
    try {
    const uploadedUrls  = []
      const imageRefsMeta = []
      for (const img of images) {
        if (!img) continue
        let url = img.url
        if (img.file) {
          const contentType = img.file.type || 'image/jpeg'
          const ext = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
          const path = `${user.id}/${crypto.randomUUID()}.${ext}`
          const { data: uploadData, error: upErr } = await supabase.storage
            .from('generation-uploads')
            .upload(path, img.file, { upsert: false, cacheControl: '3600', contentType })
          if (upErr) throw new Error(`Reference upload failed: ${upErr.message}`)
          const { data: { publicUrl } } = supabase.storage
            .from('generation-uploads')
            .getPublicUrl(uploadData.path)
          url = publicUrl
        }
        uploadedUrls.push(url)
        if (img.role) imageRefsMeta.push({ url, role: img.role, label: img.label || null })
      }

      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id: user.id,
        generation_type: type,
        status: 'pending',
        prompt,
        model,
        aspect_ratio: aspectRatio,
        resolution: supportsResolutionChoice ? resolution : null,
        credits_charged: creditCost,
        output_type: 'image',
        start_frame_url: null,
     input_image_urls: uploadedUrls.length ? uploadedUrls : null,
        generation_metadata: imageRefsMeta.length ? { image_refs: imageRefsMeta } : null,
        skip_prompt_refinement: skipRefinement,
        is_system_prompt: false,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

     const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('image-generate', { body: { generationId: genRow.id } })

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

      toast.success('Your image is being generated. Check your Media page.', { duration: 4000 })
      setPrompt('')
      clearAllImages()

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('Generate error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  const fullscreenImage = fullscreenIdx !== null ? images[fullscreenIdx] : null

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold tracking-wide" style={{ color: '#ffffff' }}>Generating…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}
      >
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Create Image</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Image Generation</span>
        </div>
        <div className="flex items-center gap-2">
          {!modelsLoading && (
            <ModelDropdown
              models={models} value={model} onChange={handleModelChange}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
            />
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {fullscreenImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.93)', backdropFilter: 'blur(12px)' }}
            onClick={() => setFullscreenIdx(null)}
          >
            <button onClick={() => setFullscreenIdx(null)}
              className="absolute top-5 right-5 w-10 h-10 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'white' }}
            >
              <X size={18} />
            </button>
            <motion.img
              initial={{ scale: 0.93, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.93, opacity: 0 }}
              src={fullscreenImage.url} alt="Reference full" className="rounded-2xl"
              style={{ maxWidth: '100%', maxHeight: '90dvh', objectFit: 'contain' }}
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 min-h-0 flex">
      <div className="flex-1 lg:flex-none lg:w-[480px] lg:border-r overflow-y-auto" style={{ borderColor: 'var(--border-color)' }}>
        <div className="mx-auto w-full max-w-xl px-4 lg:px-6 py-6 flex flex-col gap-5">

          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Reference Image
                <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>
                  {modelRequiresImage ? ' — required' : ' — optional'}
                </span>
              </p>
              {modelSupportsMulti && modelSupportsImage && (
                <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  {[
                    { value: false, label: 'Simple' },
                    { value: true,  label: 'Multi-ref' },
                  ].map((opt) => (
                    <button
                      key={String(opt.value)}
                      onClick={() => {
                        setMultiMode(opt.value)
                        if (!opt.value && images.length > 1) {
                          setImages([images[0]])
                          persistImages([images[0]])
                        }
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: multiMode === opt.value ? ACCENT       : 'transparent',
                        color:      multiMode === opt.value ? '#ffffff'    : 'var(--text-muted)',
                      }}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {(modelSupportsMulti && multiMode) ? (
              <MultiImageGrid
                images={images}
                maxImages={maxImages}
                onAdd={handleAddImage}
                onAddPick={handleAddImagePick}
                onRemove={handleRemoveImage}
               onTagInsert={insertAtCursor}
                onFullscreen={(idx) => setFullscreenIdx(idx)}
              />
            ) : (
              <SingleImageSlot
                image={images[0] || null}
                onFile={handleSingleImageUpload}
                onPick={handleSingleImagePick}
                onRemove={() => handleRemoveImage(0)}
                onFullscreen={() => setFullscreenIdx(0)}
                modelSupportsImage={modelSupportsImage}
              />
            )}

            {!modelSupportsImage && !modelRequiresImage && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                This model is text-only. Switch models to use a reference image.
              </p>
            )}
            {modelSupportsImage && modelRequiresImage && !hasImages && (
              <p className="text-xs text-center mt-2" style={{ color: 'var(--tool-image)' }}>
                This model requires a reference image to generate.
              </p>
            )}

        <MentionPicker
              mention={mention}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
              images={images}
              onSelectImage={handleSelectMentionUpload}
              characters={mentionLibrary.characters}
              brands={mentionLibrary.brands}
              brandProducts={brandProducts}
              brandProductsLoading={brandProductsLoading}
              onSelectCharacter={handleSelectMentionCharacter}
              onSelectBrand={handleDrillIntoBrand}
              onSelectLogo={handleSelectMentionLogo}
              onSelectProduct={handleSelectMentionProduct}
              onBack={backToRoot}
            />

            <Textarea
              ref={textareaRef}
              label="Prompt"
              value={prompt}
              onChange={handlePromptChange}
              onSelect={trackSelection}
              onKeyUp={trackSelection}
              onClick={trackSelection}
              onFocus={trackSelection}
              onKeyDown={(e) => { if (e.key === 'Escape' && mention) closeMention() }}
              placeholder={
                modelSupportsMulti && multiMode && images.length > 0
                  ? `e.g. Person in ${tagForSlot(0)} hugs person in ${tagForSlot(1)}. Type @ for uploads, / for characters & brands.`
                  : 'What are we creating today? Type @ for uploads, / for characters & brands.'
              }
              rows={4}
            />

            <div className="pt-1">
              <SettingChips
                label="Aspect Ratio"
                options={ALL_ASPECT_RATIOS.map((o) => ({
                  ...o,
                  disabled: !supportedRatios.includes(o.value),
                }))}
                value={aspectRatio}
                onChange={(v) => { setAspectRatio(v); setAutoRatio(false) }}
                accent={ACCENT}
              />
            </div>

            {supportsResolutionChoice && resolutionOptions.length > 0 && (
              <div className="pt-1">
                <SettingChips
                  label="Quality"
                  options={resolutionOptions.map((o) => ({ label: o.label, value: o.key }))}
                  value={resolution}
                  onChange={setResolution}
                  accent={ACCENT}
                />
              </div>
            )}

            {selectedModel && !isPriced && (
              <p className="text-xs text-center" style={{ color: '#fbbf24' }}>
                This model isn't priced yet — contact support.
              </p>
            )}

          </div>
        </div>
      </div>
      <GenerationPreviewPane outputType="image" />
      </div>

      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: '1px solid var(--glass-border)', background: 'var(--glass-bg)', backdropFilter: 'blur(20px) saturate(160%)', WebkitBackdropFilter: 'blur(20px) saturate(160%)' }}>
        <div className="mx-auto w-full max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={buttonDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: buttonDisabled ? 'var(--bg-elevated)' : 'var(--gradient-brand)',
              color:      buttonDisabled ? 'var(--text-muted)'  : '#ffffff',
              boxShadow:  buttonDisabled ? 'none' : 'var(--shadow-brand-lg)',
            }}
          >
            <Zap size={15} fill="currentColor" />
            {!canAfford && !promptEmpty
              ? 'Not enough credits'
              : `Generate${creditCost ? ` · ${creditCost} cr` : ''}`}
          </button>
  {concurrencyBlocked && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              {concurrencyReason || 'You already have a job running for this model — wait for it to finish.'}
            </p>
          )}
          {promptEmpty && !submitting && !concurrencyBlocked && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Enter a prompt to continue.
            </p>
          )}
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>Top up</button>
            </p>
          )}
        </div>
      </div>

    </div>
  )
  }
