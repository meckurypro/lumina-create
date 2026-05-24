import { useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ChevronDown, Loader2, Send, Sparkles, Upload, X } from 'lucide-react'
import toast from 'react-hot-toast'

const SYSTEM_PROMPT = `You are an AI content creation assistant for Meckury. Resolve the best generation type, settings, and enhanced prompt. Return ONLY JSON with type, templateSlug, enhanced_prompt, aspect_ratio, duration, model, reasoning.`
const SUGGESTIONS = [
  { label: '🎬 Office Handover', text: 'Create a cinematic office handover transition between two leaders' },
  { label: '📸 Memory Lane', text: 'Turn my photos into a beautiful memory lane video' },
  { label: '🇳🇬 Nigerian Leaders', text: 'Create a transition video of Nigerian leaders from 1960 to present' },
  { label: '🎵 Dancing video', text: 'Make a fun dancing video from my photo' },
  { label: '🖼 AI Portrait', text: 'Generate a cinematic AI portrait of a Nigerian businessman in a modern office' },
]

const fallbackResolve = (prompt, uploadedFiles) => {
  const lower = prompt.toLowerCase()
  let type = lower.includes('image') || lower.includes('portrait') ? 'text_to_image' : 'text_to_video'
  let templateSlug = null
  if (lower.includes('handover') || lower.includes('transition') || lower.includes('take over')) { type = 'template'; templateSlug = 'office-handover' }
  else if (lower.includes('memory') || lower.includes('slideshow') || lower.includes('photos')) { type = 'template'; templateSlug = 'memory-lane' }
  else if (uploadedFiles.length >= 2) type = 'start_end_frame'
  else if (uploadedFiles.length === 1) type = 'image_to_video'
  return { type, templateSlug, enhanced_prompt: prompt, aspect_ratio: '9:16', duration: '5', model: 'kling_2_5', reasoning: 'Resolved with local heuristics.' }
}

export const SmartPromptInput = ({ onConfirm }) => {
  const [prompt, setPrompt] = useState('')
  const [thinking, setThinking] = useState(false)
  const [resolution, setResolution] = useState(null)
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [showReasoning, setShowReasoning] = useState(false)
  const fileInputRef = useRef(null)

  const resolve = async () => {
    if (!prompt.trim()) return toast.error('Tell me what you want to create')
    setThinking(true)
    setResolution(null)
    try {
      const anthropicKey = import.meta.env.VITE_ANTHROPIC_KEY
      let resolved
      if (anthropicKey) {
        const userMessage = uploadedFiles.length > 0 ? `${prompt}\n\n(User uploaded ${uploadedFiles.length} image${uploadedFiles.length > 1 ? 's' : ''})` : prompt
        const response = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 500, system: SYSTEM_PROMPT, messages: [{ role: 'user', content: userMessage }] }) })
        const data = await response.json()
        resolved = JSON.parse((data.content?.[0]?.text || '').replace(/```json|```/g, '').trim())
      } else resolved = fallbackResolve(prompt, uploadedFiles)
      resolved.uploadedImages = uploadedFiles
      setResolution(resolved)
    } catch (err) {
      console.error('Smart resolve failed:', err)
      toast.error('Could not analyse your prompt. Try again.')
    } finally { setThinking(false) }
  }

  const handleFiles = (files) => {
    const valid = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (uploadedFiles.length + valid.length > 2) return toast.error('Maximum 2 images for Smart Create')
    setUploadedFiles((prev) => [...prev, ...valid].slice(0, 2)); setResolution(null)
  }
  const typeLabel = { text_to_image: 'Text → Image', image_to_image: 'Image → Image', text_to_video: 'Text → Video', image_to_video: 'Image → Video', start_end_frame: 'Start + End Frame', end_frame_text: 'End Frame + Text', template: 'Template' }[resolution?.type] ?? resolution?.type
  return <div className="flex flex-col gap-4">{uploadedFiles.length > 0 && <div className="flex gap-2">{uploadedFiles.map((file, i) => <div key={`${file.name}-${i}`} className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl"><img src={URL.createObjectURL(file)} alt={`Upload ${i + 1}`} className="h-full w-full object-cover" /><button onClick={() => { setUploadedFiles((prev) => prev.filter((_, idx) => idx !== i)); setResolution(null) }} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/70 text-white"><X size={10} /></button><div className="absolute bottom-0.5 left-0.5 rounded bg-black/60 px-1 text-[9px] font-bold text-white">{i === 0 ? 'START' : 'END'}</div></div>)}</div>}<div className="overflow-hidden rounded-3xl" style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)' }}><textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setResolution(null) }} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); resolve() } }} placeholder="Describe what you want to create…" rows={3} className="w-full resize-none bg-transparent px-4 pb-2 pt-4 text-sm outline-none" style={{ color: 'var(--text-primary)', lineHeight: 1.6 }} /><div className="flex items-center justify-between px-3 pb-3 pt-1"><div className="flex items-center gap-2"><button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold" style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}><Upload size={12} />{uploadedFiles.length ? `${uploadedFiles.length} images` : 'Add images'}</button><span className="text-xs" style={{ color: 'var(--text-muted)' }}>optional</span></div><button onClick={resolve} disabled={!prompt.trim() || thinking} className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-40 brand-gradient text-primary-foreground" style={{ fontFamily: 'Syne, sans-serif' }}>{thinking ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{thinking ? 'Thinking…' : 'Analyse'}</button></div></div><input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} />{!resolution && !thinking && <div className="flex flex-wrap gap-2">{SUGGESTIONS.map((s) => <button key={s.label} onClick={() => { setPrompt(s.text); setResolution(null) }} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>{s.label}</button>)}</div>}<AnimatePresence>{resolution && <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="overflow-hidden rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid rgba(249,115,22,0.3)' }}><div className="flex items-center justify-between px-4 py-3" style={{ background: 'rgba(249,115,22,0.06)', borderBottom: '1px solid rgba(249,115,22,0.15)' }}><div className="flex items-center gap-2"><Sparkles size={14} style={{ color: 'var(--brand)' }} /><span className="text-xs font-bold" style={{ color: 'var(--brand)', fontFamily: 'Syne, sans-serif' }}>AI resolved</span></div><span className="rounded-full px-2 py-0.5 text-xs font-semibold" style={{ background: 'var(--bg-elevated)' }}>{resolution.templateSlug || typeLabel}</span></div><div className="space-y-3 p-4"><p className="text-sm" style={{ color: 'var(--text-primary)' }}>{resolution.enhanced_prompt}</p><button onClick={() => setShowReasoning((v) => !v)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-muted)' }}><ChevronDown size={12} />Why this?</button>{showReasoning && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{resolution.reasoning}</p>}<button onClick={() => onConfirm(resolution)} className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold brand-gradient text-primary-foreground"><Send size={14} />Continue</button></div></motion.div>}</AnimatePresence></div>
}
