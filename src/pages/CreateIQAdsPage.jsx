// src/pages/CreateIQAdsPage.jsx
//
// Flyer → cinematic video ad. Upload a flyer (self-made or from any tool),
// optionally add direction, pay, done.
// "No flyer?" and "Want something custom?" both route to the IQ Ads
// creative team on WhatsApp rather than building more self-serve surface
// for those two segments — see thread history for why.
//
// content_type: 'product' | 'event' — branches the prompt built server-side
// in iqads-generate. Event flyers hide the "Human in the Ad" section since
// event flyers (e.g. a choir/group photo) already show whoever's in them.
//
// Pricing is credit-primary, same convention as CreateVideoPage: priced.credits
// is what's actually charged (via process_iqads_order_payment on the credit
// path). Naira never appears in this UI — it only exists server-side as the
// Paystack charge amount, derived from the same USD cost at order-creation
// time (see lib/iqads.js createIqadsOrder).
//
// Duration is restricted to a fixed tier list (10/15/30/45s) rather than
// showing every value in a model's supported_durations — anything under
// 10s is not offered. 30/45s are reserved for future models; a model whose
// supported_durations doesn't reach those tiers just won't show them.
//
// Minimalist pass: header shows only "IQ Ads" (no subtitle, no credit
// balance). Model dropdown only renders when more than one model is
// active — most launches will run Seedance-only, so the picker disappears
// entirely rather than showing a single disabled-looking option. Duration
// picker, by contrast, always renders even with a single option — it stays
// visible as a selected, non-deselectable chip so the user can see what
// they're committing to. Direction input starts collapsed behind a
// toggle — most users on this page are not power users and don't need an
// open textarea staring at them.
//
// Checkout: credit and Paystack are two independently-gated payment paths,
// not one gate with two buttons. canAfford (credit balance) only applies
// to the credit path — Paystack brings outside money and doesn't care
// about the user's credit balance. See canCheckoutBase / canCheckoutCredit
// / canCheckoutPaystack below. The footer below the buttons shows a single
// priority-ordered blocking reason instead of stacking every unmet
// condition at once.
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Zap, X, ImagePlus, MessageCircle, Palette, Plus, ChevronUp, Loader2 } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { compressImage } from '@/lib/mediaUtils'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { Textarea } from '@/components/ui/Input'
import {
  fetchIqadsModels, calculateIqadsPrice, iqadsSupportsResolutionChoice,
  createIqadsOrder, payIqadsOrderWithCredits, payIqadsOrderWithPaystack,
  triggerIqadsGeneration,
} from '@/lib/iqads'

const ACCENT     = 'var(--tool-iqads, #f97316)'
const ACCENT_SUB = 'var(--tool-iqads-subtle, var(--bg-elevated))'
const ACCENT_BDR = 'var(--tool-iqads-border, var(--border-color))'

const WHATSAPP_NUMBER = '2348162465247'
const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

// Fixed duration tiers — a model only ever offers the subset of these it
// actually supports (via supported_durations). 30/45 exist here for
// future models; today's models cap out lower and simply won't show them.
const DURATION_TIERS = ['10', '15', '30', '45']

const HUMAN_MODES = [
  { label: 'No human',   value: 'none' },
  { label: 'AI Generate', value: 'ai_generate' },
  { label: 'Upload human', value: 'uploaded' },
]

const CONTENT_TYPES = [
  { label: 'Product / Service', value: 'product' },
  { label: 'Event',             value: 'event' },
]

export default function CreateIQAdsPage() {
  const navigate = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [models, setModels]           = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)

  const [flyer, setFlyer]             = useState(null)   // { file, url }
  const [contentType, setContentType] = useState('product') // 'product' | 'event'
  const [modelValue, setModelValue]   = useState('')
  const [resolution, setResolution]   = useState('480p')
  const [duration, setDuration]       = useState('')
  const [aspectRatio, setAspectRatio] = useState('9:16')
  const [humanMode, setHumanMode]     = useState('ai_generate')
  const [humanRef, setHumanRef]       = useState(null)    // { file, url }
  const [userDirection, setUserDirection] = useState('')
  const [showDirection, setShowDirection] = useState(false)

  const [priced, setPriced]           = useState(null)
  const [pricing, setPricing]         = useState(false)

  const [submitting, setSubmitting]   = useState(false)
  const [paying, setPaying]           = useState(null)    // 'credit' | 'paystack' | null

  // ── load enabled models ────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setModelsLoading(true)
      const list = await fetchIqadsModels()
      setModels(list)
      if (list.length) setModelValue(list[0].value)
      setModelsLoading(false)
    })()
  }, [])

  const selectedModel = models.find((m) => m.value === modelValue)
  const showModelPicker = !modelsLoading && models.length > 1

  const supportsResolutionChoice = iqadsSupportsResolutionChoice(selectedModel)
  const durations = selectedModel?.supported_durations?.length
    ? DURATION_TIERS.filter((d) => selectedModel.supported_durations.includes(d))
    : []
  const aspectRatios  = selectedModel?.supported_aspect_ratios?.length ? selectedModel.supported_aspect_ratios : ['9:16', '16:9', '1:1']

  useEffect(() => {
    if (!selectedModel) return
    if (!durations.includes(duration)) setDuration(durations[0] || '')
    if (!aspectRatios.includes(aspectRatio)) setAspectRatio(aspectRatios[0])
    if (!supportsResolutionChoice) setResolution('480p')
  }, [modelValue]) // eslint-disable-line

  // Event flyers already show whoever's in them — human_mode doesn't apply.
  // Reset back to default whenever switching into 'event' so a stale
  // 'uploaded' selection (and its now-hidden humanRef) can't leak into the order.
  useEffect(() => {
    if (contentType === 'event') {
      setHumanMode('ai_generate')
      setHumanRef(null)
    }
  }, [contentType])

  // ── price preview — async now (hits Supabase for margin + rate) ───────
  useEffect(() => {
    let cancelled = false
    if (!selectedModel || !duration) { setPriced(null); return }
    setPricing(true)
    calculateIqadsPrice({ model: selectedModel, duration, resolution })
      .then((p) => { if (!cancelled) setPriced(p) })
      .finally(() => { if (!cancelled) setPricing(false) })
    return () => { cancelled = true }
  }, [selectedModel, duration, resolution])

  // ── credit cost derived from the same priced object — this IS what's
  // charged (see lib/iqads.js payIqadsOrderWithCredits). Naira never
  // surfaces in this UI. ──────────────────────────────────────────────
  const creditCost = priced?.credits ?? 0
  const canAfford   = !priced || credits >= creditCost

  // ── upload handlers ────────────────────────────────────────────────────
  const handleFlyerUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const compressed = await compressImage(file)
    setFlyer(compressed)
  }
  const handleHumanUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    const compressed = await compressImage(file)
    setHumanRef(compressed)
  }

  const uploadToStorage = async (fileOrNull, existingUrl) => {
    if (!fileOrNull) return existingUrl
    const fileType = fileOrNull.type || 'image/jpeg'
    const ext  = fileType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`
    const { data, error } = await supabase.storage
      .from('generation-uploads')
      .upload(path, fileOrNull, { upsert: false, cacheControl: '3600', contentType: fileType })
    if (error) throw new Error(`Upload failed: ${error.message}`)
    const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(data.path)
    return publicUrl
  }

  // ── checkout gating ─────────────────────────────────────────────────────
  // canCheckoutBase covers everything both payment paths need (flyer,
  // model/duration selection, human reference if required, not mid-submit).
  // canAfford (credit balance) is credit-only — Paystack brings outside
  // money and must never be blocked by an insufficient in-app balance.
  const canCheckoutBase = !!flyer && !!selectedModel && !!duration && !!priced && !pricing &&
    durations.length > 0 &&
    (contentType === 'event' || humanMode !== 'uploaded' || !!humanRef) && !submitting

  const canCheckoutCredit   = canCheckoutBase && canAfford
  const canCheckoutPaystack = canCheckoutBase

  // ── checkout ────────────────────────────────────────────────────────────
  const handleCheckout = async (method) => {
    const allowed = method === 'credit' ? canCheckoutCredit : canCheckoutPaystack
    if (!allowed || !user) return
    setSubmitting(true)
    setPaying(method)
    try {
      const flyerUrl = await uploadToStorage(flyer.file, flyer.url)
      const humanUrl = contentType === 'product' && humanMode === 'uploaded'
        ? await uploadToStorage(humanRef.file, humanRef.url)
        : null

      const order = await createIqadsOrder({
        userId:            user.id,
        flyerUrl,
        contentType,
        model:              selectedModel,
        duration,
        resolution,
        aspectRatio,
        humanMode:          contentType === 'event' ? null : humanMode,
        humanReferenceUrl:  humanUrl,
        userDirection:       userDirection.trim() || null,
        paymentMethod:       method,
      })

      if (method === 'credit') {
        await payIqadsOrderWithCredits({ order, userId: user.id })
        await refreshProfile()
        toast.success('Payment confirmed — your video is being generated 🎬')
        await triggerIqadsGeneration(order.id)
        navigate('/media')
        return
      }

      // Paystack — redirects the browser away, nothing to do after this call.
      await payIqadsOrderWithPaystack({ order, email: user.email, userId: user.id })

    } catch (err) {
      toast.error(err.message || 'Checkout failed')
      setSubmitting(false)
      setPaying(null)
    }
  }

  const generateLabel = priced
    ? `Generate · ${creditCost} cr`
    : pricing ? 'Calculating…' : 'Generate'

  // ── footer helper text — single priority-ordered reason, not a stack ──
  const renderBlockingReason = () => {
    // No flyer message here on purpose — the empty dropzone above already
    // makes "no flyer yet" obvious; repeating it under the button was redundant.
    if (!flyer) return null
    if (contentType === 'product' && humanMode === 'uploaded' && !humanRef) {
      return <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>Upload a human reference photo to continue</p>
    }
    if (selectedModel && durations.length === 0) {
      return <p className="text-xs text-center" style={{ color: '#fbbf24' }}>This model has no valid duration configured yet.</p>
    }
    if (priced && !canAfford) {
      return (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          Not enough credits for Generate —{' '}
          <button onClick={() => navigate('/credits')} className="font-semibold" style={{ color: ACCENT }}>top up</button>
          {' '}or pay with Paystack above.
        </p>
      )
    }
    return null
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.4)' }}
          >
            <Loader2 size={32} className="animate-spin" style={{ color: '#fff' }} />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>
              {paying === 'credit' ? 'Processing payment…' : 'Redirecting to Paystack…'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header — minimal: title only, model picker only if there's a real choice, no balance */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate('/create', { state: { tab: 'utilities' } })} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>IQ Ads</h1>
        {showModelPicker ? (
          <ModelDropdown
            models={models} value={modelValue} onChange={setModelValue}
            accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR}
          />
        ) : (
          <div style={{ width: 20 }} /> // balances the back button so title stays centered
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* No flyer? */}
          <a href={waLink("Hi! I don't have a flyer yet and I'd like IQ Ads to design one for me.")}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
            <MessageCircle size={16} style={{ color: ACCENT, flexShrink: 0 }} />
            <p className="text-xs flex-1" style={{ color: 'var(--text-secondary)' }}>
              Don't have a flyer? <strong style={{ color: ACCENT }}>Talk to our creative team</strong> — we'll design one for you.
            </p>
          </a>

          {/* Flyer upload */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Your Flyer — required
            </p>
            {flyer ? (
              <div className="relative w-full rounded-2xl overflow-hidden" style={{ aspectRatio: '3/4', background: 'var(--bg-elevated)', maxHeight: 320 }}>
                <img src={flyer.url} alt="Flyer" className="w-full h-full" style={{ objectFit: 'contain' }} />
                <button onClick={() => setFlyer(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all py-10"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <input type="file" accept="image/*" className="hidden" onChange={handleFlyerUpload} />
                <ImagePlus size={22} style={{ color: ACCENT, marginBottom: 8 }} />
                <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload your flyer</span>
                <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>From this app, Canva, ChatGPT, or your designer</span>
              </label>
            )}
          </div>

          {/* Content type */}
          <div>
            <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Flyer Type
            </p>
            <SettingChips
              options={CONTENT_TYPES}
              value={contentType} onChange={setContentType} accent={ACCENT}
            />
          </div>

          {/* Resolution / Duration / Aspect ratio */}
          <div>
            {supportsResolutionChoice && (
              <SettingChips label="Resolution"
                options={[{ label: '480p', value: '480p' }, { label: '720p', value: '720p' }]}
                value={resolution} onChange={setResolution} accent={ACCENT} />
            )}
            {durations.length > 0 && (
              <SettingChips label="Duration"
                options={durations.map((d) => ({ label: `${d}s`, value: d }))}
                value={duration} onChange={setDuration} accent={ACCENT} />
            )}
            <SettingChips label="Aspect Ratio"
              options={aspectRatios.map((a) => ({ label: a, value: a }))}
              value={aspectRatio} onChange={setAspectRatio} accent={ACCENT} />
          </div>

          {/* Human mode — product flyers only; event flyers show whoever's already in them */}
          {contentType === 'product' && (
            <div>
              <p className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Human in the Ad
              </p>
              <SettingChips options={HUMAN_MODES} value={humanMode} onChange={setHumanMode} accent={ACCENT} />

              {humanMode === 'uploaded' && (
                <div className="mt-3 flex flex-col gap-2">
                  <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Use a clear photo — the person's face should be vivid and unobstructed for best results.
                  </p>
                  {humanRef ? (
                    <div className="relative w-24 h-24 rounded-2xl overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                      <img src={humanRef.url} alt="Human reference" className="w-full h-full object-cover" />
                      <button onClick={() => setHumanRef(null)}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.65)', color: 'white' }}>
                        <X size={10} />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer"
                      style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
                      <input type="file" accept="image/*" className="hidden" onChange={handleHumanUpload} />
                      <ImagePlus size={13} style={{ color: ACCENT }} />
                      <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload a photo</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Direction — collapsed by default, revealed on tap */}
          <div>
            {showDirection ? (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Direction (optional)
                  </label>
                  <button
                    onClick={() => { setShowDirection(false); setUserDirection('') }}
                    className="flex items-center gap-1 text-xs"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    <ChevronUp size={12} /> Hide
                  </button>
                </div>
                <Textarea
                  value={userDirection}
                  onChange={(e) => setUserDirection(e.target.value.slice(0, 300))}
                  placeholder="Any specific scene, story, or detail you want — e.g. 'pouring into a chilled glass at sunset'"
                  rows={2} maxLength={300}
                  autoFocus
                />
              </div>
            ) : (
              <button
                onClick={() => setShowDirection(true)}
                className="flex items-center gap-2 text-xs font-medium"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={13} /> Add direction (optional)
              </button>
            )}
          </div>

          {/* Want something custom? */}
          <a href={waLink("Hi! I'd like a custom ad concept made by the IQ Ads creative team.")}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
            <Palette size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <p className="text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
              Want something fully custom? <strong style={{ color: 'var(--text-secondary)' }}>Talk to our creative team</strong> instead.
            </p>
          </a>

        </div>
      </div>

      {/* Checkout — Generate (credit) is the one real CTA; Paystack is a quiet secondary link.
          The two are gated independently: canCheckoutCredit also requires canAfford,
          canCheckoutPaystack does not — see comment above canCheckoutBase. */}
      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">
          <button onClick={() => handleCheckout('credit')} disabled={!canCheckoutCredit}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: canCheckoutCredit ? ACCENT : 'var(--bg-elevated)',
              color: canCheckoutCredit ? '#fff' : 'var(--text-muted)',
              opacity: canCheckoutCredit ? 1 : 0.5,
            }}>
            <Zap size={14} fill="currentColor" />
            {generateLabel}
          </button>

          <button onClick={() => handleCheckout('paystack')} disabled={!canCheckoutPaystack}
            className="w-full py-2 text-xs font-medium text-center transition-all"
            style={{ color: canCheckoutPaystack ? ACCENT : 'var(--text-muted)', opacity: canCheckoutPaystack ? 1 : 0.4 }}>
            Or pay with Paystack instead
          </button>

          {renderBlockingReason()}
        </div>
      </div>
    </div>
  )
}
