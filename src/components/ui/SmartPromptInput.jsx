// src/components/ui/SmartPromptInput.jsx
import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Send, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

const SYSTEM_PROMPT = `You are an AI content creation assistant for Meckury. Resolve the best generation type, settings, and enhanced prompt. Return ONLY JSON with type, templateSlug, enhanced_prompt, aspect_ratio, duration, model, reasoning.`

const fallbackResolve = (prompt, uploadedFiles) => {
  const lower = prompt.toLowerCase()
  let type = lower.includes('image') || lower.includes('portrait') ? 'text_to_image' : 'text_to_video'
  let templateSlug = null
  if (lower.includes('handover') || lower.includes('transition') || lower.includes('take over')) {
    type = 'template'; templateSlug = 'office-handover'
  } else if (lower.includes('memory') || lower.includes('slideshow') || lower.includes('photos')) {
    type = 'template'; templateSlug = 'memory-lane'
  } else if (uploadedFiles.length >= 2) type = 'start_end_frame'
  else if (uploadedFiles.length === 1) type = 'image_to_video'
  return { type, templateSlug, enhanced_prompt: prompt, aspect_ratio: '9:16', duration: '5', model: 'kling_2_5', reasoning: '' }
}

export const SmartPromptInput = ({ onConfirm }) => {
  const [prompt,        setPrompt]        = useState('')
  const [thinking,      setThinking]      = useState(false)
  const [resolution,    setResolution]    = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const fileInputRef = useRef(null)

  const resolve = async () => {
    if (!prompt.trim()) return toast.error('Describe what you want to create')
    setThinking(true)
    setResolution(null)
    try {
      const anthropicKey = import.meta.env.VITE_ANTHROPIC_KEY
      let resolved
      if (anthropicKey) {
        const userMessage = uploadedFiles.length > 0
          ? `${prompt}\n\n(User uploaded ${uploadedFiles.length} image${uploadedFiles.length > 1 ? 's' : ''})`
          : prompt
        const response = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type':    'application/json',
            'x-api-key':       anthropicKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model:      'claude-sonnet-4-20250514',
            max_tokens: 500,
            system:     SYSTEM_PROMPT,
            messages:   [{ role: 'user', content: userMessage }],
          }),
        })
        const data = await response.json()
        resolved = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim())
      } else {
        resolved = fallbackResolve(prompt, uploadedFiles)
      }
      resolved.uploadedImages = uploadedFiles
      setResolution(resolved)
    } catch (err) {
      console.error('Smart resolve failed:', err)
      toast.error('Something went wrong. Try again.')
    } finally {
      setThinking(false)
    }
  }

  const handleFiles = (files) => {
    const valid = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (uploadedFiles.length + valid.length > 2) return toast.error('Maximum 2 files')
    setUploadedFiles((prev) => [...prev, ...valid].slice(0, 2))
    setResolution(null)
  }

  return (
    <div className="flex flex-col gap-3">

      {/* Uploaded previews */}
      {uploadedFiles.length > 0 && (
        <div className="flex gap-2">
          {uploadedFiles.map((file, i) => (
            <div key={`${file.name}-${i}`} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl">
              <img
                src={URL.createObjectURL(file)}
                alt={`Upload ${i + 1}`}
                className="h-full w-full object-cover"
              />
              <button
                onClick={() => { setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i)); setResolution(null) }}
                className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full"
                style={{ background: 'rgba(0,0,0,0.7)' }}
              >
                <X size={10} style={{ color: 'white' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input box */}
      <div
        className="overflow-hidden rounded-2xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <textarea
          value={prompt}
          onChange={(e) => { setPrompt(e.target.value); setResolution(null) }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); resolve() } }}
          placeholder="Describe what you want to create…"
          rows={3}
          className="w-full resize-none bg-transparent px-4 pb-2 pt-4 text-sm outline-none"
          style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}
        />
        <div className="flex items-center justify-between px-3 pb-3 pt-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}
          >
            <Upload size={12} />
            {uploadedFiles.length ? `${uploadedFiles.length} file${uploadedFiles.length > 1 ? 's' : ''}` : 'Add media'}
          </button>

          <button
            onClick={resolve}
            disabled={!prompt.trim() || thinking}
            className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40"
            style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
          >
            {thinking
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} />
            }
            {thinking ? 'Thinking…' : 'Send'}
          </button>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* Resolution result */}
      <AnimatePresence>
        {resolution && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className="rounded-2xl overflow-hidden"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <div className="px-4 py-3">
              <p className="text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }}>
                {resolution.enhanced_prompt}
              </p>
            </div>
            <div className="px-4 pb-4">
              <button
                onClick={() => onConfirm(resolution)}
                className="flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
              >
                <Send size={14} />
                Continue
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
