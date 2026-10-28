// src/pages/CreateDAWPage.jsx
//
// DAW AI — mode toggle (Song/Instrumental), collapsible Style/Lyrics/
// Reference-audio/Voice sections, live [Section]-tag parsing with a
// single-cloned-voice toggle per section (not a dropdown per section —
// see thread history: one reference voice per song, applied only where
// toggled on; other sections fall back to a text voice descriptor baked
// into that section's style prompt).
//
// Model picker follows CreateIQAdsPage's convention: hidden entirely
// when only one 'audio' model is active.
//
// Pricing: DAW_CREDITS_PER_VARIATION is a flagged flat rate (like
// VIDEO_EDIT_CPS) — song length is emergent, not user-selected, so it
// doesn't fit calculateModelCostUsd's duration-driven shape. Replace
// with real numbers once RunPod compute cost per generation is measured.

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Zap, X, ChevronDown, Music2, Mic, UploadCloud, Loader2, Sparkles,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'
import { Textarea } from '@/components/ui/Input'
import { ModelDropdown } from '@/components/create/ModelDropdown'
import { SettingChips } from '@/components/create/SettingChips'
import { formatBytes } from '@/lib/mediaUtils'
import { saveDraftJSON, loadDraftJSON, draftDelete } from '@/lib/draftCache'

// ─── theme ────────────────────────────────────────────────────────────────
// Fallback literals, same pattern as CreateIQAdsPage's var(--tool-iqads, …)
// — no index.css edit required; swap in real tokens whenever convenient.
const ACCENT     = 'var(--tool-music, #a855f7)'
const ACCENT_SUB = 'var(--tool-music-subtle, rgba(168,85,247,0.12))'
const ACCENT_BDR = 'var(--tool-music-border, rgba(168,85,247,0.32))'

const TOOL_KEY = 'create_daw'

// ─── draft keys ───────────────────────────────────────────────────────────
const DRAFT_PROMPT = 'create_daw:prompt'
const DRAFT_LYRICS = 'create_daw:lyrics'

// ─── constants ────────────────────────────────────────────────────────────
const MODES = [
  { label: 'Song',        value: 'song' },
  { label: 'Instrumental', value: 'instrumental' },
]
const VARIATION_OPTIONS = [1, 2, 3, 4]

const REF_MAX_BYTES            = 80 * 1024 * 1024
const REF_MAX_SECONDS_NOVICE   = 60
const REF_MAX_SECONDS_MASTER   = 600

// ★ PLACEHOLDER — see file header note. Not derived from the pricing engine.
const DAW_CREDITS_PER_VARIATION = 40

// ─── local media-duration helper ───────────────────────────────────────────
// Duplicated from the same pattern already in CreateVideoPage/
// CreateTalkingHeadPage (flagged there as an extraction candidate) —
// works for both <audio> and <video> elements via preload metadata.
function getMediaDuration(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const isVideo = file.type.startsWith('video/')
    const el = isVideo ? document.createElement('video') : new Audio()
    el.preload = 'metadata'
    el.onloadedmetadata = () => { URL.revokeObjectURL(url); resolve(el.duration) }
    el.onerror          = () => { URL.revokeObjectURL(url); reject(new Error('Could not read media duration')) }
    el.src = url
  })
}

// ─── section parsing ────────────────────────────────────────────────────────
// [Verse 1]\nlyrics...\n[Chorus]\nlyrics... → structured sections.
// No tags at all → single "Full Song" section, so instrumental-less song
// mode still generates without forcing tag syntax on the user.
function parseSections(lyricsText) {
  if (!lyricsText?.trim()) return []
  const re = /\[([^\]]+)\]/g
  const matches = [...lyricsText.matchAll(re)]
  if (matches.length === 0) {
    return [{ label: 'Full Song', lyrics: lyricsText.trim(), order_index: 0 }]
  }
  return matches.map((m, i) => {
    const label = m[1].trim()
    const start = m.index + m[0].length
    const end   = i + 1 < matches.length ? matches[i + 1].index : lyricsText.length
    return { label, lyrics: lyricsText.slice(start, end).trim(), order_index: i }
  })
}

// ─────────────────────────────────────────────────────────────────────────
// COLLAPSIBLE SECTION
// ─────────────────────────────────────────────────────────────────────────

function CollapsibleSection({ title, defaultOpen = false, badge, headerExtra, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: `1px solid ${ACCENT_BDR}`, background: 'var(--bg-card)' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3.5"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{title}</span>
          {badge && (
            <span className="px-1.5 py-0.5 rounded-md text-xs font-semibold" style={{ background: ACCENT_SUB, color: ACCENT }}>
              {badge}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {headerExtra}
          <ChevronDown
            size={16}
            style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
          />
        </div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SECTION VOICE ROW — one row per parsed [Section] tag
// ─────────────────────────────────────────────────────────────────────────

function SectionVoiceRow({ section, voiceEnabled, entry, onChange }) {
  const useCloned = entry?.use_cloned_voice ?? true

  return (
    <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{section.label}</span>
        <button
          disabled={!voiceEnabled}
          onClick={() => onChange(section.order_index, { ...entry, use_cloned_voice: !useCloned })}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all"
          style={{
            background: !voiceEnabled ? 'var(--bg-card)' : useCloned ? ACCENT : 'var(--bg-card)',
            color:      !voiceEnabled ? 'var(--text-muted)' : useCloned ? '#fff' : 'var(--text-secondary)',
            opacity:    voiceEnabled ? 1 : 0.5,
            border: `1px solid ${ACCENT_BDR}`,
          }}
        >
          <Mic size={11} /> {useCloned ? 'My voice' : 'AI voice'}
        </button>
      </div>
      {!useCloned && (
        <input
          type="text"
          value={entry?.voice_descriptor ?? ''}
          onChange={(e) => onChange(section.order_index, { ...entry, use_cloned_voice: false, voice_descriptor: e.target.value })}
          placeholder="e.g. female vocals, gruff male voice, choir"
          className="w-full px-3 py-2 rounded-lg text-xs outline-none"
          style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
        />
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// SLIDER CONTROL — shared shape for Creativity / Prompt Influence /
// Reference Audio Influence. Raw <input type="range">, same styling
// convention as the trim slider in CreateVideoPage (accentColor prop).
// ─────────────────────────────────────────────────────────────────────────

function SliderControl({ label, value, onChange, lowLabel, highLabel, hint }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-xs font-bold" style={{ color: ACCENT }}>{value}%</span>
      </div>
      <input
        type="range" min={0} max={100} step={1}
        value={value} onChange={(e) => onChange(Number(e.target.value))}
        className="w-full" style={{ accentColor: ACCENT }}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lowLabel}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{highLabel}</span>
      </div>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{hint}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────

export default function CreateDAWPage() {
  const navigate = useNavigate()
  const { user, profile, credits, refreshProfile } = useAuth()

  const [mode,   setMode]   = useState('song')
  const [prompt, setPrompt] = useState('')
  const [lyrics, setLyrics] = useState('')

  const [models,        setModels]        = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [modelValue,    setModelValue]    = useState('')

  const [voices,        setVoices]        = useState([])
  const [voicesLoading, setVoicesLoading] = useState(true)
  const [voiceId,       setVoiceId]       = useState('')

  const [sectionVoiceMap, setSectionVoiceMap] = useState({})   // { [order_index]: { use_cloned_voice, voice_descriptor } }

  const [referenceFile, setReferenceFile] = useState(null)
  const [referenceMeta, setReferenceMeta] = useState(null)     // { name, size, duration, kind }

  const [variationCount, setVariationCount] = useState(1)
  const [submitting,     setSubmitting]     = useState(false)

  // Creative controls — same triad as Suno/Udio's advanced sliders,
  // mapped to real ACE-Step params server-side (LM temperature, cfg,
  // denoise/cover_strength). 0–100 stored as-is; range mapping happens
  // at workflow-injection time in daw-generate.
  const [creativity,          setCreativity]          = useState(50)
  const [promptInfluence,     setPromptInfluence]     = useState(65)
  const [referenceInfluence,  setReferenceInfluence]  = useState(55)

  const isMaster = profile?.user_tier === 'master'
  const refCapSeconds = isMaster ? REF_MAX_SECONDS_MASTER : REF_MAX_SECONDS_NOVICE

  // ── restore drafts ──────────────────────────────────────────────────────
  useEffect(() => {
    loadDraftJSON(DRAFT_PROMPT).then((p) => { if (p) setPrompt(p) })
    loadDraftJSON(DRAFT_LYRICS).then((l) => { if (l) setLyrics(l) })
  }, [])
  useEffect(() => { saveDraftJSON(DRAFT_PROMPT, prompt) }, [prompt])
  useEffect(() => { saveDraftJSON(DRAFT_LYRICS, lyrics) }, [lyrics])

  // ── load models (type='audio') ──────────────────────────────────────────
  useEffect(() => {
    (async () => {
      setModelsLoading(true)
      const { data } = await supabase
        .from('models')
        .select('*')
        .eq('type', 'audio')
        .eq('is_active', true)
        .eq('is_user_facing', true)
        .order('sort_order')
      const list = data || []
      setModels(list)
      if (list.length) setModelValue(list[0].value)
      setModelsLoading(false)
    })()
  }, [])

  const selectedModel   = models.find((m) => m.value === modelValue)
  const showModelPicker = !modelsLoading && models.length > 1

  // ── load user's cloned voices ───────────────────────────────────────────
  useEffect(() => {
    if (!user) return
    (async () => {
      setVoicesLoading(true)
      const { data } = await supabase
        .from('daw_voices')
        .select('id, name, reference_audio_url')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
      setVoices(data || [])
      setVoicesLoading(false)
    })()
  }, [user])

  // ── live section parsing, reconciled against existing toggle state ─────
  const parsedSections = useMemo(
    () => mode === 'song' ? parseSections(lyrics) : [],
    [mode, lyrics],
  )

  useEffect(() => {
    setSectionVoiceMap((prev) => {
      const next = {}
      for (const s of parsedSections) {
        next[s.order_index] = prev[s.order_index] ?? { use_cloned_voice: !!voiceId, voice_descriptor: '' }
      }
      return next
    })
  }, [parsedSections, voiceId])

  const handleSectionVoiceChange = useCallback((orderIndex, entry) => {
    setSectionVoiceMap((prev) => ({ ...prev, [orderIndex]: entry }))
  }, [])

  // ── reference audio upload ──────────────────────────────────────────────
  const handleReferenceUpload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return
    if (file.size > REF_MAX_BYTES) {
      toast.error(`File must be under 80MB. Yours is ${formatBytes(file.size)}.`)
      e.target.value = ''; return
    }
    let duration = null
    try { duration = await getMediaDuration(file) } catch {}
    if (duration != null && duration > refCapSeconds) {
      const capLabel = refCapSeconds >= 60 ? `${Math.round(refCapSeconds / 60)} min` : `${refCapSeconds}s`
      toast.error(`Reference ${file.type.startsWith('video/') ? 'video' : 'audio'} must be under ${capLabel} on your plan.`)
      e.target.value = ''; return
    }
    setReferenceFile(file)
    setReferenceMeta({
      name: file.name, size: file.size, duration,
      kind: file.type.startsWith('video/') ? 'video' : 'audio',
    })
    e.target.value = ''
  }

  const clearReference = () => { setReferenceFile(null); setReferenceMeta(null) }

  // ── pricing (flat rate — see file header) ───────────────────────────────
  const creditCost = variationCount * DAW_CREDITS_PER_VARIATION
  const canAfford  = credits >= creditCost

  const promptEmpty = !prompt.trim()
  const lyricsEmpty = mode === 'song' && !lyrics.trim()

  const generateDisabled = submitting || promptEmpty || lyricsEmpty || !selectedModel || !canAfford

  // ── generate ─────────────────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (promptEmpty)     return toast.error('Enter a style / prompt')
    if (lyricsEmpty)      return toast.error('Enter lyrics, or switch to Instrumental')
    if (!selectedModel)  return toast.error('No model available — contact support')
    if (!canAfford)      return toast.error('Not enough credits')
    if (!user)           return toast.error('Please sign in')

    setSubmitting(true)
    try {
      let referenceAudioUrl  = null
      let referenceAudioKind = null

      if (referenceFile) {
        const ext  = (referenceFile.name.split('.').pop() || 'wav').toLowerCase()
        const path = `${user.id}/daw-reference/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('generation-uploads')
          .upload(path, referenceFile, { upsert: false, cacheControl: '3600', contentType: referenceFile.type })
        if (upErr) throw new Error('Reference upload failed')
        const { data: { publicUrl } } = supabase.storage.from('generation-uploads').getPublicUrl(path)
        referenceAudioUrl  = publicUrl
        referenceAudioKind = referenceMeta?.kind ?? 'audio'
      }

      const sectionsPayload = mode === 'song'
        ? parsedSections.map((s) => {
            const entry     = sectionVoiceMap[s.order_index]
            const useCloned = !!voiceId && (entry?.use_cloned_voice ?? true)
            return {
              label: s.label,
              lyrics: s.lyrics,
              order_index: s.order_index,
              use_cloned_voice: useCloned,
              voice_descriptor: useCloned ? null : (entry?.voice_descriptor || null),
            }
          })
        : []

      const { data: genRow, error: genErr } = await supabase
        .from('daw_generations')
        .insert({
          user_id:              user.id,
          model:                 selectedModel.value,
          mode,
          prompt,
          lyrics:                 mode === 'song' ? lyrics : null,
          sections:                sectionsPayload,
          voice_id:                voiceId || null,
          reference_audio_url:     referenceAudioUrl,
          reference_audio_kind:    referenceAudioKind,
          variation_count:          variationCount,
          credits_charged:          creditCost,
          status:                   'pending',
          creativity,
          prompt_influence:         promptInfluence,
          reference_influence:      referenceAudioUrl ? referenceInfluence : null,
        })
        .select('id')
        .single()
      if (genErr || !genRow) throw new Error(genErr?.message || 'Could not create generation')

      // p_generation_id: null — same pattern CreateVideoPage uses for
      // actions without a row in the `generations` table (e.g. trim
      // conversion, frame extraction). daw_generations is a standalone
      // table, not `generations`, so it can't satisfy that FK.
      const { data: deduct, error: dErr } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id, p_amount: creditCost, p_generation_id: null,
        p_description: `DAW AI generation (${genRow.id})`,
      })
      if (dErr || !deduct?.success) {
        await supabase.from('daw_generations')
          .update({ status: 'failed', error_message: deduct?.error || 'Insufficient credits' })
          .eq('id', genRow.id)
        throw new Error(deduct?.error || 'Not enough credits')
      }

      const { data: invokeData, error: invokeErr } = await supabase.functions
        .invoke('daw-generate', { body: { dawGenerationId: genRow.id } })

      if (invokeErr || invokeData?.error) {
        toast.error(invokeData?.error || invokeErr?.message || 'Generation blocked')
        await refreshProfile()
        return
      }

      await refreshProfile()
      toast.success('Your track is being generated. Check your Media page.', { duration: 4000 })

      setPrompt(''); setLyrics(''); clearReference()
      draftDelete(DRAFT_PROMPT); draftDelete(DRAFT_LYRICS)
      navigate('/media')

    } catch (err) {
      toast.error(err.message || 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  // ── render ─────────────────────────────────────────────────────────────
  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      <AnimatePresence>
        {submitting && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.45)' }}
          >
            <Loader2 size={30} className="animate-spin" style={{ color: '#fff' }} />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>Sending to the studio…</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate('/create')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>DAW AI</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>{mode === 'song' ? 'Song' : 'Instrumental'}</span>
        </div>
        <div className="flex items-center gap-2">
          {showModelPicker && (
            <ModelDropdown models={models} value={modelValue} onChange={setModelValue}
              accent={ACCENT} accentSub={ACCENT_SUB} accentBdr={ACCENT_BDR} />
          )}
          <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
            <Zap size={12} style={{ color: 'var(--brand)' }} fill="currentColor" />
            {Math.floor(credits)}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-4">

          <SettingChips label="Mode" options={MODES} value={mode} onChange={setMode} accent={ACCENT} />

          {/* Style / Prompt — open by default, always required */}
          <CollapsibleSection title="Style & Prompt" defaultOpen badge="Required">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g. amapiano, log drum, piano loop, 113 BPM, warm and groovy"
              rows={3} maxLength={2000}
            />
          </CollapsibleSection>

          {/* Lyrics — song mode only, open by default */}
          {mode === 'song' && (
            <CollapsibleSection title="Lyrics" defaultOpen badge="Required">
              <Textarea
                value={lyrics}
                onChange={(e) => setLyrics(e.target.value)}
                placeholder={'[Verse 1]\nYour lyrics here...\n\n[Chorus]\nMore lyrics...'}
                rows={8} maxLength={20000}
              />
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Tag sections with <span style={{ color: ACCENT, fontWeight: 600 }}>[Verse 1]</span>,{' '}
                <span style={{ color: ACCENT, fontWeight: 600 }}>[Chorus]</span>, etc. — untagged lyrics generate as one section.
              </p>
            </CollapsibleSection>
          )}

          {/* Reference audio — collapsed by default */}
          <CollapsibleSection title="Reference Audio" badge="Optional">
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Upload a rough recording, voice note, or video — up to 80MB, max{' '}
              {refCapSeconds >= 60 ? `${refCapSeconds / 60} min` : `${refCapSeconds}s`} on your plan.
            </p>
            {referenceMeta ? (
              <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{referenceMeta.name}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {referenceMeta.kind === 'video' ? 'Video' : 'Audio'} · {formatBytes(referenceMeta.size)}
                    {referenceMeta.duration != null && ` · ${Math.round(referenceMeta.duration)}s`}
                  </p>
                </div>
                <button onClick={clearReference} className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--bg-card)', color: 'var(--text-muted)' }}>
                  <X size={13} />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all py-7"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <input type="file" accept="audio/*,video/*" className="hidden" onChange={handleReferenceUpload} />
                <UploadCloud size={20} style={{ color: ACCENT, marginBottom: 6 }} />
                <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload audio or video</span>
              </label>
            )}
          </CollapsibleSection>

          {/* Voice — song mode only, collapsed by default */}
          {mode === 'song' && (
            <CollapsibleSection
              title="Voice"
              badge={voiceId ? '1 selected' : 'Optional'}
              headerExtra={
                <button
                  onClick={(e) => { e.stopPropagation(); navigate('/create/daw/voices') }}
                  className="text-xs font-semibold"
                  style={{ color: ACCENT }}
                >
                  Manage
                </button>
              }
            >
              {voicesLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin" style={{ color: ACCENT }} />
                </div>
              ) : voices.length === 0 ? (
                <div className="flex items-center gap-2 px-3 py-3 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  <Sparkles size={14} style={{ color: 'var(--text-muted)' }} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    No cloned voices yet. Every section will use an AI-described voice from your style prompt.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs mb-2" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Pick one voice for this song, then choose which sections use it — everything else falls back to a described voice.
                  </p>
                  <select
                    value={voiceId}
                    onChange={(e) => setVoiceId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none mb-3"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: `1px solid ${ACCENT_BDR}` }}
                  >
                    <option value="">No cloned voice — AI voice throughout</option>
                    {voices.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>

                  {voiceId && parsedSections.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {parsedSections.map((s) => (
                        <SectionVoiceRow
                          key={s.order_index}
                          section={s}
                          voiceEnabled={!!voiceId}
                          entry={sectionVoiceMap[s.order_index]}
                          onChange={handleSectionVoiceChange}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </CollapsibleSection>
          )}

         {/* Variations */}
          <div>
            <SettingChips
              label="Variations"
              options={VARIATION_OPTIONS.map((n) => ({ label: String(n), value: n }))}
              value={variationCount}
              onChange={setVariationCount}
              accent={ACCENT}
            />
          </div>

          {/* Creative controls — collapsed by default, power-user territory,
              same as Suno's "Advanced options" */}
          <CollapsibleSection title="Creative Controls" badge="Advanced">
            <div className="flex flex-col gap-5">
              <SliderControl
                label="Creativity" value={creativity} onChange={setCreativity}
                lowLabel="Safe" highLabel="Chaos"
                hint="Low keeps it predictable. High gets experimental."
              />
              <SliderControl
                label="Prompt Influence" value={promptInfluence} onChange={setPromptInfluence}
                lowLabel="Loose" highLabel="Strict"
                hint="How literally the style prompt and lyrics are followed."
              />
             {referenceMeta && (
                <SliderControl
                  label="Audio Influence" value={referenceInfluence} onChange={setReferenceInfluence}
                  lowLabel="Subtle" highLabel="Strong"
                  hint="How much your uploaded reference shapes the result."
                />
              )}
            </div>
          </CollapsibleSection>

        </div>
      </div>

      <div className="flex-shrink-0 px-4 lg:px-8 py-4" style={{ borderTop: `1px solid ${ACCENT_BDR}` }}>
        <div className="mx-auto w-full max-w-xl">
          <button onClick={handleGenerate} disabled={generateDisabled}
            className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold tracking-tight transition-all active:scale-[0.98]"
            style={{ background: generateDisabled ? 'var(--bg-elevated)' : ACCENT, color: generateDisabled ? 'var(--text-muted)' : '#ffffff' }}>
            <Music2 size={15} />
            {submitting ? 'Generating…' : `Generate · ${creditCost} cr`}
          </button>
          {!canAfford && (
            <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
              Not enough credits.{' '}
              <button onClick={() => navigate('/profile')} className="font-semibold" style={{ color: ACCENT }}>Top up</button>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
