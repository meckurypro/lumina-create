// src/pages/public/PhotoPolishLandingPage.jsx
//
// Public, unauthenticated landing page for Photo Polish — indexable so
// Google can match searches like "AI photo enhancer", "cinematic headshot
// AI", "turn photo into face reference" to this feature, instead of only
// /create/photo-polish which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, RotateCcw, Aperture, ShieldCheck } from 'lucide-react'

const ACCENT     = 'var(--tool-polish)'
const ACCENT_SUB = 'var(--tool-polish-subtle)'
const ACCENT_BDR = 'var(--tool-polish-border)'

const PRESETS = [
  {
    icon: Aperture,
    title: 'Face Shot',
    body: 'Pull a tight, cinematic face reference straight out of any photo — sharp, well-lit, ready for character work.',
  },
  {
    icon: RotateCcw,
    title: 'Face 90° & ¾ turns',
    body: 'Rotate a front-facing photo into a side profile or three-quarter angle without re-shooting anything.',
  },
  {
    icon: Sparkles,
    title: 'Style presets',
    body: 'A growing library of enhancement presets for different looks and use cases, beyond just face references.',
  },
]

const FEATURES = [
  { icon: ShieldCheck, label: 'Identity stays locked',   body: 'Skin tone, facial structure, and every distinguishing feature are preserved exactly — this edits the photo, it doesn\'t generate a new person.' },
  { icon: Sparkles,     label: 'Before / after compare',  body: 'Drag to compare your original photo against the polished result before you commit to it.' },
  { icon: Aperture,     label: '2K output',               body: 'Results are upscaled to high resolution with photographic sharpness and detail.' },
]

const FAQS = [
  {
    q: 'Will Photo Polish change how the person looks?',
    a: 'No. Every preset is built to preserve the exact person — skin tone, facial structure, hair, and any distinguishing features stay unchanged. This edits the existing photo rather than generating a new likeness.',
  },
  {
    q: 'What is a "Face Shot" preset used for?',
    a: 'It extracts a tight, sharp, cinematic face reference from any photo — useful as a character reference or profile image.',
  },
  {
    q: 'Can I rotate a face without taking a new photo?',
    a: 'Yes — the Face 90° and Face ¾ presets rotate an existing front-facing photo to a side or three-quarter angle.',
  },
  {
    q: 'Can I compare the result to my original photo?',
    a: 'Yes, a drag-to-compare view shows the before and after side by side once your polish is complete.',
  },
]

export default function PhotoPolishLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Photo Polish — AI Photo Enhancement | Meckury AI'

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
      'Photo Polish enhances any photo with AI — extract a cinematic face reference, rotate an angle, or apply a style preset, all while keeping the person\'s identity exactly the same.'
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
          One photo → polished reference
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Turn any photo into a <span style={{ color: ACCENT }}>cinematic reference</span>
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Extract a sharp face reference, rotate an angle, or enhance a photo entirely —
          without changing who's in it.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try Photo Polish <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Presets ─────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Popular presets
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {PRESETS.map((p, i) => (
            <motion.div
              key={p.title}
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
                <p.icon size={18} style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{p.title}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{p.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Built to protect identity
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
          Get a reference-ready photo in seconds
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try Photo Polish <ArrowRight size={15} />
        </button>
      </div>

    </div>
  )
}

