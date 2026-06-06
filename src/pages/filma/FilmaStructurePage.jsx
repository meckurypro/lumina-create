// src/pages/filma/FilmaStructurePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, Plus, Pencil, Trash2, ChevronRight,
  Film, Check, X,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { filmaFilms, filmaParts, filmaScenes } from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

// ── Inline editable label ─────────────────────────────────────────────────
const InlineEdit = ({ value, onSave, small }) => {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(value)

  const commit = () => {
    if (draft.trim() && draft.trim() !== value) onSave(draft.trim())
    setEditing(false)
  }

  if (editing) return (
    <div className="flex items-center gap-1.5 flex-1 min-w-0">
      <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="flex-1 min-w-0 px-2 py-1 rounded-lg text-sm outline-none"
        style={{ background: 'var(--bg-elevated)', border: `1px solid ${ACCENT_BDR}`,
          color: 'var(--text-primary)' }} />
      <button onClick={commit}
        className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: ACCENT }}>
        <Check size={11} color="#000" />
      </button>
    </div>
  )

  return (
    <button onClick={() => { setDraft(value); setEditing(true) }}
      className="flex items-center gap-1.5 min-w-0 text-left group">
      <span className={`font-bold truncate ${small ? 'text-xs' : 'text-sm'}`}
        style={{ color: 'var(--text-primary)' }}>{value}</span>
      <Pencil size={10} className="opacity-0 group-hover:opacity-60 flex-shrink-0 transition-opacity"
        style={{ color: 'var(--text-muted)' }} />
    </button>
  )
}

// ── Scene row ─────────────────────────────────────────────────────────────
const SceneRow = ({ scene, onOpen, onRename, onDelete }) => (
  <div className="flex items-center gap-3 px-4 py-3 rounded-xl"
    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
    <div className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ background: ACCENT_SUB }}>
      <span className="text-xs font-bold" style={{ color: ACCENT }}>{scene.scene_number}</span>
    </div>
    <div className="flex-1 min-w-0">
      <InlineEdit value={scene.title || `Scene ${scene.scene_number}`}
        onSave={(v) => onRename(scene.id, v)} small />
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {scene.scaffolded ? (
          <span style={{ color: '#34D399' }}>Scaffolded</span>
        ) : 'Not started'}
      </p>
    </div>
    <button onClick={() => onOpen(scene)}
      className="p-1.5 rounded-lg transition-all active:scale-90"
      style={{ color: ACCENT }}>
      <ChevronRight size={16} />
    </button>
    <button onClick={() => onDelete(scene)}
      className="p-1.5 rounded-lg" style={{ color: 'rgba(239,68,68,0.6)' }}>
      <Trash2 size={13} />
    </button>
  </div>
)

// ── Part card ─────────────────────────────────────────────────────────────
const PartCard = ({ part, scenes, onRename, onDelete, onAddScene, onOpenScene, onDeleteScene, onRenameScene }) => {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      {/* Part header */}
      <div className="flex items-center gap-3 px-4 py-3"
        style={{ borderBottom: expanded ? '1px solid var(--border-color)' : 'none' }}>
        <button onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 flex-1 min-w-0 text-left">
          <motion.div animate={{ rotate: expanded ? 90 : 0 }} transition={{ duration: 0.15 }}>
            <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
          </motion.div>
          <InlineEdit value={part.label} onSave={(v) => onRename(part.id, v)} />
          <span className="text-xs font-medium flex-shrink-0"
            style={{ color: 'var(--text-muted)' }}>
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''}
          </span>
        </button>
        <button onClick={() => onDelete(part)}
          className="p-1.5 rounded-lg flex-shrink-0" style={{ color: 'rgba(239,68,68,0.5)' }}>
          <Trash2 size={13} />
        </button>
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 py-3 flex flex-col gap-2">
              {scenes.map((scene) => (
                <SceneRow key={scene.id} scene={scene}
                  onOpen={onOpenScene}
                  onRename={onRenameScene}
                  onDelete={onDeleteScene}
                />
              ))}

              {/* Add scene */}
              <button onClick={() => onAddScene(part)}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB, color: ACCENT }}>
                <Plus size={13} /> Add Scene
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main ──────────────────────────────────────────────────────────────────
export default function FilmaStructurePage() {
  const navigate  = useNavigate()
  const { filmId } = useParams()
  const { user }  = useAuth()

  const [film,     setFilm]    = useState(null)
  const [parts,    setParts]   = useState([])
  const [scenes,   setScenes]  = useState({})  // partId → scene[]
  const [loading,  setLoading] = useState(true)
  const [working,  setWorking] = useState(false)

  useEffect(() => { load() }, [filmId])

  const load = async () => {
    setLoading(true)
    const filmRes = await filmaFilms.getById(filmId)
    if (filmRes.error) { toast.error('Film not found'); navigate('/filma'); return }
    setFilm(filmRes.data)

    const partsRes = await filmaParts.getByFilm(filmId)
    const partList = partsRes.data || []
    setParts(partList)

    // Fetch scenes for all parts
    const sceneMap = {}
    await Promise.all(partList.map(async (p) => {
      const { data } = await filmaScenes.getByPart(p.id)
      sceneMap[p.id] = data || []
    }))
    setScenes(sceneMap)
    setLoading(false)
  }

  // ── Add part ─────────────────────────────────────────────────────────────
  const handleAddPart = async () => {
    setWorking(true)
    const partNumber = parts.length + 1
    const label = film.structure_type === 'series'
      ? `Episode ${partNumber}`
      : film.structure_type === 'multi_part'
      ? `Part ${partNumber}`
      : `Chapter ${partNumber}`

    const { data, error } = await filmaParts.create(filmId, {
      season_number: 1,
      part_number:   partNumber,
      label,
      total_scenes:  1,
    })
    if (error) { toast.error('Could not add part'); setWorking(false); return }

    // Create one scene for it
    const { data: sceneData } = await filmaScenes.bulkCreate(filmId, data.id, 1)

    setParts((prev) => [...prev, data])
    setScenes((prev) => ({ ...prev, [data.id]: sceneData || [] }))
    setWorking(false)
  }

  // ── Rename part ───────────────────────────────────────────────────────────
  const handleRenamePart = async (partId, label) => {
    const { error } = await filmaParts.update(partId, { label })
    if (error) { toast.error('Could not rename'); return }
    setParts((prev) => prev.map((p) => p.id === partId ? { ...p, label } : p))
  }

  // ── Delete part ───────────────────────────────────────────────────────────
  const handleDeletePart = async (part) => {
    if (parts.length <= 1) { toast.error('Film must have at least one part'); return }
    const { error } = await filmaParts.delete(part.id)
    if (error) { toast.error('Could not delete part'); return }
    setParts((prev) => prev.filter((p) => p.id !== part.id))
    setScenes((prev) => { const next = { ...prev }; delete next[part.id]; return next })
    toast.success(`${part.label} removed`)
  }

  // ── Add scene ─────────────────────────────────────────────────────────────
  const handleAddScene = async (part) => {
    const existing  = scenes[part.id] || []
    const nextNum   = (existing[existing.length - 1]?.scene_number || 0) + 1
    const { data, error } = await supabaseInsertScene(filmId, part.id, nextNum)
    if (error) { toast.error('Could not add scene'); return }
    setScenes((prev) => ({ ...prev, [part.id]: [...(prev[part.id] || []), data] }))
    await filmaParts.update(part.id, { total_scenes: nextNum })
  }

  const supabaseInsertScene = async (filmId, partId, sceneNumber) => {
    const { data: rows } = await filmaScenes.bulkCreate(filmId, partId, 1)
    // bulkCreate creates scenes starting at 1; we need to fix the scene_number
    if (rows?.[0]) {
      const { data, error } = await filmaScenes.update(rows[0].id, { scene_number: sceneNumber })
      return { data, error }
    }
    return { data: null, error: 'No scene created' }
  }

  // ── Rename scene ──────────────────────────────────────────────────────────
  const handleRenameScene = async (sceneId, title) => {
    const { error } = await filmaScenes.update(sceneId, { title })
    if (error) { toast.error('Could not rename scene'); return }
    setScenes((prev) => {
      const next = { ...prev }
      for (const partId in next) {
        next[partId] = next[partId].map((s) => s.id === sceneId ? { ...s, title } : s)
      }
      return next
    })
  }

  // ── Delete scene ──────────────────────────────────────────────────────────
  const handleDeleteScene = async (scene) => {
    const partScenes = scenes[scene.part_id] || []
    if (partScenes.length <= 1) { toast.error('Part must have at least one scene'); return }
    const { error } = await filmaScenes.update(scene.id, { script_text: null }) // soft approach
    // Actually delete:
    const { supabase } = await import('@/lib/supabase')
    await supabase.from('filma_scenes').delete().eq('id', scene.id)
    setScenes((prev) => ({
      ...prev,
      [scene.part_id]: (prev[scene.part_id] || []).filter((s) => s.id !== scene.id),
    }))
    toast.success('Scene removed')
  }

  // ── Open scene ────────────────────────────────────────────────────────────
  const handleOpenScene = (scene) => {
    navigate(`/filma/${filmId}/scene/${scene.id}`)
  }

  // ── Auto-generate structure on first load (no parts yet) ──────────────────
  useEffect(() => {
    if (!loading && film && parts.length === 0) {
      autoGenerateStructure()
    }
  }, [loading, film])

  const autoGenerateStructure = async () => {
    if (!film) return
    setWorking(true)

    const count = film.structure_type === 'single'     ? 1
                : film.structure_type === 'multi_part' ? (film.total_parts || 2)
                : (film.total_seasons || 1)  // for series: one season worth of episodes

    const newParts = Array.from({ length: count }, (_, i) => ({
      season_number: 1,
      part_number:   i + 1,
      label: film.structure_type === 'series'     ? `Episode ${i + 1}`
           : film.structure_type === 'multi_part' ? `Part ${i + 1}`
           : 'The Film',
      total_scenes: 3,
    }))

    const { data: createdParts } = await filmaParts.bulkCreate(filmId, newParts)
    if (!createdParts) { setWorking(false); return }

    // Create 3 scenes per part
    const sceneMap = {}
    await Promise.all(createdParts.map(async (p) => {
      const { data } = await filmaScenes.bulkCreate(filmId, p.id, 3)
      sceneMap[p.id] = data || []
    }))

    setParts(createdParts)
    setScenes(sceneMap)
    setWorking(false)
  }

  return (
    <div className="h-dvh flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 lg:px-8 h-14"
        style={{ borderBottom: '1px solid var(--border-color)', borderLeft: `3px solid ${ACCENT}` }}>
        <button onClick={() => navigate(`/filma/${filmId}/cast`)} className="p-2 -ml-2 rounded-xl"
          style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <div className="flex flex-col items-center">
          <h1 className="text-sm font-bold truncate max-w-[180px]"
            style={{ color: 'var(--text-primary)' }}>{film?.title || 'Structure'}</h1>
          <span className="text-xs font-medium" style={{ color: ACCENT }}>Film Structure</span>
        </div>
        <button onClick={() => navigate(`/filma/${filmId}/cast`)}
          className="text-xs font-semibold px-3 py-1.5 rounded-xl"
          style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
          Cast
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl px-4 lg:px-0 py-6 flex flex-col gap-4">

          {loading || working ? (
            <div className="flex flex-col gap-4">
              {[...Array(2)].map((_, i) => (
                <div key={i} className="h-40 rounded-2xl animate-pulse"
                  style={{ background: 'var(--bg-elevated)' }} />
              ))}
            </div>
          ) : (
            <>
              {parts.map((part) => (
                <PartCard key={part.id} part={part}
                  scenes={scenes[part.id] || []}
                  onRename={handleRenamePart}
                  onDelete={handleDeletePart}
                  onAddScene={handleAddScene}
                  onOpenScene={handleOpenScene}
                  onDeleteScene={handleDeleteScene}
                  onRenameScene={handleRenameScene}
                />
              ))}

              {/* Add part button */}
              <button onClick={handleAddPart}
                className="flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB, color: ACCENT }}>
                <Plus size={15} />
                Add {film?.structure_type === 'series' ? 'Episode' : film?.structure_type === 'multi_part' ? 'Part' : 'Chapter'}
              </button>
            </>
          )}

          <div style={{ height: 40 }} />
        </div>
      </div>
    </div>
  )
}
