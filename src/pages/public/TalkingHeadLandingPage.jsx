// src/pages/public/TalkingHeadLandingPage.jsx
//
// Public, unauthenticated landing page for the Talking Head / lipsync tool —
// indexable so Google can match searches like "AI talking avatar",
// "lip sync video generator", "make a photo talk AI" to this feature,
// instead of only /create/talking-head which sits behind auth.
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, User, VideoIcon, Mic, FileText, Users, Languages } from 'lucide-react'

const ACCENT     = 'var(--tool-talking-head)'
const ACCENT_SUB = 'var(--tool-talking-head-subtle)'
const ACCENT_BDR = 'var(--tool-talking-head-border)'

const MODES = [
  {
    icon: User,
    title: 'Photo to talking avatar',
    body: 'Upload a single photo and turn it into a talking, expressive avatar synced to your audio or script.',
  },
  {
    icon: VideoIcon,
    title: 'Video lip sync',
    body: 'Already have a video? Sync new speech onto it while keeping the original motion and performance.',
  },
  {
    icon: FileText,
    title: 'Script to voice',
    body: 'Type a script instead of recording audio — the AI converts your text to natural speech and syncs it automatically.',
  },
]

const FEATURES = [
  { icon: Mic,        label: 'Upload or generate audio', body: 'Bring your own recording, or use a saved voice generation from your library.' },
  { icon: Users,       label: 'Multi-character sync',    body: 'Some models support two characters speaking in the same scene, each with their own audio.' },
  { icon: Languages,   label: 'Any language your audio uses', body: 'Lip sync follows whatever audio or script you provide — no language lock-in.' },
]

const FAQS = [
  {
    q: 'Do I need to record my own voice?',
    a: 'No. You can upload an audio file, reuse a previous voice generation, or type a script and let the AI generate the speech for you.',
  },
  {
    q: 'Can I make a photo talk without any video?',
    a: 'Yes — the photo-to-avatar mode only needs a single face photo plus your audio or script.',
  },
  {
    q: 'Can two people talk in the same video?',
    a: 'Certain models support two-character sync, letting each character speak with their own separate audio track.',
  },
  {
    q: 'What if my audio is longer than the video duration?',
    a: 'Audio is automatically trimmed to fit your selected video duration, and you can choose exactly which part of the audio to keep.',
  },
]

export default function TalkingHeadLandingPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const prevTitle = document.title
    document.title = 'AI Talking Avatar & Lip Sync Generator | Meckury AI'

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
      'Turn a photo or video into a talking, lip-synced character with Meckury AI. Upload audio or type a script — supports photo-to-avatar, video lip sync, and multi-character scenes.'
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
          Photo or video → talking character
        </div>

        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="text-3xl lg:text-5xl font-black leading-tight"
          style={{ color: 'var(--text-primary)' }}
        >
          Make any photo <span style={{ color: ACCENT }}>talk</span>
        </motion.h1>

        <p className="text-base lg:text-lg max-w-xl" style={{ color: 'var(--text-muted)' }}>
          Upload a face, add audio or a script, and get a lip-synced talking video —
          no camera, no filming, no actor needed.
        </p>

        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Create a talking avatar <ArrowRight size={15} />
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
          Flexible enough for real scripts
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
          Give any photo a voice
        </h2>
        <button
          onClick={() => navigate('/auth')}
          className="flex items-center gap-2 px-6 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
          style={{ background: ACCENT, color: '#fff' }}
        >
          Try Talking Head <ArrowRight size={15} />
        </button>
      </div>

    </div>
  )
}
