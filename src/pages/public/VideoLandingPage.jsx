// src/pages/public/VideoLandingPage.jsx
//
// Public, unauthenticated landing page for the video generation tool —
// indexable so Google can match searches like "image to video AI",
// "text to video generator", "AI video generator online" to this feature,
// instead of only /create/video which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ImagePlus, Type, Layers, Volume2, Clapperboard, Sparkles } from 'lucide-react'
import FeaturesFooter from '@/components/public/FeaturesFooter'
const ACCENT     = 'var(--tool-video)'
const ACCENT_SUB = 'var(--tool-video-subtle)'
const ACCENT_BDR = 'var(--tool-video-border)'

const MODES = [
  {
    icon: Type,
    title: 'Text to video',
    body: 'Describe a scene in plain language and get a moving video — no footage needed to start.',
  },
  {
    icon: ImagePlus,
    title: 'Image to video',
    body: 'Upload a photo as your starting frame and bring it to life with motion, camera moves, and action.',
  },
  {
    icon: Layers,
    title: 'Start + end frame',
    body: 'Give it a beginning and an end image — the AI generates everything that happens in between.',
  },
]

const FEATURES = [
  { icon: Clapperboard, label: 'Multiple aspect ratios', body: '9:16 for Reels and TikTok, 16:9 for YouTube, 1:1 for feed posts.' },
  { icon: Volume2,       label: 'Sound built in',         body: 'Generate video with native sound where the model supports it — no separate audio pass.' },
  { icon: Sparkles,      label: 'Multi-reference scenes',  body: 'Tag multiple reference images in one prompt to place characters, products, or logos exactly where you want them.' },
]

const FAQS = [
  {
    q: 'Do I need a video of my own to start?',
    a: 'No. Text-to-video needs nothing but a written description. Image-to-video needs a single photo.',
  },
  {
    q: 'What\'s the difference between image-to-video and start + end frame?',
    a: 'Image-to-video animates outward from one photo. Start + end frame locks both the beginning and the ending image, and the AI fills in the motion between them.',
  },
  {
    q: 'Can I control how long the video is?',
    a: 'Yes — pick from the duration options available for your chosen model before generating.',
  },
  {
    q: 'Will the video have sound?',
    a: 'You can turn sound on or off for models that support it. Silent generations are also available for every model.',
  },
]

export default function VideoLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'AI Video Generator — Text & Image to Video | Meckury AI'

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
      'Generate AI video from text or a single image. Meckury AI\'s video generator supports text-to-video, image-to-video, and start-to-end frame generation with native sound.'
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
          Text or image → video
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Generate video from a <span style={{ color: ACCENT }}>sentence or a photo</span>
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Describe a scene, or bring a still image to life. Meckury's video generator turns
          either into a finished clip — with camera motion, action, and sound.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Start generating video <ArrowRight size={15} />
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
          Made for how you actually post
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
          Your next video starts with one prompt
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try the video generator <ArrowRight size={15} />
        </button>
      </div>
<FeaturesFooter />
    </div>
  )
}

