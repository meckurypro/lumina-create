import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, ChevronDown, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const ACCENT     = 'var(--tool-ugc)'
const ACCENT_SUB = 'var(--tool-ugc-subtle)'
const ACCENT_BDR = 'var(--tool-ugc-border)'

const NICHES = [
  { value: 'content_creator', label: '🎬 Content Creator'  },
  { value: 'entrepreneur',    label: '💼 Entrepreneur'     },
  { value: 'educator',        label: '📚 Educator'         },
  { value: 'fitness',         label: '💪 Fitness'          },
  { value: 'lifestyle',       label: '✨ Lifestyle'        },
  { value: 'tech',            label: '⚙️ Tech'             },
  { value: 'fashion',         label: '👗 Fashion'          },
  { value: 'food',            label: '🍜 Food'             },
  { value: 'finance',         label: '💰 Finance'          },
  { value: 'general',         label: '🎙️ General'         },
]

const TONES = [
  { value: 'conversational', label: 'Conversational', desc: 'Like talking to a friend' },
  { value: 'narrative',      label: 'Storytelling',   desc: 'Rich, descriptive, immersive' },
  { value: 'educational',    label: 'Educational',    desc: 'Clear, structured, informative' },
  { value: 'energetic',      label: 'Energetic',      desc: 'High energy, punchy, bold' },
]

export default function ScriptGenerator({ onClose, onScriptReady }) {
  const [step,   setStep]   = useState('pick')   // 'pick' | 'loading' | 'script'
  const [niche,  setNiche]  = useState('')
  const [tone,   setTone]   = useState('')
  const [script, setScript] = useState('')
  const [error,  setError]  = useState(null)

  const canGenerate = niche && tone

  const generateScript = async () => {
    if (!canGenerate) return
    setStep('loading')
    setError(null)

    try {
      const { data, error } = await supabase.functions.invoke('elevenlabs-proxy', {
        body: { action: 'generate_clone_script', niche, tone },
      })

      if (error || !data?.script) throw new Error(error?.message || 'No script returned')

      setScript(data.script)
      setStep('script')
    } catch (err) {
      setError('Could not generate script. You can still record freely.')
      setStep('pick')
    }
  }

  const handleUseScript = () => {
    onScriptReady(script)
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)' }}
    >
      <motion.div
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{    y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        className="w-full rounded-t-3xl flex flex-col"
        style={{
          background: 'var(--bg-card)',
          maxWidth:   480,
          maxHeight:  '90dvh',
          border:     '1px solid var(--border-color)',
        }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full" style={{ background: 'var(--border-color)' }} />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 flex-shrink-0">
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
              {step === 'script' ? 'Your Script' : 'Tell me what to say'}
            </p>
            {step !== 'script' && (
              <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                We'll generate a script tailored to your style
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg" style={{ color: 'var(--text-muted)' }}>
            <X size={16} />
          </button>
        </div>

        {/* ── Pick step ── */}
        {step === 'pick' && (
          <div className="flex-1 overflow-y-auto px-4 pb-6">
            {error && (
              <div
                className="flex items-center gap-2 p-3 rounded-xl mb-4 text-xs"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                {error}
              </div>
            )}

            {/* Niche */}
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Your Niche
              </p>
              <div className="grid grid-cols-2 gap-2">
                {NICHES.map((n) => (
                  <button
                    key={n.value}
                    onClick={() => setNiche(n.value)}
                    className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs font-medium text-left transition-all"
                    style={{
                      background: niche === n.value ? ACCENT_SUB   : 'var(--bg-elevated)',
                      border:     `1px solid ${niche === n.value ? ACCENT_BDR : 'var(--border-color)'}`,
                      color:      niche === n.value ? ACCENT        : 'var(--text-secondary)',
                    }}
                  >
                    {n.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tone */}
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>
                Speaking Style
              </p>
              <div className="flex flex-col gap-2">
                {TONES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTone(t.value)}
                    className="flex items-center justify-between px-4 py-3 rounded-xl text-left transition-all"
                    style={{
                      background: tone === t.value ? ACCENT_SUB   : 'var(--bg-elevated)',
                      border:     `1px solid ${tone === t.value ? ACCENT_BDR : 'var(--border-color)'}`,
                    }}
                  >
                    <div>
                      <p className="text-sm font-semibold" style={{ color: tone === t.value ? ACCENT : 'var(--text-primary)' }}>
                        {t.label}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{t.desc}</p>
                    </div>
                    {tone === t.value && (
                      <div
                        className="w-4 h-4 rounded-full flex-shrink-0 ml-2"
                        style={{ background: ACCENT }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateScript}
              disabled={!canGenerate}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: canGenerate ? ACCENT : 'var(--bg-elevated)',
                color:      canGenerate ? '#fff'  : 'var(--text-muted)',
              }}
            >
              <Sparkles size={15} />
              Generate Script
            </button>
          </div>
        )}

        {/* ── Loading step ── */}
        {step === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 pb-8">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
            >
              <Sparkles size={28} style={{ color: ACCENT }} />
            </motion.div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              Writing your script…
            </p>
          </div>
        )}

        {/* ── Script step ── */}
        {step === 'script' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Hint */}
            <div
              className="mx-4 mb-3 flex-shrink-0 flex items-start gap-2 p-3 rounded-xl text-xs"
              style={{ background: ACCENT_SUB, color: 'var(--text-muted)', border: `1px solid ${ACCENT_BDR}` }}
            >
              <Sparkles size={12} style={{ color: ACCENT, flexShrink: 0, marginTop: 1 }} />
              Read naturally — don't rush. Scroll as you go. Speak like you'd normally talk.
            </div>

            {/* Script text — scrollable, large, readable */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              <p
                className="leading-relaxed"
                style={{
                  color:      'var(--text-primary)',
                  fontSize:   '1.05rem',
                  lineHeight: '1.9',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {script}
              </p>
              {/* Bottom fade so user knows there's more */}
              <div className="h-8" />
            </div>

            {/* CTAs */}
            <div
              className="flex-shrink-0 px-4 pb-6 flex flex-col gap-2"
              style={{ borderTop: `1px solid var(--border-color)`, paddingTop: 12 }}
            >
              <button
                onClick={handleUseScript}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{ background: ACCENT, color: '#fff' }}
              >
                Use This Script
              </button>
              <button
                onClick={() => setStep('pick')}
                className="w-full py-3 rounded-2xl text-sm font-semibold"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
              >
                Generate Another
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  )
}
