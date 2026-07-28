// src/pages/public/ImageLandingPage.jsx
//
// Public, unauthenticated landing page for the image generation tool —
// indexable so Google can match searches like "AI image generator",
// "text to image AI", "AI image generator with reference photo" to this
// feature, instead of only /create/image which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Type, ImagePlus, Layers, Maximize, Sparkles, Palette } from 'lucide-react'
import { FeaturesFooter } from '@/components/public/FeaturesFooter'
const ACCENT     = 'var(--tool-image)'
const ACCENT_SUB = 'var(--tool-image-subtle)'
const ACCENT_BDR = 'var(--tool-image-border)'

const MODES = [
  {
    icon: Type,
    title: 'Text to image',
    body: 'Describe what you want to see and get a finished image — no reference required.',
  },
  {
    icon: ImagePlus,
    title: 'Image to image',
    body: 'Upload a reference photo and guide the AI to transform, restyle, or reimagine it.',
  },
  {
    icon: Layers,
    title: 'Multi-reference scenes',
    body: 'Combine up to four reference images in one prompt — a person, a product, a location — placed exactly where you describe.',
  },
]

const FEATURES = [
  { icon: Maximize, label: 'Any aspect ratio', body: '9:16 for stories and Reels, 16:9 for landscape, 1:1 for feed posts.' },
  { icon: Sparkles, label: 'Multiple quality tiers', body: 'Choose the resolution that fits your use case, from quick drafts to print-ready output.' },
  { icon: Palette,  label: 'Tag characters and brands', body: 'Reference your saved characters, brand logos, or products directly in the prompt using simple tags.' },
]

const FAQS = [
  {
    q: 'Do I need a reference photo to generate an image?',
    a: 'No. Text-to-image works from a written description alone. A reference photo is only needed if you want to guide the output from an existing image.',
  },
  {
    q: 'Can I use more than one reference image at once?',
    a: 'Yes, with models that support multi-reference generation. You can tag each image in your prompt to control exactly how it\'s used.',
  },
  {
    q: 'What image sizes and ratios are supported?',
    a: '9:16, 16:9, and 1:1 are all supported, with resolution options depending on the model you choose.',
  },
  {
    q: 'Can I use a character or brand logo I\'ve already saved?',
    a: 'Yes — saved characters and brand assets can be tagged directly into your prompt instead of re-uploading them each time.',
  },
]

export default function ImageLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'AI Image Generator — Text & Reference to Image | Meckury AI'

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
      'Generate AI images from text or a reference photo. Meckury AI\'s image generator supports multi-reference scenes, saved characters and brands, and every major aspect ratio.'
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
          style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
        >
          Text or reference → image
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Generate images from a <span style={{ color: ACCENT }}>sentence or a photo</span>
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Describe exactly what you want, or start from a reference image and reshape it.
          Combine people, products, and brands in a single scene.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Start generating images <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Modes ───────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Three ways to start
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {MODES.map((mode, i) => (
            <motion.div
              key={mode.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="flex flex-col gap-3 p-5 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <mode.icon size={18} style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{mode.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{mode.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Built for real content workflows
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div
              key={f.label}
              className="flex flex-col gap-3 p-5 rounded-2xl"
              style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
            >
              <f.icon size={18} style={{ color: ACCENT }} />
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
          Your next image starts with one prompt
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try the image generator <ArrowRight size={15} />
        </button>
      </div>
<FeaturesFooter />
    </div>
  )
}

