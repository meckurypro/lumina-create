// src/pages/public/UpscalerLandingPage.jsx
//
// Public, unauthenticated landing page for the Image + Video Upscaler
// tools, combined as one feature story — indexable so Google can match
// searches like "AI video upscaler", "AI image upscaler online",
// "increase video resolution AI" to this feature, instead of only
// /create/image-upscaler and /create/video-upscaler which sit behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ImageIcon, VideoIcon, Gauge, ScanLine, Layers } from 'lucide-react'

const ACCENT     = 'var(--tool-polish)'
const ACCENT_SUB = 'var(--tool-polish-subtle)'
const ACCENT_BDR = 'var(--tool-polish-border)'
const ACCENT2     = 'var(--tool-motion)'
const ACCENT2_SUB = 'var(--tool-motion-subtle)'
const ACCENT2_BDR = 'var(--tool-motion-border)'

const MODES = [
  {
    icon: ImageIcon,
    title: 'Image Upscaler',
    body: 'Upload any image and enlarge it to a higher resolution with sharper detail — no prompt needed.',
    accent: ACCENT, sub: ACCENT_SUB, bdr: ACCENT_BDR,
  },
  {
    icon: VideoIcon,
    title: 'Video Upscaler',
    body: 'Upload a video and enhance its clarity and sharpness at a higher resolution, frame by frame.',
    accent: ACCENT2, sub: ACCENT2_SUB, bdr: ACCENT2_BDR,
  },
]

const FEATURES = [
  { icon: Gauge,    label: 'Multiple resolution tiers', body: 'Choose the output resolution that fits your use case, from quick previews to high-detail final exports.' },
  { icon: ScanLine, label: 'No prompt required',         body: 'Just upload your file and pick a resolution — there\'s nothing to describe or direct.' },
  { icon: Layers,    label: 'Works from any source',      body: 'Old photos, low-res exports, compressed downloads — upscale whatever you already have.' },
]

const FAQS = [
  {
    q: 'Do I need to write a prompt to upscale something?',
    a: 'No. Upscaling is prompt-free — you just upload the file and choose your target resolution.',
  },
  {
    q: 'Can I upscale both photos and videos?',
    a: 'Yes — there are separate Image and Video upscaler tools, each optimized for their file type.',
  },
  {
    q: 'What resolutions are available?',
    a: 'Available resolution tiers depend on the model, and are shown as selectable options before you upscale.',
  },
  {
    q: 'Is there a file size limit for videos?',
    a: 'Yes, videos are capped at a maximum file size before upload — the tool will tell you if your file is too large.',
  },
]

export default function UpscalerLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'AI Image & Video Upscaler | Meckury AI'

    const setMeta = (name, content) => {
      let tag = document.querySelector(`meta[name="${name}"]`)
      if (!tag) {
        tag = document.createElement('meta')
        tag.setAttribute('name', name)
        document.head.appendChild(tag)
      }
      tag.setAttribute('content', content)
    }

    setMeta(
      'description',
      'Upscale any image or video with AI. Meckury AI enhances resolution and sharpness with no prompt required — just upload and choose your target quality.'
    )

    return () => { document.title = prevTitle }
  }, [])

  return (
    <div className="min-h-dvh" style={{ background: 'var(--bg-primary)' }}>

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 lg:px-8 h-16 max-w-5xl mx-auto">
        <button onClick={() => navigate('/')} className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Meckury AI
        </button>
        <button
          onClick={() => navigate('/auth')}
          className="px-4 py-2 rounded-xl text-sm font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
        >
          Sign in
        </button>
      </div>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 lg:px-8 pt-10 pb-16 text-center flex flex-col items-center gap-6">
        <div
          className="px-3 py-1.5 rounded-full text-xs font-semibold"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
        >
          Sharper images. Sharper video.
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Upscale any photo or video with AI
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Enlarge and sharpen low-resolution images and video — no prompt, no editing
          software, just a higher-quality version of what you already have.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          Start upscaling <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Two modes ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Two dedicated tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="flex flex-col gap-3 p-6 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: mode.sub, border: `1px solid ${mode.bdr}` }}
              >
                <mode.icon size={20} style={{ color: mode.accent }} />
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{mode.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{mode.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Simple by design
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col gap-3 p-5 rounded-2xl"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
            >
              <f.icon size={18} style={{ color: 'var(--brand)' }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{f.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <div className="max-w-3xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-8" style={{ color: 'var(--text-primary)' }}>
          Common questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQS.map((f) => (
            <div
              key={f.q}
              className="p-5 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <p className="text-sm font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>{f.q}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{f.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Bottom CTA ──────────────────────────────────────────────── */}
      <div className="max-w-2xl mx-auto px-4 lg:px-8 py-16 text-center flex flex-col items-center gap-5">
        <h2 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          Get a sharper version in seconds
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: 'var(--brand)', color: '#fff' }}
        >
          Start upscaling <ArrowRight size={15} />
        </button>
      </div>

    </div>
  )
}

