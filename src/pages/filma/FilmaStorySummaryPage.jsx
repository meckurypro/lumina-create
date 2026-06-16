// src/pages/filma/FilmaStorySummaryPage.jsx
//
// Step 2 in the Filma flow: Setup → Story Summary → Cast → Structure → Scene
//
// User pastes a detailed multi-paragraph story summary.
// AI scaffolds: parts/episodes/scenes (counts + names) AND cast (characters).
// On success → navigate to Cast page where AI-generated actors are pre-populated
// but marked incomplete (no face photos yet).

import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, ArrowRight, Sparkles, Check, Loader2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaFilms, filmaScaffoldFilm } from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const MIN_CHARS = 200
const MAX_CHARS = 6000

// sessionStorage key — persists draft per film
const ssKey = (filmId) => `filma_story_summary_${filmId}`

export default function FilmaStorySummaryPage() {
  const navigate   = useNavigate()
  const { filmId } = useParams()
  const { user }   = useAuth()

  const [film,        setFilm]        = useState(null)
  const [summary,     setSummary]     = useState('')
  const [loading,     setLoading]     = useState(true)
  const [scaffolding, setScaffolding] = useState(false)
  const [scaffolded,  setScaffolded]  = useState(false)
  const [result,      setResult]      = useState(null) // { parts_created, scenes_created, actors_created }

  // ── Load film + restore draft ─────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const { data, error } = await filmaFilms.getById(filmId)
      if (error || !data) {
        toast.error('Film not found')
        navigate('/filma')
        return
      }
      setFilm(data)
      setScaffolded(data.scaffolded || false)

      // Restore: prefer sessionStorage draft over DB value
      const key   = ssKey(filmId)
      const draft = (() => { try { return sessionStorage.getItem(key) } catch { return null } })()
      if (draft) {
        setSummary(draft)
      } else if (data.story_summary) {
        setSummary(data.story_summary)
      }

      setLoading(false)
    }
    load()
  }, [filmId]) // eslint-disable-line

  // ── Persist draft to sessionStorage on every keystroke ───────────────────
  useEffect(() => {
    if (loading) return
    const key = ssKey(filmId)
    try {
      if (summary) sessionStorage.setItem(key, summary)
      else         sessionStorage.removeItem(key)
    } catch { /* noop */ }
  }, [summary, filmId, loading])

  // ── Scaffold ──────────────────────────────────────────────────────────────
  const handleScaffold = async () => {
    if (summary.trim().length < MIN_CHARS) {
      toast.error(`Story summary needs at least ${MIN_CHARS} characters`)
      return
    }

    setScaffolding(true)
    try {
      // Save summary to DB first
      await filmaFilms.saveStorySummary(filmId, summary.trim())

      // Clear sessionStorage draft — DB is now source of truth
      try { sessionStorage.removeItem(ssKey(filmId)) } catch { /* noop */ }

      // Call edge function
      const data = await filmaScaffoldFilm(filmId)
      setResult(data)
      setScaffolded(true)
      toast.success(`Structure built — ${data.actors_created} characters, ${data.scenes_created} scenes`)
    } catch (err) {
      toast.error(err.message || 'Scaffold failed. Try again.')
    } finally {
      setScaffolding(false)
    }
  }

  const canScaffold = summary.trim().length >= MIN_CHARS && !scaffolding
  const charCount   = summary.length

  if (loading) return (
    <div className="h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
      <Loader2 size={24} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
    </div>
  )

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Scaffold overlay */}
      <AnimatePresence>
        {scaffolding && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{
              backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              background: 'rgba(0,0,0,0.65)',
            }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }}
            />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>
              Filma is reading your story…
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Building structure, episodes and characters
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
        <button
          onClick={() => navigate(`/filma/${filmId}/edit`)}
          className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold truncate max-w-[180px]"
            style={{ color: 'var(--text-primary)' }}>
            {film?.title || 'Story Summary'}
          </h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Story Summary</span>
        </div>
        <div style={{ width: 36 }} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          {/* Instruction banner */}
          <div
            className="flex items-start gap-3 px-4 py-3 rounded-2xl"
            style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}
          >
            <AlertCircle size={14} style={{ color: ACCENT, flexShrink: 0, marginTop: 2 }} />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold" style={{ color: ACCENT }}>
                Write the full story — not a logline
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                AI will use this to build every part, episode, scene, and character.
                Include all major characters with descriptions, the full story arc from start to finish,
                key turning points, relationships, and themes.
                The more detailed, the better the scaffold.
              </p>
            </div>
          </div>

          {/* Textarea */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Story Summary</p>
              <span
                className="text-xs"
                style={{ color: charCount < MIN_CHARS ? 'var(--text-muted)' : ACCENT }}
              >
                {charCount.toLocaleString()} / {MAX_CHARS.toLocaleString()}
              </span>
            </div>
            <textarea
              value={summary}
              onChange={(e) => {
                if (e.target.value.length <= MAX_CHARS) {
                  setSummary(e.target.value)
                  if (scaffolded) setScaffolded(false)
                }
              }}
              placeholder={
                'Tell the full story of your film.\n\n' +
                'Who are the characters? What do they want? What stands in their way?\n' +
                'What happens in Act 1, Act 2, Act 3?\n' +
                'How does it end?\n\n' +
                'Include: character names, physical descriptions, relationships, major scenes, ' +
                'turning points, themes, and the emotional journey of the story.\n\n' +
                'AI will use this to create the episode/part structure, name every scene, ' +
                'and generate the full cast list.'
              }
              rows={16}
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none"
              style={{
                background:  'var(--bg-elevated)',
                border:      `1.5px solid ${summary.trim().length >= MIN_CHARS ? ACCENT_BDR : 'var(--border-color)'}`,
                color:       'var(--text-primary)',
                lineHeight:  1.7,
                transition:  'border-color 0.2s',
              }}
            />
            {summary.trim().length > 0 && summary.trim().length < MIN_CHARS && (
              <p className="text-xs px-1" style={{ color: 'var(--text-muted)' }}>
                {MIN_CHARS - summary.trim().length} more characters needed
              </p>
            )}
          </div>

          {/* Scaffold result */}
          <AnimatePresence>
            {scaffolded && result && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="flex flex-col gap-3 px-4 py-4 rounded-2xl"
                style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.2)' }}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(52,211,153,0.15)' }}
                  >
                    <Check size={13} style={{ color: '#34D399' }} />
                  </div>
                  <p className="text-sm font-bold" style={{ color: '#34D399' }}>
                    Structure scaffolded
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Parts / Episodes', value: result.parts_created },
                    { label: 'Scenes',           value: result.scenes_created },
                    { label: 'Characters',        value: result.actors_created },
                  ].map(({ label, value }) => (
                    <div
                      key={label}
                      className="flex flex-col items-center justify-center py-3 rounded-xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                    >
                      <span className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                        {value}
                      </span>
                      <span className="text-xs mt-0.5 text-center" style={{ color: 'var(--text-muted)' }}>
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  Characters are created but need face photos before they can be used in scenes.
                  Head to Cast to complete each character profile.
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Re-scaffold warning */}
          {scaffolded && film?.scaffolded && !result && (
            <div
              className="px-4 py-3 rounded-xl"
              style={{ background: 'rgba(232,160,32,0.08)', border: '1px solid rgba(232,160,32,0.2)' }}
            >
              <p className="text-xs" style={{ color: '#E8A020', lineHeight: 1.6 }}>
                This film has already been scaffolded. Re-scaffolding will replace all existing parts, scenes and characters.
                — This cannot be undone. Edit your summary then click scaffold again if you want to update.
              </p>
            </div>
          )}

          <div style={{ height: 80 }} />
        </div>
      </div>

      {/* Footer */}
      <div
        className="flex-shrink-0 px-4 lg:px-8 py-4 flex flex-col gap-2"
        style={{ borderTop: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-primary)' }}
      >
        <div className="mx-auto w-full max-w-xl flex flex-col gap-2">

          {/* Scaffold button */}
          {!scaffolded && (
            <button
              onClick={handleScaffold}
              disabled={!canScaffold}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: canScaffold ? ACCENT : 'var(--bg-elevated)',
                color:      canScaffold ? '#000'  : 'var(--text-muted)',
              }}
            >
              <Sparkles size={15} />
              {scaffolding ? 'Filma is working…' : 'Scaffold with AI'}
            </button>
          )}

          {/* Continue to Cast */}
          <button
            onClick={() => navigate(`/filma/${filmId}/cast`)}
            disabled={!scaffolded && !film?.scaffolded}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
            style={{
              background: (scaffolded || film?.scaffolded) ? ACCENT : 'var(--bg-elevated)',
              color:      (scaffolded || film?.scaffolded) ? '#000'  : 'var(--text-muted)',
            }}
          >
            <span>Continue to Cast</span>
            <ArrowRight size={16} />
          </button>

          {/* Skip — user can bypass AI scaffold */}
          {!scaffolded && !film?.scaffolded && (
            <button
              onClick={() => navigate(`/filma/${filmId}/cast`)}
              className="text-xs text-center py-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Skip — I'll build structure manually
            </button>
          )}

        </div>
      </div>

    </div>
  )
}
