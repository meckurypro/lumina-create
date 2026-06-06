// src/pages/filma/FilmaScenePage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ImagePlus, X, User, Plus, Check,
  ChevronRight, Sparkles, Loader2, UserPlus,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  filmaScenes, filmaFilms, filmaActors,
  filmaSceneActors, filmaUpload, filmaScaffoldScene,
} from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

// ── Actor selector chip ───────────────────────────────────────────────────
const ActorChip = ({ actor, selected, onToggle }) => (
  <button onClick={() => onToggle(actor)}
    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all"
    style={{
      background: selected ? ACCENT_SUB    : 'var(--bg-elevated)',
      border:     `1px solid ${selected ? ACCENT_BDR : 'var(--border-color)'}`,
      color:      selected ? ACCENT        : 'var(--text-secondary)',
    }}>
    <div className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0"
      style={{ background: selected ? ACCENT_BDR : 'var(--bg-primary)' }}>
      {actor.thumbnail_url || actor.face_reference_url ? (
        <img src={actor.thumbnail_url || actor.face_reference_url}
          alt={actor.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User size={12} style={{ color: selected ? ACCENT : 'var(--text-muted)' }} />
        </div>
      )}
    </div>
    <span className="text-xs font-semibold">{actor.name}</span>
    {selected && <Check size={11} style={{ color: ACCENT }} />}
  </button>
)

// ── Outfit upload slot per actor ─────────────────────────────────────────
const OutfitSlot = ({ actor, outfitUrl, onUpload, uploading }) => (
  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
    {/* Actor thumb */}
    <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0"
      style={{ background: ACCENT_SUB }}>
      {actor.thumbnail_url || actor.face_reference_url ? (
        <img src={actor.thumbnail_url || actor.face_reference_url}
          alt={actor.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User size={14} style={{ color: ACCENT }} />
        </div>
      )}
    </div>

    <div className="flex-1 min-w-0">
      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
        {actor.name}
      </p>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {outfitUrl ? 'Outfit set' : 'No outfit reference'}
      </p>
    </div>

    {/* Outfit thumb or upload */}
    {outfitUrl ? (
      <div className="relative w-10 h-10 rounded-xl overflow-hidden flex-shrink-0">
        <img src={outfitUrl} alt="outfit" className="w-full h-full object-cover" />
        <button onClick={() => onUpload(actor.id, null)}
          className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity"
          style={{ background: 'rgba(0,0,0,0.5)' }}>
          <X size={12} color="white" />
        </button>
      </div>
    ) : (
      <label className="w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer flex-shrink-0 transition-all active:scale-90"
        style={{ background: ACCENT_SUB, border: `1px solid ${ACCENT_BDR}` }}>
        <input type="file" accept="image/*" className="hidden"
          onChange={(e) => onUpload(actor.id, e.target.files?.[0])} />
        {uploading === actor.id ? (
          <Loader2 size={13} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
        ) : (
          <ImagePlus size={13} style={{ color: ACCENT }} />
        )}
      </label>
    )}
  </div>
)

// ── Shot preview card (after scaffold) ───────────────────────────────────
const ShotPreviewCard = ({ shot, index, onClick }) => {
  const TYPE_COLOR = {
    dialogue:    ACCENT,
    action:      '#ef4444',
    establishing:'#34D399',
    wide:        '#7C9EFF',
    close_up:    '#FB7BB8',
    default:     'var(--text-muted)',
  }
  const color = TYPE_COLOR[shot.shot_type] || TYPE_COLOR.default

  return (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onClick}
      className="flex items-center gap-3 w-full px-4 py-3 rounded-xl text-left transition-all active:scale-[0.98]"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
    >
      {/* Shot number */}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}40` }}>
        <span className="text-xs font-bold" style={{ color }}>{shot.shot_number}</span>
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold capitalize" style={{ color }}>
            {shot.shot_type.replace(/_/g, ' ')}
          </span>
          {shot.dialogue_text && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: `${ACCENT}18`, color: ACCENT }}>
              Dialogue
            </span>
          )}
          {shot.duration_seconds && (
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {shot.duration_seconds}s
            </span>
          )}
        </div>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {shot.description}
        </p>
      </div>

      <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </motion.button>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaScenePage() {
  const navigate         = useNavigate()
  const { filmId, sceneId } = useParams()
  const { user }         = useAuth()

  const [film,          setFilm]         = useState(null)
  const [scene,         setScene]        = useState(null)
  const [allActors,     setAllActors]    = useState([])
  const [sceneActorIds, setSceneActorIds]= useState([])
  const [outfits,       setOutfits]      = useState({})  // actorId → url
  const [shots,         setShots]        = useState([])
  const [loading,       setLoading]      = useState(true)
  const [scaffolding,   setScaffolding]  = useState(false)
  const [uploadingMaster, setUploadingMaster] = useState(false)
  const [uploadingOutfit, setUploadingOutfit] = useState(null)
  const [script,        setScript]       = useState('')
  const [scriptSaved,   setScriptSaved]  = useState(false)
  const masterRef       = useRef(null)

  useEffect(() => { load() }, [sceneId])

  const load = async () => {
    setLoading(true)
    const [filmRes, sceneRes, actorsRes] = await Promise.all([
      filmaFilms.getById(filmId),
      filmaScenes.getById(sceneId),
      filmaActors.getByFilm(filmId),
    ])

    if (filmRes.data)  setFilm(filmRes.data)
    if (sceneRes.data) {
      const s = sceneRes.data
      setScene(s)
      setScript(s.script_text || '')
      setScriptSaved(!!s.script_text)

      // Extract scene actor ids and outfits
      const ids     = (s.filma_scene_actors || []).map((sa) => sa.actor_id)
      const outfitMap = {}
      ;(s.filma_scene_actors || []).forEach((sa) => {
        if (sa.outfit_image_url) outfitMap[sa.actor_id] = sa.outfit_image_url
      })
      setSceneActorIds(ids)
      setOutfits(outfitMap)
    }
    if (actorsRes.data) setAllActors(actorsRes.data)

    // Load existing shots if already scaffolded
    if (sceneRes.data?.scaffolded) {
      const { supabase } = await import('@/lib/supabase')
      const { data: shotData } = await supabase
        .from('filma_shots')
        .select('*')
        .eq('scene_id', sceneId)
        .order('shot_number')
      setShots(shotData || [])
    }

    setLoading(false)
  }

  // ── Master image ──────────────────────────────────────────────────────────
  const handleMasterUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMaster(true)
    try {
      const { url } = await filmaUpload(user.id, file, 'scenes/master')
      const { data } = await filmaScenes.update(sceneId, { master_image_url: url })
      setScene((prev) => ({ ...prev, master_image_url: url }))
      toast.success('Master image set')
    } catch (err) {
      toast.error('Upload failed')
    } finally {
      setUploadingMaster(false)
    }
  }

  // ── Toggle actor in scene ─────────────────────────────────────────────────
  const handleToggleActor = async (actor) => {
    const inScene = sceneActorIds.includes(actor.id)
    if (inScene) {
      await filmaSceneActors.remove(sceneId, actor.id)
      setSceneActorIds((prev) => prev.filter((id) => id !== actor.id))
    } else {
      await filmaSceneActors.add(filmId, sceneId, actor.id)
      setSceneActorIds((prev) => [...prev, actor.id])
    }
  }

  // ── Outfit upload ─────────────────────────────────────────────────────────
  const handleOutfitUpload = async (actorId, file) => {
    if (!file) {
      // Clear outfit
      await filmaSceneActors.setOutfit(sceneId, actorId, null)
      setOutfits((prev) => { const next = { ...prev }; delete next[actorId]; return next })
      return
    }
    setUploadingOutfit(actorId)
    try {
      const { url } = await filmaUpload(user.id, file, 'scenes/outfits')
      await filmaSceneActors.setOutfit(sceneId, actorId, url)
      setOutfits((prev) => ({ ...prev, [actorId]: url }))
    } catch (err) {
      toast.error('Outfit upload failed')
    } finally {
      setUploadingOutfit(null)
    }
  }

  // ── Save script ───────────────────────────────────────────────────────────
  const handleSaveScript = async () => {
    if (!script.trim()) return
    await filmaScenes.saveScript(sceneId, script)
    setScriptSaved(true)
    toast.success('Script saved')
  }

  // ── Scaffold ──────────────────────────────────────────────────────────────
  const handleScaffold = async () => {
    if (!script.trim()) { toast.error('Paste the scene script first'); return }
    if (sceneActorIds.length === 0) {
      toast('No actors selected — AI will still scaffold shots, but cannot assign dialogue.', { icon: '⚠️' })
    }

    setScaffolding(true)
    try {
      // Save script first
      await filmaScenes.saveScript(sceneId, script)

      const result = await filmaScaffoldScene(sceneId)
      toast.success(`${result.shots_created} shots created`)

      // Reload shots
      const { supabase } = await import('@/lib/supabase')
      const { data: shotData } = await supabase
        .from('filma_shots')
        .select('*')
        .eq('scene_id', sceneId)
        .order('shot_number')
      setShots(shotData || [])
      setScene((prev) => ({ ...prev, scaffolded: true }))
    } catch (err) {
      toast.error(err.message || 'Scaffold failed')
    } finally {
      setScaffolding(false)
    }
  }

  const selectedActors = allActors.filter((a) => sceneActorIds.includes(a.id))
  const sceneTitle = scene ? (scene.title || `Scene ${scene.scene_number}`) : 'Scene'

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(`/filma/${filmId}/structure`)}
          className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{sceneTitle}</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>
            {film?.title || 'Scene Workspace'}
          </span>
        </div>
        <button onClick={() => navigate(`/filma/${filmId}/cast`)}
          className="p-1.5 rounded-xl" style={{ color: 'var(--text-muted)' }}>
          <UserPlus size={18} />
        </button>
      </div>

      {/* Scaffold overlay */}
      <AnimatePresence>
        {scaffolding && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
              background: 'rgba(0,0,0,0.6)' }}>
            <motion.div animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }} />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>
              AI is directing your scene…
            </p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Parsing script into shots
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-6">

          {/* ── Master Image ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>Master Scene Image</p>
            {scene?.master_image_url ? (
              <div className="relative w-full rounded-2xl overflow-hidden"
                style={{ aspectRatio: '16/9' }}>
                <img src={scene.master_image_url} alt="Master"
                  className="w-full h-full object-cover" />
                <label className="absolute bottom-2 right-2 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer"
                  style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
                  <input type="file" accept="image/*" className="hidden"
                    onChange={handleMasterUpload} />
                  <ImagePlus size={12} /> Replace
                </label>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center w-full rounded-2xl cursor-pointer transition-all"
                style={{ aspectRatio: '16/9', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}>
                <input ref={masterRef} type="file" accept="image/*" className="hidden"
                  onChange={handleMasterUpload} />
                {uploadingMaster ? (
                  <Loader2 size={24} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
                ) : (
                  <>
                    <ImagePlus size={24} style={{ color: ACCENT, marginBottom: 8 }} />
                    <span className="text-sm font-semibold" style={{ color: ACCENT }}>Upload Master Image</span>
                    <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Sets the visual anchor for this scene
                    </span>
                  </>
                )}
              </label>
            )}
          </div>

          {/* ── Cast for this scene ── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Scene Cast
              <span className="ml-2 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
                — select actors appearing in this scene
              </span>
            </p>

            {allActors.length === 0 ? (
              <button onClick={() => navigate(`/filma/${filmId}/cast`)}
                className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold w-full"
                style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
                <UserPlus size={15} /> Add actors to this film first
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allActors.map((actor) => (
                  <ActorChip key={actor.id} actor={actor}
                    selected={sceneActorIds.includes(actor.id)}
                    onToggle={handleToggleActor} />
                ))}
                <button onClick={() => navigate(`/filma/${filmId}/cast`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)',
                    border: '1px solid var(--border-color)' }}>
                  <Plus size={11} /> New Actor
                </button>
              </div>
            )}
          </div>

          {/* ── Outfit references ── */}
          {selectedActors.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Outfit References
                <span className="ml-2 font-normal normal-case" style={{ color: 'var(--text-muted)' }}>
                  — per actor for this scene
                </span>
              </p>
              <div className="flex flex-col gap-2">
                {selectedActors.map((actor) => (
                  <OutfitSlot key={actor.id} actor={actor}
                    outfitUrl={outfits[actor.id] || null}
                    onUpload={handleOutfitUpload}
                    uploading={uploadingOutfit} />
                ))}
              </div>
              <p className="text-xs mt-2 px-1" style={{ color: 'var(--text-muted)' }}>
                Outfit reference may include other faces — AI uses it for wardrobe only.
                Character identity comes from their face reference.
              </p>
            </div>
          )}

          {/* ── Script ── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Scene Script</p>
              {script.trim() && !scriptSaved && (
                <button onClick={handleSaveScript}
                  className="text-xs font-semibold px-3 py-1 rounded-lg"
                  style={{ background: ACCENT_SUB, color: ACCENT }}>
                  Save
                </button>
              )}
              {scriptSaved && script === scene?.script_text && (
                <span className="text-xs flex items-center gap-1" style={{ color: '#34D399' }}>
                  <Check size={11} /> Saved
                </span>
              )}
            </div>
            <textarea
              value={script}
              onChange={(e) => { setScript(e.target.value); setScriptSaved(false) }}
              placeholder="Paste the full screenplay for this scene here…&#10;&#10;INT. RADIO HOUSE - NIGHT&#10;&#10;KOFI stands by the window, watching the city lights…"
              rows={10}
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border:     `1.5px solid var(--border-color)`,
                color:      'var(--text-primary)',
                lineHeight: 1.7,
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* ── Scaffold button ── */}
          {!scene?.scaffolded && (
            <button onClick={handleScaffold}
              disabled={!script.trim() || scaffolding}
              className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{
                background: script.trim() ? ACCENT : 'var(--bg-elevated)',
                color:      script.trim() ? '#000'  : 'var(--text-muted)',
              }}>
              <Sparkles size={16} />
              {scaffolding ? 'AI is directing…' : 'Scaffold Scene with AI'}
            </button>
          )}

          {/* Re-scaffold if already done */}
          {scene?.scaffolded && (
            <button onClick={handleScaffold}
              disabled={scaffolding}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
              <Sparkles size={13} />
              {scaffolding ? 'Re-scaffolding…' : 'Re-scaffold Scene'}
            </button>
          )}

          {/* ── Shot list (after scaffold) ── */}
          {shots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Shots — {shots.length} total
              </p>
              <div className="flex flex-col gap-2">
                {shots.map((shot, i) => (
                  <ShotPreviewCard key={shot.id} shot={shot} index={i}
                    onClick={() => navigate(`/filma/${filmId}/shot/${shot.id}`)} />
                ))}
              </div>
            </div>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  )
}
