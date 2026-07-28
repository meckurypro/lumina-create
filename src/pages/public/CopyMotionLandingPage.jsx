// src/pages/public/CopyMotionLandingPage.jsx
//
// Public, unauthenticated landing page for Copy Motion (motion transfer) —
// indexable so Google can match searches like "motion transfer AI",
// "copy dance moves to photo AI", "animate a photo with reference video"
// to this feature, instead of only /create/copy-motion which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Film, ImageIcon, Wand2, Scissors, Ratio, Clock } from 'lucide-react'
import { FeaturesFooter } from '@/components/public/FeaturesFooter'

const ACCENT     = 'var(--tool-motion)'
const ACCENT_SUB = 'var(--tool-motion-subtle)'
const ACCENT_BDR = 'var(--tool-motion-border)'

const STEPS = [
  {
    icon: Film,
    title: 'Upload a motion video',
    body: 'Any reference clip with movement you like — a dance, a walk, a gesture, a pose change.',
  },
  {
    icon: ImageIcon,
    title: 'Upload your subject photo',
    body: 'The person or character you want to bring that motion onto.',
  },
  {
    icon: Wand2,
    title: 'Get the motion copied onto your photo',
    body: 'The AI transfers the movement from the reference video onto your subject, as a new video.',
  },
]

const FEATURES = [
  { icon: Scissors, label: 'Automatic trimming',   body: 'Videos are automatically converted to match your model\'s supported duration — no separate editing tool needed.' },
  { icon: Ratio,     label: 'Aspect ratio matching', body: 'Reference clips are cropped and converted to match the aspect ratio you\'re generating in.' },
  { icon: Clock,      label: 'Frame-accurate trim control', body: 'Pick exactly which section of a longer reference video to use before generating.' },
]

const FAQS = [
  {
    q: 'What kind of motion video works best?',
    a: 'Clear, well-lit clips with a single visible subject work best — dances, walks, gestures, and pose changes all transfer well.',
  },
  {
    q: 'Does my reference video need to match the output aspect ratio?',
    a: 'No — mismatched videos are automatically converted to fit your selected aspect ratio and duration before generating.',
  },
  {
    q: 'What if my reference video is longer than the model supports?',
    a: 'You can pick exactly which section of the video to use, then it\'s trimmed to that range automatically.',
  },
  {
    q: 'Can I add sound to the result?',
    a: 'Sound is available on models that support it — toggle it on or off before generating.',
  },
]

export default function CopyMotionLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'Copy Motion — AI Motion Transfer | Meckury AI'

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
      'Copy Motion transfers movement from any reference video onto your photo with AI. Upload a motion clip and a subject image to get a new video with the motion copied over.'
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
          Motion video + photo → new video
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Copy any <span style={{ color: ACCENT }}>motion</span> onto your photo
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Show it a movement — a dance, a walk, a gesture — and Copy Motion transfers that
          motion onto your own subject photo, as a brand new video.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try Copy Motion <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Steps ───────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {STEPS.map((step, i) => (
            <motion.div
              key={step.title}
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
                <step.icon size={18} style={{ color: ACCENT }} />
              </div>
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                {i + 1}. {step.title}
              </p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{step.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Handles the messy parts for you
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
          Give your photo someone else's moves
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try Copy Motion <ArrowRight size={15} />
        </button>
      </div>

      <FeaturesFooter />

    </div>
  )
          }
