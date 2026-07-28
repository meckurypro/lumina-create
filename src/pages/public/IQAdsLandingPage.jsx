// src/pages/public/IQAdsLandingPage.jsx
//
// Public, unauthenticated landing page for IQ Ads — indexable so Google can
// match searches like "flyer to video ad", "AI ad generator Nigeria",
// "turn flyer into video ad" to this feature, instead of only /create/iq-ads
// which sits behind auth.
//
// Sets its own <title>/meta description (no react-helmet in this codebase —
// mutates document.head directly on mount, matches the lightweight pattern
// used elsewhere in this app).
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, ImagePlus, Wand2, Video, Users, Building2, PartyPopper, MessageCircle } from 'lucide-react'
import { FeaturesFooter } from '@/components/public/FeaturesFooter'

const ACCENT     = 'var(--tool-iqads, #f97316)'
const ACCENT_SUB = 'var(--tool-iqads-subtle, var(--bg-elevated))'
const ACCENT_BDR = 'var(--tool-iqads-border, var(--border-color))'

const WHATSAPP_NUMBER = '2348162465247'
const waLink = (text) => `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`

const STEPS = [
  {
    icon: ImagePlus,
    title: 'Upload your flyer',
    body: 'Any flyer works — one you made yourself, designed in Canva, or got from your usual designer.',
  },
  {
    icon: Wand2,
    title: 'Tell it the vibe (optional)',
    body: 'Add a line of direction if you want a specific scene or story. Leave it blank and it figures out the rest.',
  },
  {
    icon: Video,
    title: 'Get a cinematic video ad',
    body: 'A short, scroll-stopping video ad built from your flyer — ready to post, ready to run.',
  },
]

const USE_CASES = [
  { icon: Building2,   label: 'Product or service flyers', body: 'Restaurants, salons, shops, services — anything you\'d normally print or post as a flat image.' },
  { icon: PartyPopper,  label: 'Event flyers',              body: 'Church programs, parties, launches — the video keeps whoever\'s already in your flyer.' },
  { icon: Users,        label: 'With or without people',    body: 'Add an AI-generated presenter, upload a real photo, or skip a human entirely.' },
]

const FAQS = [
  {
    q: 'Do I need design skills to use IQ Ads?',
    a: 'No. If you already have a flyer — made in this app, Canva, ChatGPT, or by a designer — that\'s all you need. IQ Ads turns the flat image into a moving video ad.',
  },
  {
    q: 'What if I don\'t have a flyer yet?',
    a: 'Message the IQ Ads creative team directly on WhatsApp and they\'ll design one for you before turning it into a video.',
  },
  {
    q: 'Can the ad include a person talking about my product?',
    a: 'Yes. Choose an AI-generated presenter or upload a real photo of someone to feature. Event flyers skip this since people are usually already in the flyer.',
  },
  {
    q: 'How long is the finished video?',
    a: 'You choose the length before generating — shorter clips for quick social posts, longer ones for a fuller story.',
  },
]

export default function IQAdsLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'IQ Ads — Turn Any Flyer Into a Video Ad | Meckury AI'

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
      'IQ Ads turns any flyer into a cinematic video ad in minutes. Upload a flyer, add optional direction, and get a scroll-stopping AI video ad — built for Nigerian SMBs.'
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
          Flyer → Video, in minutes
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Turn any flyer into a cinematic <span style={{ color: ACCENT }}>video ad</span>
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          You already made the flyer. IQ Ads turns it into a moving, scroll-stopping video ad —
          no camera, no editing software, no video team.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 mt-2">
          <button
            onClick={() => navigate('/auth')}
            className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{ background: ACCENT, color: '#fff' }}
          >
            Turn your flyer into a video <ArrowRight size={15} />
          </button>
          <a
            href={waLink("Hi! I don't have a flyer yet and I'd like IQ Ads to design one for me.")}
            target="_blank" rel="noreferrer"
            className="flex items-center gap-2 px-5 py-3.5 rounded-2xl text-sm font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
          >
            <MessageCircle size={15} /> Don't have a flyer? Talk to us
          </a>
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-10" style={{ color: 'var(--text-primary)' }}>
          How IQ Ads works
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
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                {step.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>

      {/* ── Use cases ───────────────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-4 lg:px-8 py-12">
        <h2 className="text-xl lg:text-2xl font-black text-center mb-2" style={{ color: 'var(--text-primary)' }}>
          Built for how Nigerian SMBs already advertise
        </h2>
        <p className="text-sm text-center mb-10" style={{ color: 'var(--text-muted)' }}>
          If you'd normally post a flyer, IQ Ads gives you a video version of it instead.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {USE_CASES.map((u) => (
            <div
              key={u.label}
              className="flex flex-col gap-3 p-5 rounded-2xl"
              style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
            >
              <u.icon size={18} style={{ color: ACCENT }} />
              <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{u.label}</p>
              <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{u.body}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── FAQ (also gives Google direct answers to match long-tail queries) ── */}
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
          Your next ad doesn't need a camera crew
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Get started with IQ Ads <ArrowRight size={15} />
        </button>
      </div>

      <FeaturesFooter />

    </div>
  )
}
