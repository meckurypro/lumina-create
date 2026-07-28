// src/pages/public/UGCLandingPage.jsx
//
// Public, unauthenticated landing page for the UGC tool — covers both
// Characters and Brands sub-flows as one feature story. Indexable so
// Google can match searches like "AI UGC generator", "UGC video generator
// for brands", "AI content creator character" to this feature, instead of
// only /create/ugc which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, User, Building2, Mic, Package, ImageIcon, VideoIcon } from 'lucide-react'
import FeaturesFooter from '@/components/public/FeaturesFooter'
const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const PATHS = [
  {
    icon: User,
    title: 'UGC Characters',
    body: 'Build a reusable AI character from a handful of photos, then generate new scenes, outfits, and moments with them — as many times as you need.',
  },
  {
    icon: Building2,
    title: 'Brand Adviser',
    body: 'Set up your brand once — tone, colors, products — and generate on-brand content that automatically pulls in your logo and product photos.',
  },
]

const FEATURES = [
  { icon: ImageIcon,  label: 'Image or video output',   body: 'Every character or brand scene can be generated as a still image or a full video, with sound where supported.' },
  { icon: Mic,         label: 'Voice-matched audio',       body: 'Generate matching voice audio for your character and reuse it across future content.' },
  { icon: Package,     label: 'Product tagging',           body: 'Tag specific products or services directly in your prompt so brand content features exactly what you\'re promoting.' },
]

const FAQS = [
  {
    q: 'What\'s the difference between UGC Characters and Brand Adviser?',
    a: 'Characters is for building a reusable AI person you can put in any scene. Brand Adviser is for a business — it remembers your brand\'s tone, colors, logo, and products so every generation stays on-brand.',
  },
  {
    q: 'How many photos do I need to create a character?',
    a: 'A handful of clear photos of the same person from different angles is enough to build a consistent, reusable character.',
  },
  {
    q: 'Can I generate video content, not just images?',
    a: 'Yes — both Characters and Brand Adviser support image and video output, with optional sound.',
  },
  {
    q: 'Can I tag a specific product in a brand generation?',
    a: 'Yes. Once a product is added to your brand, you can tag it directly in your scene description and it will appear in the generated content.',
  },
]

export default function UGCLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'AI UGC Generator — Characters & Brand Content | Meckury AI'

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
      'Create reusable AI UGC characters or set up a brand profile for on-brand content generation. Meckury AI supports image and video output with voice, products, and logo tagging.'
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
          Reusable characters & on-brand content
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Build a UGC <span style={{ color: ACCENT }}>character</span> or brand — once
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Set up a person or a brand a single time, then generate unlimited new scenes,
          images, and videos with them — always consistent, always on-brand.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Start creating UGC content <ArrowRight size={15} />
        </button>
      </div>

      {/* ── Two paths ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Two ways to use UGC
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {PATHS.map((path, i) => (
            <motion.div
              key={path.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              className="flex flex-col gap-3 p-6 rounded-2xl"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
            >
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center"
                style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
              >
                <path.icon size={20} style={{ color: ACCENT }} />
              </div>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>{path.title}</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>{path.body}</p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Features ────────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          Everything content creators and brands need
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
          Set it up once. Generate forever.
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Create your first character or brand <ArrowRight size={15} />
        </button>
      </div>
<FeaturesFooter />
    </div>
  )
}
