// src/components/templates/TemplateRunner.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowLeft, Zap } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase, generations as generationsDb, templatePrompts } from '@/lib/supabase'
import { getTemplate, buildPrompt } from '@/templates/index'
import toast from 'react-hot-toast'

// ── Image Upload Slot ─────────────────────────────────────
const ImageSlot = ({ label, hint, value, onChange, onRemove }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      {label}
    </p>
    {hint && (
      <p className="text-xs" style={{ color: 'var(--text-muted)', marginTop: -4 }}>{hint}</p>
    )}
    {value ? (
      <div
        className="relative rounded-2xl overflow-hidden"
        style={{ aspectRatio: '1/1', background: 'var(--bg-elevated)' }}
      >
        <img src={value.url} alt={label} className="w-full h-full object-cover" />
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
          style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
        >
          ✕
        </button>
      </div>
    ) : (
      <label
        className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all"
        style={{
          aspectRatio: '1/1',
          border:      '1.5px dashed var(--border-color)',
          background:  'var(--bg-card)',
        }}
      >
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            onChange({ file, url: URL.createObjectURL(file) })
          }}
        />
        <span className="text-2xl mb-2" style={{ color: 'var(--text-muted)' }}>＋</span>
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>Upload</span>
      </label>
    )}
  </div>
)

// ── Mode Selector ─────────────────────────────────────────
const ModeSelector = ({ modes, value, onChange }) => (
  <div className="flex flex-col gap-2">
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
      Mode
    </p>
    <div className="grid grid-cols-2 gap-2">
      {modes.map((mode) => {
        const isSelected = value === mode.key
        return (
          <button
            key={mode.key}
            onClick={() => onChange(mode.key)}
            className="flex flex-col gap-1 p-4 rounded-2xl text-left transition-all"
            style={{
              background: isSelected ? 'var(--brand)' : 'var(--bg-card)',
              border:     `1px solid ${isSelected ? 'var(--brand)' : 'var(--border-color)'}`,
            }}
          >
            <span
              className="text-sm font-bold"
              style={{ color: isSelected ? '#ffffff' : 'var(--text-primary)' }}
            >
              {mode.label}
            </span>
            <span
              className="text-xs leading-snug"
              style={{ color: isSelected ? 'rgba(255,255,255,0.75)' : 'var(--text-muted)' }}
            >
              {mode.description}
            </span>
          </button>
        )
      })}
    </div>
  </div>
)

// ── Main Component ────────────────────────────────────────
export const TemplateRunner = ({ template: dbTemplate, onBack }) => {
  const navigate                          = useNavigate()
  const { user, credits, refreshProfile } = useAuth()

  const fileTemplate = getTemplate(dbTemplate?.prompt_key)
  const inputs       = fileTemplate?.inputs       || []
  const modes        = fileTemplate?.modes        || []
  const systemPrompt = fileTemplate?.systemPrompt || ''
  const lockedModel  = fileTemplate?.lockedModel  || dbTemplate?.default_model || 'auto'
  const creditCost   = dbTemplate?.credit_cost    || 0
  const canAfford    = credits >= creditCost

  const [imageValues,  setImageValues]  = useState({})
  const [selectedMode, setSelectedMode] = useState(modes[0]?.key || null)
  const [submitting,   setSubmitting]   = useState(false)

  const allInputsFilled = inputs
    .filter((i) => i.required && i.type === 'image')
    .every((i) => !!imageValues[i.key])

  const canGenerate = allInputsFilled && canAfford && !submitting

  const uploadImage = async (inputKey) => {
    const img  = imageValues[inputKey]
    if (!img?.file) return null
    const file = img.file

    const contentType =
      (file.type && file.type !== '') ? file.type
      : file.name?.match(/\.png$/i)   ? 'image/png'
      : file.name?.match(/\.webp$/i)  ? 'image/webp'
      : 'image/jpeg'

    const ext  = contentType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg'
    const path = `${user.id}/${crypto.randomUUID()}.${ext}`

    const { data: uploadData, error: upErr } = await supabase.storage
      .from('generation-uploads')
      .upload(path, file, { upsert: false, cacheControl: '3600', contentType })

    if (upErr) throw new Error(`Upload failed (${inputKey}): ${upErr.message}`)

    const { data: { publicUrl } } = supabase.storage
      .from('generation-uploads')
      .getPublicUrl(uploadData.path)

    return publicUrl
  }

  const handleGenerate = async () => {
    if (!canGenerate) return
    if (!user) return toast.error('Please sign in')
    setSubmitting(true)

    try {
      // 1. Upload all images
      const uploadedUrls = {}
      for (const input of inputs.filter((i) => i.type === 'image')) {
        if (imageValues[input.key]) {
          uploadedUrls[input.key] = await uploadImage(input.key)
        }
      }

      // 2. Fetch active prompt from DB
      const { data: activePrompt, error: promptErr } = await templatePrompts.getActive(dbTemplate.slug)
      if (promptErr || !activePrompt) throw new Error('Could not load template prompt')

      // 3. Build final prompt
      const finalPrompt = buildPrompt(activePrompt, fileTemplate, selectedMode)

      // 4. Map inputs to generation fields
      const inputUrls     = Object.values(uploadedUrls).filter(Boolean)
      const startFrameUrl = uploadedUrls['reference_image'] || uploadedUrls[inputs[0]?.key] || null
      const endFrameUrl   = uploadedUrls['face_image']      || uploadedUrls[inputs[1]?.key] || null

      // 5. Create generation row
      const { data: genRow, error: genErr } = await generationsDb.create({
        user_id:          user.id,
        template_id:      dbTemplate.id,
        generation_type:  'image_to_image',
        status:           'pending',
        prompt:           finalPrompt,
        enhanced_prompt:  systemPrompt,
        model:            lockedModel,
        aspect_ratio:     '1:1',
        credits_charged:  creditCost,
        output_type:      'image',
        start_frame_url:  startFrameUrl,
        end_frame_url:    endFrameUrl,
        input_image_urls: inputUrls,
      })
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // 6. Deduct credits
      const { data: deduct, error: dErr } = await generationsDb.deductCredits(user.id, creditCost, genRow.id)
      if (dErr || !deduct?.success) {
        await generationsDb.update(genRow.id, { status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
        throw new Error(deduct?.error || 'Not enough credits')
      }

      // 7. Invoke generation pipeline (fire-and-forget)
      supabase.functions.invoke('image-generate', { body: { generationId: genRow.id } })
        .catch((e) => console.error('image-generate invoke error', e))

      // 8. Reset form, refresh credits, notify — stays on page (matches CreateImagePage)
      refreshProfile()
      toast.success('Your image is being generated. Check your Media page.', { duration: 4000 })
      setImageValues({})
      setSelectedMode(modes[0]?.key || null)

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
      console.error('TemplateRunner generate error:', err)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Header ── */}
      <div
        className="sticky top-0 z-10 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-primary)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button
          onClick={onBack}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-extrabold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {dbTemplate?.name || 'Template'}
          </h2>
          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
            {dbTemplate?.description}
          </p>
        </div>
        <div
          className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold flex-shrink-0"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
        >
          <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
          {creditCost} cr
        </div>
      </div>

      {/* ── Scrollable content ── */}
      <div
        className="mx-auto max-w-xl px-4 py-6 flex flex-col gap-6"
        style={{ paddingBottom: 'calc(64px + 32px + 56px + env(safe-area-inset-bottom, 0px))' }}
      >

        {/* Instructions */}
        {dbTemplate?.instructions && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-4"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-sm leading-6 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
              {dbTemplate.instructions}
            </p>
          </motion.div>
        )}

        {/* Image inputs */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className={`grid gap-3 ${inputs.filter(i => i.type === 'image').length === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}
        >
          {inputs
            .filter((i) => i.type === 'image')
            .map((input) => (
              <ImageSlot
                key={input.key}
                label={input.label}
                hint={input.hint}
                value={imageValues[input.key] || null}
                onChange={(val) => setImageValues((prev) => ({ ...prev, [input.key]: val }))}
                onRemove={() => setImageValues((prev) => ({ ...prev, [input.key]: null }))}
              />
            ))}
        </motion.div>

        {/* Mode selector */}
        {modes.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ModeSelector
              modes={modes}
              value={selectedMode}
              onChange={setSelectedMode}
            />
          </motion.div>
        )}

      </div>

      {/* ── Generate button ── */}
      <div
        className="fixed left-0 right-0 px-4 pt-3"
        style={{
          bottom:        'calc(56px + env(safe-area-inset-bottom, 0px))',
          background:    'var(--bg-primary)',
          borderTop:     '1px solid var(--border-color)',
          paddingBottom: '12px',
        }}
      >
        <div className="mx-auto max-w-xl">
          <button
            onClick={handleGenerate}
            disabled={!canGenerate}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{
              background: 'var(--text-primary)',
              color:      'var(--text-inverse)',
              opacity:    !canGenerate ? 0.5 : 1,
            }}
          >
            <Zap size={15} fill="currentColor" />
            {submitting
              ? 'Generating…'
              : !canAfford
              ? 'Not enough credits'
              : `Generate · ${creditCost} cr`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button
                onClick={() => navigate('/profile')}
                className="font-semibold"
                style={{ color: 'var(--text-primary)' }}
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
