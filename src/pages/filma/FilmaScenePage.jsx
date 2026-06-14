// src/pages/filma/FilmaScenePage.jsx
import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ImagePlus, X, User, Plus, Check,
  ChevronRight, Sparkles, Loader2, UserPlus,
  Lock, Unlock, Copy, Wand2, ZapIcon,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  filmaScenes, filmaFilms, filmaActors,
  filmaSceneActors, filmaUpload, filmaScaffoldScene,
  filmaShots, filmaSceneEnvironments,
  filmaSuggestScenePrompts, filmaSuggestWardrobePrompt,
  filmaGenerateAsset,
} from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const ssScriptKey = (sceneId) => `filma_scene_script_${sceneId}`

const ENV_SLOT_LABELS = [
  { label: 'Master Shot',     isMaster: true,  sortOrder: 0 },
  { label: 'Angle 2',         isMaster: false, sortOrder: 1 },
  { label: 'Angle 3',         isMaster: false, sortOrder: 2 },
  { label: 'Detail / Insert', isMaster: false, sortOrder: 3 },
]

// ── Actor selector chip ───────────────────────────────────────────────────────
const ActorChip = ({ actor, selected, onToggle, incomplete }) => (
  <button
    onClick={() => onToggle(actor)}
    className="flex items-center gap-2 px-3 py-2 rounded-xl transition-all relative"
    style={{
      background: selected ? ACCENT_SUB    : 'var(--bg-elevated)',
      border:     `1px solid ${selected ? ACCENT_BDR : 'var(--border-color)'}`,
      color:      selected ? ACCENT        : 'var(--text-secondary)',
      opacity:    incomplete ? 0.55 : 1,
    }}
    title={incomplete ? 'Actor profile incomplete — add face photos first' : undefined}
  >
    <div
      className="w-6 h-6 rounded-lg overflow-hidden flex-shrink-0"
      style={{ background: selected ? ACCENT_BDR : 'var(--bg-primary)' }}
    >
      {actor.thumbnail_url || actor.face_reference_url ? (
        <img src={actor.thumbnail_url || actor.face_reference_url} alt={actor.name}
          className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <User size={12} style={{ color: selected ? ACCENT : 'var(--text-muted)' }} />
        </div>
      )}
    </div>
    <span className="text-xs font-semibold">{actor.name}</span>
    {selected && !incomplete && <Check size={11} style={{ color: ACCENT }} />}
    {incomplete && (
      <span className="text-xs px-1 rounded" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', fontSize: 9 }}>
        Incomplete
      </span>
    )}
  </button>
)

// ── Environment slot ──────────────────────────────────────────────────────────
const EnvSlot = ({
  slot, envRow, onUpload, onGenerate, onCopyPrompt,
  onLock, onUnlock, onDelete, uploading, generating,
}) => {
  const hasImage  = !!envRow?.image_url
  const hasPrompt = !!envRow?.prompt_text
  const isLocked  = !!envRow?.locked

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl"
      style={{
        background: 'var(--bg-elevated)',
        border:     `1px solid ${isLocked ? ACCENT_BDR : 'var(--border-color)'}`,
      }}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
            {slot.label}
          </span>
          {slot.isMaster && (
            <span
              className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              Master
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isLocked ? (
            <button
              onClick={onUnlock}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}
            >
              <Lock size={10} /> Locked
            </button>
          ) : hasImage ? (
            <button
              onClick={onLock}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              <Unlock size={10} /> Lock
            </button>
          ) : null}
          {envRow && !isLocked && (
            <button
              onClick={onDelete}
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ color: 'rgba(239,68,68,0.6)' }}
            >
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Image */}
      {hasImage ? (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img src={envRow.image_url} alt={slot.label} className="w-full h-full object-cover" />
          {!isLocked && (
            <label className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => onUpload(e, slot, envRow)} />
              <ImagePlus size={10} /> Replace
            </label>
          )}
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all"
          style={{ aspectRatio: '16/9', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
        >
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => onUpload(e, slot, envRow)} />
          {uploading ? (
            <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <ImagePlus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
              <span className="text-xs font-medium" style={{ color: ACCENT }}>Upload Image</span>
            </>
          )}
        </label>
      )}

      {/* Prompt */}
      {hasPrompt && (
        <div
          className="px-3 py-2.5 rounded-xl text-xs"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <p className="line-clamp-3">{envRow.prompt_text}</p>
        </div>
      )}

      {/* Action row */}
      {!isLocked && (
        <div className="flex gap-2">
          {hasPrompt && (
            <button
              onClick={() => onCopyPrompt(envRow.prompt_text)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              <Copy size={11} /> Copy Prompt
            </button>
          )}
          {hasPrompt && !hasImage && (
            <button
              onClick={() => onGenerate(slot, envRow)}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1"
              style={{ background: ACCENT, color: '#000' }}
            >
              {generating
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ZapIcon size={11} fill="currentColor" />
              }
              {generating ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Outfit slot ───────────────────────────────────────────────────────────────
const OutfitSlot = ({
  actor, sceneActor, onUpload, onGenerate, onCopyPrompt,
  onLock, onUnlock, uploading, generating,
}) => {
  const hasImage   = !!sceneActor?.outfit_image_url
  const hasPrompt  = !!sceneActor?.wardrobe_prompt
  const isLocked   = !!sceneActor?.wardrobe_locked

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl"
      style={{
        background: 'var(--bg-elevated)',
        border:     `1px solid ${isLocked ? ACCENT_BDR : 'var(--border-color)'}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl overflow-hidden flex-shrink-0" style={{ background: ACCENT_SUB }}>
            {actor.thumbnail_url || actor.face_reference_url ? (
              <img src={actor.thumbnail_url || actor.face_reference_url}
                alt={actor.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <User size={14} style={{ color: ACCENT }} />
              </div>
            )}
          </div>
          <p className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{actor.name}</p>
        </div>
        {isLocked ? (
          <button onClick={onUnlock}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{ background: 'rgba(52,211,153,0.1)', color: '#34D399' }}>
            <Lock size={10} /> Locked
          </button>
        ) : hasImage ? (
          <button onClick={onLock}
            className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
            style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
            <Unlock size={10} /> Lock
          </button>
        ) : null}
      </div>

      {/* Outfit image */}
      {hasImage ? (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '3/4' }}>
          <img src={sceneActor.outfit_image_url} alt="outfit" className="w-full h-full object-cover" />
          {!isLocked && (
            <label className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => onUpload(actor.id, e.target.files?.[0])} />
              <ImagePlus size={10} /> Replace
            </label>
          )}
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer"
          style={{ aspectRatio: '3/4', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
        >
          <input type="file" accept="image/*" className="hidden"
            onChange={(e) => onUpload(actor.id, e.target.files?.[0])} />
          {uploading === actor.id ? (
            <Loader2 size={18} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <ImagePlus size={18} style={{ color: ACCENT, marginBottom: 4 }} />
              <span className="text-xs font-medium" style={{ color: ACCENT }}>Upload Outfit</span>
            </>
          )}
        </label>
      )}

      {/* Wardrobe prompt */}
      {hasPrompt && (
        <div
          className="px-3 py-2.5 rounded-xl text-xs"
          style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border-color)',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
          }}
        >
          <p className="line-clamp-4">{sceneActor.wardrobe_prompt}</p>
        </div>
      )}

      {/* Actions */}
      {!isLocked && (
        <div className="flex gap-2">
          {hasPrompt && (
            <button
              onClick={() => onCopyPrompt(sceneActor.wardrobe_prompt)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1"
              style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border-color)' }}
            >
              <Copy size={11} /> Copy Prompt
            </button>
          )}
          {hasPrompt && !hasImage && (
            <button
              onClick={() => onGenerate(actor)}
              disabled={generating === actor.id}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1"
              style={{ background: ACCENT, color: '#000' }}
            >
              {generating === actor.id
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ZapIcon size={11} fill="currentColor" />
              }
              {generating === actor.id ? 'Generating…' : 'Generate'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shot preview card ─────────────────────────────────────────────────────────
const ShotPreviewCard = ({ shot, index, onClick }) => {
  const TYPE_COLOR = {
    dialogue:     ACCENT,
    action:       '#ef4444',
    establishing: '#34D399',
    wide:         '#7C9EFF',
    close_up:     '#FB7BB8',
    default:      'var(--text-muted)',
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
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}18`, border: `1px solid ${color}40` }}
      >
        <span className="text-xs font-bold" style={{ color }}>{shot.shot_number}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold capitalize" style={{ color }}>
            {shot.shot_type.split('_').join(' ')}
          </span>
          {shot.dialogue_text && (
            <span className="text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: `${ACCENT}18`, color: ACCENT }}>Dialogue</span>
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

// ── Main ──────────────────────────────────────────────────────────────────────
export default function FilmaScenePage() {
  const navigate            = useNavigate()
  const { filmId, sceneId } = useParams()
  const { user }            = useAuth()

  const [film,           setFilm]          = useState(null)
  const [scene,          setScene]         = useState(null)
  const [allActors,      setAllActors]     = useState([])
  const [sceneActorIds,  setSceneActorIds] = useState([])
  const [sceneActorMap,  setSceneActorMap] = useState({}) // actorId → sceneActor row
  const [shots,          setShots]         = useState([])
  const [environments,   setEnvironments]  = useState([]) // filma_scene_environments rows
  const [loading,        setLoading]       = useState(true)
  const [scaffolding,    setScaffolding]   = useState(false)
  const [suggestingEnv,  setSuggestingEnv] = useState(false)
  const [suggestingWard, setSuggestingWard]= useState(null) // actorId | null
  const [uploadingMaster,setUploadingMaster] = useState(false)
  const [uploadingEnv,   setUploadingEnv]  = useState(null)  // slotLabel | null
  const [uploadingOutfit,setUploadingOutfit]= useState(null) // actorId | null
  const [generatingEnv,  setGeneratingEnv] = useState(null)  // envId | null
  const [generatingWard, setGeneratingWard]= useState(null)  // actorId | null

  const [script,      setScript]      = useState('')
  const [scriptSaved, setScriptSaved] = useState(false)

  const masterRef = useRef(null)

  // ── Derived state ──────────────────────────────────────────────────────────
  const selectedActors = allActors.filter((a) => sceneActorIds.includes(a.id))

  // Environment ready: has at least a master slot AND all existing slots are locked
  const envReady = environments.length > 0 && environments.every((e) => e.locked)

  // Wardrobe ready: all selected actors have wardrobe_locked = true
  const wardrobeReady = selectedActors.length > 0 &&
    selectedActors.every((a) => sceneActorMap[a.id]?.wardrobe_locked)

  // Can scaffold: has script + env locked + wardrobe locked (or no actors)
  const canScaffold = script.trim() && envReady && (selectedActors.length === 0 || wardrobeReady)

  // ── Load ───────────────────────────────────────────────────────────────────
  useEffect(() => { load() }, [sceneId]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const [filmRes, sceneRes, actorsRes, envsRes] = await Promise.all([
      filmaFilms.getById(filmId),
      filmaScenes.getById(sceneId),
      filmaActors.getByFilm(filmId),
      filmaSceneEnvironments.getByScene(sceneId),
    ])

    if (filmRes.data)  setFilm(filmRes.data)
    if (actorsRes.data) setAllActors(actorsRes.data)
    setEnvironments(envsRes.data || [])

    if (sceneRes.data) {
      const s = sceneRes.data
      setScene(s)

      const ssKey   = ssScriptKey(sceneId)
      const ssValue = (() => { try { return sessionStorage.getItem(ssKey) } catch { return null } })()
      if (ssValue !== null) {
        setScript(ssValue); setScriptSaved(false)
      } else {
        setScript(s.script_text || ''); setScriptSaved(!!s.script_text)
      }

      const ids = (s.filma_scene_actors || []).map((sa) => sa.actor_id)
      const map = {}
      ;(s.filma_scene_actors || []).forEach((sa) => { map[sa.actor_id] = sa })
      setSceneActorIds(ids)
      setSceneActorMap(map)
    }

    if (sceneRes.data?.scaffolded) {
      const { data: shotData } = await filmaShots.getByScene(sceneId)
      setShots(shotData || [])
    }

    setLoading(false)
  }

  // Persist script draft
  useEffect(() => {
    if (loading) return
    const ssKey = ssScriptKey(sceneId)
    try {
      if (script) sessionStorage.setItem(ssKey, script)
      else        sessionStorage.removeItem(ssKey)
    } catch { /* noop */ }
  }, [script, sceneId, loading])

  // ── Toggle actor ───────────────────────────────────────────────────────────
  const handleToggleActor = async (actor) => {
    if (!actor.is_complete) {
      toast.error(`${actor.name}'s profile is incomplete — add face photos first`)
      return
    }
    const inScene = sceneActorIds.includes(actor.id)
    if (inScene) {
      await filmaSceneActors.remove(sceneId, actor.id)
      setSceneActorIds((prev) => prev.filter((id) => id !== actor.id))
      setSceneActorMap((prev) => { const next = { ...prev }; delete next[actor.id]; return next })
    } else {
      const { data } = await filmaSceneActors.add(filmId, sceneId, actor.id)
      setSceneActorIds((prev) => [...prev, actor.id])
      if (data) setSceneActorMap((prev) => ({ ...prev, [actor.id]: data }))
    }
  }

  // ── Environment: AI suggest prompts ───────────────────────────────────────
  const handleSuggestEnvPrompts = async () => {
    if (!script.trim()) {
      toast.error('Paste the scene script first so AI has context')
      return
    }
    setSuggestingEnv(true)
    try {
      const result = await filmaSuggestScenePrompts(sceneId)
      const prompts = result.prompts || []

      // Upsert rows: match by sort_order/is_master, create if not exists
      const updatedEnvs = [...environments]
      for (const p of prompts) {
        const existing = updatedEnvs.find((e) => e.is_master === p.is_master && e.sort_order === p.sort_order)
        if (existing) {
          const { data } = await filmaSceneEnvironments.setPrompt(existing.id, p.prompt_text)
          const idx = updatedEnvs.findIndex((e) => e.id === existing.id)
          if (data) updatedEnvs[idx] = data
        } else {
          const { data } = await filmaSceneEnvironments.create(filmId, sceneId, {
            label:       p.label,
            prompt_text: p.prompt_text,
            is_master:   p.is_master,
            sort_order:  p.sort_order,
            locked:      false,
          })
          if (data) updatedEnvs.push(data)
        }
      }
      setEnvironments(updatedEnvs)
      toast.success(`${prompts.length} environment prompts suggested`)
    } catch (err) {
      toast.error(err.message || 'Suggestion failed')
    } finally {
      setSuggestingEnv(false)
    }
  }

  // ── Environment: upload image ──────────────────────────────────────────────
  const handleEnvUpload = async (e, slot, envRow) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingEnv(slot.label)
    try {
      const result = await filmaSceneEnvironments.uploadAndSave(user.id, filmId, sceneId, file, {
        label:     slot.label,
        isMaster:  slot.isMaster,
        sortOrder: slot.sortOrder,
        envId:     envRow?.id || null,
      })
      if (result.error) throw new Error(result.error.message)
      setEnvironments((prev) => {
        if (envRow) return prev.map((e) => e.id === envRow.id ? result.data : e)
        return [...prev, result.data]
      })
      // Also update filma_scenes.master_image_url for backward compat
      if (slot.isMaster) {
        await filmaScenes.update(sceneId, { master_image_url: result.url })
        setScene((prev) => ({ ...prev, master_image_url: result.url }))
      }
      toast.success(`${slot.label} uploaded`)
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingEnv(null)
    }
  }

  // ── Environment: generate via Filma ───────────────────────────────────────
  const handleEnvGenerate = async (slot, envRow) => {
    if (!envRow?.prompt_text) { toast.error('No prompt — suggest prompts first'); return }
    setGeneratingEnv(envRow.id)
    try {
      const result = await filmaGenerateAsset({
        assetType: 'scene_environment',
        sceneId,
        envId: envRow.id,
        prompt: envRow.prompt_text,
      })
      setEnvironments((prev) =>
        prev.map((e) => e.id === envRow.id ? { ...e, image_url: result.imageUrl } : e)
      )
      toast.success(`${slot.label} generated`)
    } catch (err) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setGeneratingEnv(null)
    }
  }

  // ── Environment: lock / unlock ─────────────────────────────────────────────
  const handleEnvLock   = async (envId) => {
    const { data } = await filmaSceneEnvironments.lock(envId)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === envId ? data : e))
  }
  const handleEnvUnlock = async (envId) => {
    const { data } = await filmaSceneEnvironments.unlock(envId)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === envId ? data : e))
  }
  const handleEnvDelete = async (envId) => {
    await filmaSceneEnvironments.delete(envId)
    setEnvironments((prev) => prev.filter((e) => e.id !== envId))
  }

  // ── Wardrobe: AI suggest prompt ────────────────────────────────────────────
  const handleSuggestWardrobe = async (actor) => {
    setSuggestingWard(actor.id)
    try {
      const result = await filmaSuggestWardrobePrompt(sceneId, actor.id)
      // Save prompt to DB
      const { data } = await supabaseSetWardrobePrompt(sceneId, actor.id, result.prompt)
      setSceneActorMap((prev) => ({
        ...prev,
        [actor.id]: { ...(prev[actor.id] || {}), wardrobe_prompt: result.prompt, wardrobe_locked: false },
      }))
      toast.success(`Wardrobe prompt suggested for ${actor.name}`)
    } catch (err) {
      toast.error(err.message || 'Suggestion failed')
    } finally {
      setSuggestingWard(null)
    }
  }

  // Helper — call Supabase directly for wardrobe prompt (until filma.js is updated)
  const supabaseSetWardrobePrompt = async (sceneId, actorId, promptText) => {
    const { supabase } = await import('@/lib/supabase')
    return supabase
      .from('filma_scene_actors')
      .update({ wardrobe_prompt: promptText, wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
      .select()
      .single()
  }

  // ── Wardrobe: upload outfit ────────────────────────────────────────────────
  const handleOutfitUpload = async (actorId, file) => {
    if (!file) return
    setUploadingOutfit(actorId)
    try {
      const { url } = await filmaUpload(user.id, file, 'scenes/outfits')
      const { supabase } = await import('@/lib/supabase')
      await supabase
        .from('filma_scene_actors')
        .update({ outfit_image_url: url, wardrobe_locked: false })
        .eq('scene_id', sceneId)
        .eq('actor_id', actorId)
      setSceneActorMap((prev) => ({
        ...prev,
        [actorId]: { ...(prev[actorId] || {}), outfit_image_url: url, wardrobe_locked: false },
      }))
    } catch { toast.error('Outfit upload failed') }
    finally { setUploadingOutfit(null) }
  }

  // ── Wardrobe: generate outfit via Filma ───────────────────────────────────
  const handleWardrobeGenerate = async (actor) => {
    const sa = sceneActorMap[actor.id]
    if (!sa?.wardrobe_prompt) { toast.error('No prompt — suggest wardrobe first'); return }
    setGeneratingWard(actor.id)
    try {
      const result = await filmaGenerateAsset({
        assetType: 'wardrobe',
        sceneId,
        actorId: actor.id,
        prompt: sa.wardrobe_prompt,
      })
      setSceneActorMap((prev) => ({
        ...prev,
        [actor.id]: { ...(prev[actor.id] || {}), outfit_image_url: result.imageUrl, wardrobe_locked: false },
      }))
      toast.success(`Outfit generated for ${actor.name}`)
    } catch (err) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setGeneratingWard(null) }
  }

  // ── Wardrobe: lock / unlock ────────────────────────────────────────────────
  const handleWardrobeLock = async (actorId) => {
    const { supabase } = await import('@/lib/supabase')
    await supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: true })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
    setSceneActorMap((prev) => ({
      ...prev, [actorId]: { ...(prev[actorId] || {}), wardrobe_locked: true },
    }))
  }
  const handleWardrobeUnlock = async (actorId) => {
    const { supabase } = await import('@/lib/supabase')
    await supabase
      .from('filma_scene_actors')
      .update({ wardrobe_locked: false })
      .eq('scene_id', sceneId)
      .eq('actor_id', actorId)
    setSceneActorMap((prev) => ({
      ...prev, [actorId]: { ...(prev[actorId] || {}), wardrobe_locked: false },
    }))
  }

  // ── Script ─────────────────────────────────────────────────────────────────
  const handleSaveScript = async () => {
    if (!script.trim()) return
    await filmaScenes.saveScript(sceneId, script)
    setScriptSaved(true)
    try { sessionStorage.removeItem(ssScriptKey(sceneId)) } catch { /* noop */ }
    toast.success('Script saved')
  }

  // ── Scaffold ───────────────────────────────────────────────────────────────
  const handleScaffold = async () => {
    if (!script.trim()) { toast.error('Paste the scene script first'); return }
    if (!envReady)       { toast.error('Lock all environment shots before scaffolding'); return }
    if (selectedActors.length > 0 && !wardrobeReady) {
      toast.error('Lock all actor wardrobes before scaffolding'); return
    }

    setScaffolding(true)
    try {
      await filmaScenes.saveScript(sceneId, script)
      setScriptSaved(true)
      try { sessionStorage.removeItem(ssScriptKey(sceneId)) } catch { /* noop */ }

      const result = await filmaScaffoldScene(sceneId)
      toast.success(`${result.shots_created} shots created`)

      const { data: shotData } = await filmaShots.getByScene(sceneId)
      setShots(shotData || [])
      setScene((prev) => ({ ...prev, scaffolded: true }))
    } catch (err) {
      toast.error(err.message || 'Scaffold failed')
    } finally {
      setScaffolding(false)
    }
  }

  const sceneTitle = scene ? (scene.title || `Scene ${scene.scene_number}`) : 'Scene'

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}
      >
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
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4"
            style={{ backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', background: 'rgba(0,0,0,0.6)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
              className="w-10 h-10 rounded-full border-2"
              style={{ borderColor: ACCENT_BDR, borderTopColor: ACCENT }} />
            <p className="text-sm font-semibold" style={{ color: '#fff' }}>AI is directing your scene…</p>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Parsing script into shots</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-8">

          {/* ── 1. SCENE CAST ─────────────────────────────────────────────── */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: 'var(--text-muted)' }}>
              Scene Cast
              <span className="ml-2 font-normal normal-case">— select actors in this scene</span>
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
                  <ActorChip
                    key={actor.id}
                    actor={actor}
                    selected={sceneActorIds.includes(actor.id)}
                    incomplete={!actor.is_complete}
                    onToggle={handleToggleActor}
                  />
                ))}
                <button onClick={() => navigate(`/filma/${filmId}/cast`)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
                  style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
                  <Plus size={11} /> New Actor
                </button>
              </div>
            )}
          </div>

          {/* ── 2. SCRIPT ─────────────────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: 'var(--text-muted)' }}>Scene Script</p>
              <div className="flex items-center gap-2">
                {script.trim() && !scriptSaved && (
                  <>
                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Unsaved</span>
                    <button onClick={handleSaveScript}
                      className="text-xs font-semibold px-3 py-1 rounded-lg"
                      style={{ background: ACCENT_SUB, color: ACCENT }}>
                      Save
                    </button>
                  </>
                )}
                {scriptSaved && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#34D399' }}>
                    <Check size={11} /> Saved
                  </span>
                )}
              </div>
            </div>
            <textarea
              value={script}
              onChange={(e) => { setScript(e.target.value); setScriptSaved(false) }}
              placeholder={
                'Paste the full screenplay for this scene here…\n\n' +
                'INT. RADIO HOUSE - NIGHT\n\n' +
                'KOFI stands by the window, watching the city lights…'
              }
              rows={10}
              className="w-full px-4 py-3.5 rounded-2xl text-sm outline-none resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: `1.5px solid var(--border-color)`,
                color: 'var(--text-primary)',
                lineHeight: 1.7,
                fontFamily: 'monospace',
              }}
            />
          </div>

          {/* ── 3. ENVIRONMENT SHOTS ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Scene Environment</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Lock all slots to enable shot scaffolding
                </p>
              </div>
              <div className="flex items-center gap-2">
                {envReady && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#34D399' }}>
                    <Lock size={10} /> All locked
                  </span>
                )}
                <button
                  onClick={handleSuggestEnvPrompts}
                  disabled={suggestingEnv || !script.trim()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold"
                  style={{
                    background: script.trim() ? ACCENT_SUB : 'var(--bg-elevated)',
                    color:      script.trim() ? ACCENT     : 'var(--text-muted)',
                    border:     `1px solid ${script.trim() ? ACCENT_BDR : 'var(--border-color)'}`,
                  }}
                >
                  {suggestingEnv
                    ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                    : <Wand2 size={11} />
                  }
                  {suggestingEnv ? 'Suggesting…' : 'Suggest Prompts'}
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {ENV_SLOT_LABELS.map((slot) => {
                const envRow = environments.find(
                  (e) => e.is_master === slot.isMaster && e.sort_order === slot.sortOrder
                ) || null
                return (
                  <EnvSlot
                    key={slot.label}
                    slot={slot}
                    envRow={envRow}
                    onUpload={handleEnvUpload}
                    onGenerate={handleEnvGenerate}
                    onCopyPrompt={(text) => { navigator.clipboard.writeText(text); toast.success('Prompt copied') }}
                    onLock={() => handleEnvLock(envRow?.id)}
                    onUnlock={() => handleEnvUnlock(envRow?.id)}
                    onDelete={() => handleEnvDelete(envRow?.id)}
                    uploading={uploadingEnv === slot.label}
                    generating={generatingEnv === envRow?.id}
                  />
                )
              })}
            </div>
          </div>

          {/* ── 4. WARDROBE ───────────────────────────────────────────────── */}
          {selectedActors.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)' }}>Wardrobe</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Lock all wardrobes to enable shot scaffolding
                  </p>
                </div>
                {wardrobeReady && (
                  <span className="text-xs flex items-center gap-1" style={{ color: '#34D399' }}>
                    <Lock size={10} /> All locked
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {selectedActors.map((actor) => (
                  <div key={actor.id} className="flex flex-col gap-2">
                    <OutfitSlot
                      actor={actor}
                      sceneActor={sceneActorMap[actor.id]}
                      onUpload={handleOutfitUpload}
                      onGenerate={handleWardrobeGenerate}
                      onCopyPrompt={(text) => { navigator.clipboard.writeText(text); toast.success('Prompt copied') }}
                      onLock={() => handleWardrobeLock(actor.id)}
                      onUnlock={() => handleWardrobeUnlock(actor.id)}
                      uploading={uploadingOutfit}
                      generating={generatingWard}
                    />
                    {/* Suggest wardrobe prompt button */}
                    {!sceneActorMap[actor.id]?.wardrobe_locked && (
                      <button
                        onClick={() => handleSuggestWardrobe(actor)}
                        disabled={suggestingWard === actor.id}
                        className="flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-semibold"
                        style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
                      >
                        {suggestingWard === actor.id
                          ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                          : <Wand2 size={11} />
                        }
                        {suggestingWard === actor.id ? 'Suggesting…' : 'Suggest Wardrobe'}
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <p className="text-xs mt-3 px-1" style={{ color: 'var(--text-muted)' }}>
                AI considers full outfit: garments, footwear, hair, makeup, and accessories.
                Copy the prompt to generate elsewhere, or let Filma generate using character face refs.
              </p>
            </div>
          )}

          {/* ── 5. SCAFFOLD / SHOTS ───────────────────────────────────────── */}
          {!scene?.scaffolded ? (
            <div className="flex flex-col gap-2">
              {/* Gate indicators */}
              <div className="flex flex-col gap-1.5 mb-1">
                {[
                  { label: 'Script saved',             ok: scriptSaved },
                  { label: 'Environment locked',        ok: envReady },
                  { label: selectedActors.length > 0 ? 'Wardrobe locked' : 'No actors (skipped)', ok: selectedActors.length === 0 || wardrobeReady },
                ].map(({ label, ok }) => (
                  <div key={label} className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ background: ok ? 'rgba(52,211,153,0.15)' : 'var(--bg-elevated)' }}
                    >
                      {ok
                        ? <Check size={9} style={{ color: '#34D399' }} />
                        : <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--text-muted)' }} />
                      }
                    </div>
                    <span className="text-xs" style={{ color: ok ? '#34D399' : 'var(--text-muted)' }}>
                      {label}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={handleScaffold}
                disabled={!canScaffold || scaffolding}
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{
                  background: canScaffold ? ACCENT : 'var(--bg-elevated)',
                  color:      canScaffold ? '#000'  : 'var(--text-muted)',
                }}
              >
                <Sparkles size={16} />
                {scaffolding ? 'AI is directing…' : 'Scaffold Scene with AI'}
              </button>
            </div>
          ) : (
            <button
              onClick={handleScaffold}
              disabled={scaffolding}
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl text-xs font-semibold transition-all"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              <Sparkles size={13} />
              {scaffolding ? 'Re-scaffolding…' : 'Re-scaffold Scene'}
            </button>
          )}

          {/* Shot list */}
          {shots.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: 'var(--text-muted)' }}>
                Shots — {shots.length} total
              </p>
              <div className="flex flex-col gap-2">
                {shots.map((shot, i) => (
                  <ShotPreviewCard
                    key={shot.id} shot={shot} index={i}
                    onClick={() => navigate(`/filma/${filmId}/shot/${shot.id}`)}
                  />
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
