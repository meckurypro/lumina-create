// src/pages/DAWResultPage.jsx
//
// DAW AI result view. Shows every variation for a daw_generations row,
// live per-section progress while the sequential Extend Audio chain is
// running (via daw_generation_section_jobs), and the two user-triggered
// follow-up actions — Master and Export Stems — per completed variation.
//
// Master/Export Stems call 'daw-master' / 'daw-stem-export' edge
// functions that aren't built yet (frontend-first sequencing) — they'll
// fail cleanly with a toast until those exist.

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Play, Pause, Loader2, CheckCircle2, XCircle, Clock,
  Sliders, Scissors, Download, Music2, AlertCircle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-music, #a855f7)'
const ACCENT_SUB = 'var(--tool-music-subtle, rgba(168,85,247,0.12))'
const ACCENT_BDR = 'var(--tool-music-border, rgba(168,85,247,0.32))'

const POLL_MS = 3_000

// ─────────────────────────────────────────────────────────────────────────
// SECTION PROGRESS — "Generating verse 2 of 4"
// ─────────────────────────────────────────────────────────────────────────

function SectionProgress({ jobs }) {
  if (!jobs || jobs.length === 0) return null
  const sorted     = [...jobs].sort((a, b) => a.section_index - b.section_index)
  const current    = sorted.find((j) => j.status === 'processing') || sorted.find((j) => j.status === 'pending')
  const completed  = sorted.filter((j) => j.status === 'completed').length

  return (
    <div className="flex flex-col gap-2 px-3.5 py-3 rounded-xl" style={{ background: ACCENT_SUB }}>
      <div className="flex items-center gap-2">
        <Loader2 size={13} className="animate-spin" style={{ color: ACCENT }} />
        <p className="text-xs font-semibold" style={{ color: ACCENT }}>
          {current ? `Generating ${current.label} (${completed + 1} of ${sorted.length})` : `${completed} of ${sorted.length} sections done`}
        </p>
      </div>
      <div className="flex gap-1">
        {sorted.map((j) => (
          <div key={j.section_index} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-card)' }}>
            <div className="h-full rounded-full transition-all"
              style={{
                width: j.status === 'completed' ? '100%' : j.status === 'processing' ? '55%' : '0%',
                background: j.status === 'failed' ? '#ef4444' : ACCENT,
              }} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// AUDIO PLAYER — minimal, single-track
// ─────────────────────────────────────────────────────────────────────────

function TrackPlayer({ url }) {
  const [playing, setPlaying] = useState(false)
  const audioRef = useRef(null)

  const toggle = () => {
    if (!audioRef.current) return
    if (playing) { audioRef.current.pause(); setPlaying(false) }
    else         { audioRef.current.play();  setPlaying(true)  }
  }

  return (
    <div className="flex items-center gap-3">
      <audio ref={audioRef} src={url} onEnded={() => setPlaying(false)} className="hidden" />
      <button onClick={toggle}
        className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT }}>
        {playing
          ? <Pause size={16} style={{ color: '#fff' }} fill="currentColor" />
          : <Play  size={16} style={{ color: '#fff' }} fill="currentColor" />}
      </button>
      <a href={url} download className="p-2 rounded-lg" style={{ color: 'var(--text-muted)' }}>
        <Download size={15} />
      </a>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// VARIATION CARD
// ─────────────────────────────────────────────────────────────────────────

function VariationCard({ variation, sectionJobs, master, stemExport, onMaster, onExportStems, masterLoading, stemLoading }) {
  const isProcessing = variation.status === 'pending' || variation.status === 'processing'
  const isCompleted  = variation.status === 'completed'
  const isFailed     = variation.status === 'failed'

  return (
    <div className="flex flex-col gap-3 p-4 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          Variation {variation.variation_index + 1}
        </p>
        {isCompleted && <CheckCircle2 size={15} style={{ color: '#10b981' }} />}
        {isFailed && <XCircle size={15} style={{ color: '#ef4444' }} />}
        {isProcessing && <Clock size={15} style={{ color: '#eab308' }} />}
      </div>

      {isProcessing && <SectionProgress jobs={sectionJobs} />}

      {isFailed && (
        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
          <AlertCircle size={13} style={{ color: '#ef4444', flexShrink: 0 }} />
          <p className="text-xs" style={{ color: '#ef4444' }}>{variation.error_message || 'Generation failed'}</p>
        </div>
      )}

      {isCompleted && variation.output_url && (
        <>
          <TrackPlayer url={variation.output_url} />

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onMaster(variation)}
              disabled={masterLoading || !!master}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: master ? ACCENT_SUB : 'var(--bg-elevated)',
                color:      master ? ACCENT : 'var(--text-secondary)',
                border: `1px solid ${ACCENT_BDR}`,
              }}
            >
              {masterLoading ? <Loader2 size={12} className="animate-spin" /> : <Sliders size={12} />}
              {master?.status === 'completed' ? 'Mastered ✓' : master ? 'Mastering…' : 'Master'}
            </button>
            <button
              onClick={() => onExportStems(variation)}
              disabled={stemLoading || !!stemExport}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: stemExport ? ACCENT_SUB : 'var(--bg-elevated)',
                color:      stemExport ? ACCENT : 'var(--text-secondary)',
                border: `1px solid ${ACCENT_BDR}`,
              }}
            >
              {stemLoading ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
              {stemExport?.status === 'completed' ? 'Stems ✓' : stemExport ? 'Exporting…' : 'Export Stems'}
            </button>
          </div>

          {master?.status === 'completed' && master.output_url && (
            <div className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
              <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Mastered version</span>
              <a href={master.output_url} download className="text-xs font-semibold" style={{ color: ACCENT }}>Download</a>
            </div>
          )}

          {stemExport?.status === 'completed' && stemExport.stem_urls && (
            <div className="flex flex-col gap-1.5">
              {Object.entries(stemExport.stem_urls).map(([stem, url]) => (
                <div key={stem} className="flex items-center justify-between px-3 py-2 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                  <span className="text-xs font-medium capitalize" style={{ color: 'var(--text-secondary)' }}>{stem}</span>
                  <a href={url} download className="text-xs font-semibold" style={{ color: ACCENT }}>Download</a>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────

export default function DAWResultPage() {
  const { id }    = useParams()
  const navigate  = useNavigate()

  const [generation,   setGeneration]   = useState(null)
  const [variations,   setVariations]   = useState([])
  const [sectionJobsByVariation, setSectionJobsByVariation] = useState({})
  const [masters,       setMasters]       = useState({})   // variationId -> row
  const [stemExports,   setStemExports]   = useState({})   // variationId -> row
  const [loading,        setLoading]       = useState(true)
  const [masterLoadingId, setMasterLoadingId] = useState(null)
  const [stemLoadingId,   setStemLoadingId]   = useState(null)

  const pollRef = useRef(null)

  const load = useCallback(async () => {
    const { data: gen } = await supabase.from('daw_generations').select('*').eq('id', id).single()
    setGeneration(gen)

    const { data: vars } = await supabase
      .from('daw_generation_variations')
      .select('*')
      .eq('daw_generation_id', id)
      .order('variation_index')
    setVariations(vars || [])

    if (vars?.length) {
      const varIds = vars.map((v) => v.id)

      const { data: jobs } = await supabase
        .from('daw_generation_section_jobs')
        .select('*')
        .in('daw_variation_id', varIds)
      const jobsMap = {}
      for (const j of jobs || []) {
        if (!jobsMap[j.daw_variation_id]) jobsMap[j.daw_variation_id] = []
        jobsMap[j.daw_variation_id].push(j)
      }
      setSectionJobsByVariation(jobsMap)

      const { data: masterRows } = await supabase.from('daw_masters').select('*').in('daw_variation_id', varIds)
      const masterMap = {}
      for (const m of masterRows || []) masterMap[m.daw_variation_id] = m
      setMasters(masterMap)

      const { data: stemRows } = await supabase.from('daw_stem_exports').select('*').in('daw_variation_id', varIds)
      const stemMap = {}
      for (const s of stemRows || []) stemMap[s.daw_variation_id] = s
      setStemExports(stemMap)
    }

    setLoading(false)
  }, [id])

  useEffect(() => { load() }, [load])

  // Poll while anything relevant is still in flight
  useEffect(() => {
    const stillActive =
      generation?.status === 'pending' || generation?.status === 'processing' ||
      variations.some((v) => v.status === 'pending' || v.status === 'processing') ||
      Object.values(masters).some((m) => m.status === 'pending' || m.status === 'processing') ||
      Object.values(stemExports).some((s) => s.status === 'pending' || s.status === 'processing')

    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (!stillActive) return

    pollRef.current = setInterval(load, POLL_MS)
    return () => { clearInterval(pollRef.current); pollRef.current = null }
  }, [generation, variations, masters, stemExports, load])

  const handleMaster = async (variation) => {
    setMasterLoadingId(variation.id)
    try {
      const { data, error } = await supabase.functions.invoke('daw-master', { body: { variationId: variation.id } })
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Mastering failed')
      toast.success('Mastering started')
      load()
    } catch (err) {
      toast.error(err.message || 'Mastering isn\'t available yet')
    } finally {
      setMasterLoadingId(null)
    }
  }

  const handleExportStems = async (variation) => {
    setStemLoadingId(variation.id)
    try {
      const { data, error } = await supabase.functions.invoke('daw-stem-export', { body: { variationId: variation.id } })
      if (error || data?.error) throw new Error(data?.error || error?.message || 'Stem export failed')
      toast.success('Stem export started')
      load()
    } catch (err) {
      toast.error(err.message || 'Stem export isn\'t available yet')
    } finally {
      setStemLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <Loader2 size={24} className="animate-spin" style={{ color: ACCENT }} />
      </div>
    )
  }

  if (!generation) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3" style={{ background: 'var(--bg-primary)' }}>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Generation not found</p>
        <button onClick={() => navigate('/media')} className="text-sm font-semibold" style={{ color: ACCENT }}>Back to Media</button>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate('/media')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
            {generation.mode === 'song' ? 'Song' : 'Instrumental'}
          </h1>
        </div>
        <div style={{ width: 20 }} />
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-5">

          <div className="flex items-start gap-3 px-4 py-3 rounded-2xl" style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
            <Music2 size={16} style={{ color: ACCENT, marginTop: 2, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{generation.prompt}</p>
          </div>

          {generation.status === 'failed' && (
            <div className="flex items-center gap-2 px-4 py-3 rounded-2xl" style={{ background: 'rgba(239,68,68,0.08)' }}>
              <AlertCircle size={14} style={{ color: '#ef4444', flexShrink: 0 }} />
              <p className="text-xs" style={{ color: '#ef4444' }}>{generation.error_message || 'Generation failed'}</p>
            </div>
          )}

          <div className="flex flex-col gap-3">
            {variations.map((v) => (
              <VariationCard
                key={v.id}
                variation={v}
                sectionJobs={sectionJobsByVariation[v.id]}
                master={masters[v.id]}
                stemExport={stemExports[v.id]}
                onMaster={handleMaster}
                onExportStems={handleExportStems}
                masterLoading={masterLoadingId === v.id}
                stemLoading={stemLoadingId === v.id}
              />
            ))}
          </div>

        </div>
      </div>
    </div>
  )
}
