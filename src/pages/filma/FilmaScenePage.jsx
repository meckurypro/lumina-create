// src/pages/filma/FilmaScenePage.jsx
//
// SCENE ENVIRONMENT — Master-first cardinal angle system
// ──────────────────────────────────────────────────────
// 1. Master Shot: AI generates prompt → user uploads or generates image → user locks it
// 2. Cardinal Angles (N, E, S, W): unlocked only after master is locked
//    - User selects i2i model from dropdown
//    - Per angle: edge function receives master_image_url + angle_key + tailored prompt
//    - AI understands the cinematic assignment for each direction
// DB: filma_scene_environments.angle_key = 'master' | 'N' | 'E' | 'S' | 'W'

import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft, ImagePlus, X, User, Plus, Check,
  ChevronRight, Sparkles, Loader2, UserPlus,
  Lock, Unlock, Copy, Wand2, ZapIcon, ChevronDown,
  Compass,
} from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import {
  filmaScenes, filmaFilms, filmaActors,
  filmaSceneActors, filmaUpload, filmaScaffoldScene,
  filmaShots, filmaSceneEnvironments,
  filmaSuggestScenePrompts, filmaSuggestWardrobePrompt,
  filmaGenerateAsset, filmaGenerateAngleAsset,
} from '@/lib/filma'
import toast from 'react-hot-toast'

const ACCENT     = 'var(--tool-filma)'
const ACCENT_SUB = 'var(--tool-filma-subtle)'
const ACCENT_BDR = 'var(--tool-filma-border)'

const ssScriptKey = (sceneId) => `filma_scene_script_${sceneId}`

// ── Cardinal angle definitions ─────────────────────────────────────────────
// angle_key maps directly to DB column value
const CARDINAL_ANGLES = [
  {
    key:         'N',
    label:       'North',
    badge:       'N',
    description: 'Camera faces south — actors back toward lens. Reverse of master POV. Used for over-shoulder coverage.',
  },
  {
    key:         'E',
    label:       'East',
    badge:       'E',
    description: 'Camera faces west — left profile view. Drama, reaction, side-on tension.',
  },
  {
    key:         'S',
    label:       'South',
    badge:       'S',
    description: 'Camera faces north — pushes into scene depth. Often mirrors master direction. Hero / protagonist angle.',
  },
  {
    key:         'W',
    label:       'West',
    badge:       'W',
    description: 'Camera faces east — right profile. Counter-coverage to East. Balancing shot.',
  },
]

// ── I2I model options ──────────────────────────────────────────────────────
// These should ideally come from your models table filtered by i2i capability.
// Hardcoded here as sensible defaults; swap to a DB fetch if you prefer.
const I2I_MODELS = [
  { id: 'flux-kontext-dev-ultra-fast', label: 'FLUX Kontext (Fast)' },
  { id: 'flux-kontext-pro',            label: 'FLUX Kontext Pro' },
  { id: 'wavespeed-ai/flux-kontext-max', label: 'FLUX Kontext Max' },
]

// ── Helpers ────────────────────────────────────────────────────────────────
const COMPASS_COLOR = { N: '#7C9EFF', E: '#FB7BB8', S: '#34D399', W: '#FBBF24' }

// ── Actor selector chip ────────────────────────────────────────────────────
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

// ── Model selector dropdown ────────────────────────────────────────────────
const ModelSelector = ({ value, onChange, disabled }) => {
  const [open, setOpen] = useState(false)
  const selected = I2I_MODELS.find((m) => m.id === value) || I2I_MODELS[0]

  return (
    <div className="relative">
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold w-full"
        style={{
          background: 'var(--bg-primary)',
          border: `1px solid var(--border-color)`,
          color: 'var(--text-secondary)',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <ZapIcon size={10} style={{ color: ACCENT }} />
        <span className="flex-1 text-left truncate">{selected.label}</span>
        <ChevronDown size={11} style={{ color: 'var(--text-muted)' }} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute top-full left-0 right-0 mt-1 rounded-xl overflow-hidden z-20"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)', boxShadow: '0 8px 24px rgba(0,0,0,0.4)' }}
          >
            {I2I_MODELS.map((m) => (
              <button
                key={m.id}
                onClick={() => { onChange(m.id); setOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-xs font-semibold text-left transition-all"
                style={{
                  color: m.id === value ? ACCENT : 'var(--text-secondary)',
                  background: m.id === value ? ACCENT_SUB : 'transparent',
                }}
              >
                {m.id === value && <Check size={10} style={{ color: ACCENT }} />}
                {m.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Master Shot slot ───────────────────────────────────────────────────────
const MasterSlot = ({
  envRow, onUpload, onGenerate, onCopyPrompt,
  onLock, onUnlock, uploading, generating,
}) => {
  const hasImage  = !!envRow?.image_url
  const hasPrompt = !!envRow?.prompt_text
  const isLocked  = !!envRow?.locked

  return (
    <div
      className="flex flex-col gap-3 p-4 rounded-2xl"
      style={{
        background: 'var(--bg-elevated)',
        border: `2px solid ${isLocked ? '#34D399' : ACCENT_BDR}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center"
            style={{ background: ACCENT_SUB }}
          >
            <Compass size={14} style={{ color: ACCENT }} />
          </div>
          <div>
            <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Master Shot</span>
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded-full font-semibold"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}
            >
              Master
            </span>
          </div>
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

      {/* Description */}
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.6 }}>
        Wide establishing view. Sets the spatial grammar for this scene. All cardinal angles derive from this image.
        AI generates the prompt — you upload or generate the image — then lock it to unlock the four cardinal angles.
      </p>

      {/* Image */}
      {hasImage ? (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img src={envRow.image_url} alt="Master Shot" className="w-full h-full object-cover" />
          {!isLocked && (
            <label className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              <input type="file" accept="image/*" className="hidden"
                onChange={(e) => onUpload(e)} />
              <ImagePlus size={10} /> Replace
            </label>
          )}
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all"
          style={{ aspectRatio: '16/9', border: `1.5px dashed ${ACCENT_BDR}`, background: ACCENT_SUB }}
        >
          <input type="file" accept="image/*" className="hidden" onChange={(e) => onUpload(e)} />
          {uploading ? (
            <Loader2 size={20} style={{ color: ACCENT, animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <ImagePlus size={20} style={{ color: ACCENT, marginBottom: 6 }} />
              <span className="text-xs font-semibold" style={{ color: ACCENT }}>Upload Master Image</span>
              <span className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Use the prompt below to generate it first
              </span>
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
          <p className="line-clamp-4">{envRow.prompt_text}</p>
        </div>
      )}

      {/* Actions */}
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
              onClick={onGenerate}
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

      {/* Lock gate hint */}
      {hasImage && !isLocked && (
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs"
          style={{ background: `${ACCENT}0D`, border: `1px solid ${ACCENT_BDR}`, color: ACCENT }}
        >
          <Lock size={10} />
          Lock the master to activate N / E / S / W angle generation
        </div>
      )}
    </div>
  )
}

// ── Cardinal angle slot ────────────────────────────────────────────────────
const AngleSlot = ({
  angle, envRow, masterEnv, selectedModel, onModelChange,
  onUpload, onGenerate, onCopyPrompt,
  onLock, onUnlock, onDelete,
  uploading, generating, masterLocked,
}) => {
  const hasImage    = !!envRow?.image_url
  const hasPrompt   = !!envRow?.prompt_text
  const isLocked    = !!envRow?.locked
  const masterImage = masterEnv?.image_url
  const color       = COMPASS_COLOR[angle.key]
  const isDisabled  = !masterLocked

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl transition-all"
      style={{
        background: isDisabled ? 'var(--bg-primary)' : 'var(--bg-elevated)',
        border: `1px solid ${isLocked ? color + '60' : isDisabled ? 'var(--border-color)' : 'var(--border-color)'}`,
        opacity: isDisabled ? 0.4 : 1,
        pointerEvents: isDisabled ? 'none' : 'auto',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 font-black text-sm"
            style={{ background: `${color}18`, border: `1px solid ${color}40`, color }}
          >
            {angle.badge}
          </div>
          <div>
            <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>
              {angle.label}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isLocked ? (
            <button onClick={onUnlock}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: `${color}18`, color }}>
              <Lock size={10} /> Locked
            </button>
          ) : hasImage ? (
            <button onClick={onLock}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold"
              style={{ background: ACCENT_SUB, color: ACCENT, border: `1px solid ${ACCENT_BDR}` }}>
              <Unlock size={10} /> Lock
            </button>
          ) : null}
          {envRow && !isLocked && (
            <button onClick={onDelete}
              className="w-6 h-6 rounded-lg flex items-center justify-center"
              style={{ color: 'rgba(239,68,68,0.6)' }}>
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      {/* Angle description */}
      <p className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
        {angle.description}
      </p>

      {/* Image */}
      {hasImage ? (
        <div className="relative w-full rounded-xl overflow-hidden" style={{ aspectRatio: '16/9' }}>
          <img src={envRow.image_url} alt={angle.label} className="w-full h-full object-cover" />
          {!isLocked && (
            <label className="absolute bottom-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold cursor-pointer"
              style={{ background: 'rgba(0,0,0,0.7)', color: '#fff' }}>
              <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
              <ImagePlus size={10} /> Replace
            </label>
          )}
        </div>
      ) : (
        <label
          className="flex flex-col items-center justify-center w-full rounded-xl cursor-pointer transition-all"
          style={{ aspectRatio: '16/9', border: `1.5px dashed ${color}40`, background: `${color}08` }}
        >
          <input type="file" accept="image/*" className="hidden" onChange={onUpload} />
          {uploading ? (
            <Loader2 size={16} style={{ color, animation: 'spin 1s linear infinite' }} />
          ) : (
            <>
              <span className="text-2xl font-black mb-1" style={{ color: `${color}60` }}>{angle.badge}</span>
              <span className="text-xs font-medium" style={{ color: `${color}80` }}>Upload or Generate</span>
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

      {/* Model selector + generate */}
      {!isLocked && masterImage && (
        <div className="flex flex-col gap-2">
          <ModelSelector
            value={selectedModel}
            onChange={onModelChange}
            disabled={isLocked}
          />
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
            <button
              onClick={onGenerate}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold flex-1"
              style={{ background: color, color: '#000' }}
            >
              {generating
                ? <Loader2 size={11} style={{ animation: 'spin 1s linear infinite' }} />
                : <ZapIcon size={11} fill="currentColor" />
              }
              {generating ? 'Generating…' : `Generate ${angle.badge}`}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Outfit slot ────────────────────────────────────────────────────────────
const OutfitSlot = ({
  actor, sceneActor, onUpload, onGenerate, onCopyPrompt,
  onLock, onUnlock, uploading, generating,
}) => {
  const hasImage  = !!sceneActor?.outfit_image_url
  const hasPrompt = !!sceneActor?.wardrobe_prompt
  const isLocked  = !!sceneActor?.wardrobe_locked

  return (
    <div
      className="flex flex-col gap-2 p-3 rounded-2xl"
      style={{
        background: 'var(--bg-elevated)',
        border: `1px solid ${isLocked ? ACCENT_BDR : 'var(--border-color)'}`,
      }}
    >
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

// ── Shot preview card ──────────────────────────────────────────────────────
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

// ── Main ───────────────────────────────────────────────────────────────────
export default function FilmaScenePage() {
  const navigate            = useNavigate()
  const { filmId, sceneId } = useParams()
  const { user }            = useAuth()

  const [film,           setFilm]          = useState(null)
  const [scene,          setScene]         = useState(null)
  const [allActors,      setAllActors]     = useState([])
  const [sceneActorIds,  setSceneActorIds] = useState([])
  const [sceneActorMap,  setSceneActorMap] = useState({})
  const [shots,          setShots]         = useState([])
  const [environments,   setEnvironments]  = useState([])
  const [loading,        setLoading]       = useState(true)
  const [scaffolding,    setScaffolding]   = useState(false)
  const [suggestingEnv,  setSuggestingEnv] = useState(false)
  const [suggestingWard, setSuggestingWard]= useState(null)
  const [uploadingMaster,setUploadingMaster] = useState(false)
  const [uploadingAngle, setUploadingAngle]= useState(null)   // angle_key | null
  const [uploadingOutfit,setUploadingOutfit]= useState(null)
  const [generatingMaster,setGeneratingMaster] = useState(false)
  const [generatingAngle, setGeneratingAngle]  = useState(null) // angle_key | null
  const [generatingWard, setGeneratingWard]= useState(null)

  // Per-angle i2i model selection
  const [angleModels, setAngleModels] = useState({
    N: I2I_MODELS[0].id,
    E: I2I_MODELS[0].id,
    S: I2I_MODELS[0].id,
    W: I2I_MODELS[0].id,
  })

  const [script,      setScript]      = useState('')
  const [scriptSaved, setScriptSaved] = useState(false)

  // ── Derived ──────────────────────────────────────────────────────────────
  const selectedActors = allActors.filter((a) => sceneActorIds.includes(a.id))
  const masterEnv      = environments.find((e) => e.angle_key === 'master') || null
  const masterLocked   = !!masterEnv?.locked

  // Get angle env by key
  const angleEnv = (key) => environments.find((e) => e.angle_key === key) || null

  // Environment ready: master locked + all existing angle envs locked
  const angleEnvs  = environments.filter((e) => e.angle_key !== 'master')
  const envReady   = masterLocked && (angleEnvs.length === 0 || angleEnvs.every((e) => e.locked))

  const wardrobeReady = selectedActors.length > 0 &&
    selectedActors.every((a) => sceneActorMap[a.id]?.wardrobe_locked)

  const canScaffold = script.trim() && envReady && (selectedActors.length === 0 || wardrobeReady)

  // ── Load ─────────────────────────────────────────────────────────────────
  useEffect(() => { load() }, [sceneId]) // eslint-disable-line

  const load = async () => {
    setLoading(true)
    const [filmRes, sceneRes, actorsRes, envsRes] = await Promise.all([
      filmaFilms.getById(filmId),
      filmaScenes.getById(sceneId),
      filmaActors.getByFilm(filmId),
      filmaSceneEnvironments.getByScene(sceneId),
    ])

    if (filmRes.data)   setFilm(filmRes.data)
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

  useEffect(() => {
    if (loading) return
    const ssKey = ssScriptKey(sceneId)
    try {
      if (script) sessionStorage.setItem(ssKey, script)
      else        sessionStorage.removeItem(ssKey)
    } catch { /* noop */ }
  }, [script, sceneId, loading])

  // ── Toggle actor ──────────────────────────────────────────────────────────
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

  // ── Environment: AI suggest master prompt ─────────────────────────────────
  const handleSuggestEnvPrompts = async () => {
    if (!script.trim()) {
      toast.error('Paste the scene script first so AI has context')
      return
    }
    setSuggestingEnv(true)
    try {
      const result = await filmaSuggestScenePrompts(sceneId)
      const prompts = result.prompts || []

      const updatedEnvs = [...environments]
      for (const p of prompts) {
        // filmaSuggestScenePrompts must now return angle_key: 'master' for the master prompt
        const angleKey = p.angle_key || (p.is_master ? 'master' : null)
        if (!angleKey) continue

        const existing = updatedEnvs.find((e) => e.angle_key === angleKey)
        if (existing) {
          const { data } = await filmaSceneEnvironments.setPrompt(existing.id, p.prompt_text)
          const idx = updatedEnvs.findIndex((e) => e.id === existing.id)
          if (data) updatedEnvs[idx] = data
        } else {
          const { data } = await filmaSceneEnvironments.create(filmId, sceneId, {
            label:       p.label || (angleKey === 'master' ? 'Master Shot' : angleKey),
            prompt_text: p.prompt_text,
            angle_key:   angleKey,
            is_master:   angleKey === 'master',
            sort_order:  p.sort_order ?? 0,
            locked:      false,
          })
          if (data) updatedEnvs.push(data)
        }
      }
      setEnvironments(updatedEnvs)
      toast.success('Master shot prompt generated')
    } catch (err) {
      toast.error(err.message || 'Suggestion failed')
    } finally {
      setSuggestingEnv(false)
    }
  }

  // ── Master: upload image ──────────────────────────────────────────────────
  const handleMasterUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingMaster(true)
    try {
      const result = await filmaSceneEnvironments.uploadAndSave(user.id, filmId, sceneId, file, {
        label:     'Master Shot',
        isMaster:  true,
        angleKey:  'master',
        sortOrder: 0,
        envId:     masterEnv?.id || null,
      })
      if (result.error) throw new Error(result.error.message)
      setEnvironments((prev) => {
        if (masterEnv) return prev.map((e) => e.id === masterEnv.id ? result.data : e)
        return [...prev, result.data]
      })
      await filmaScenes.update(sceneId, { master_image_url: result.url })
      setScene((prev) => ({ ...prev, master_image_url: result.url }))
      toast.success('Master shot uploaded')
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingMaster(false)
    }
  }

  // ── Master: generate ──────────────────────────────────────────────────────
  const handleMasterGenerate = async () => {
    if (!masterEnv?.prompt_text) { toast.error('No prompt — suggest prompts first'); return }
    setGeneratingMaster(true)
    try {
      const result = await filmaGenerateAsset({
        assetType: 'scene_environment',
        sceneId,
        envId: masterEnv.id,
        prompt: masterEnv.prompt_text,
      })
      setEnvironments((prev) =>
        prev.map((e) => e.id === masterEnv.id ? { ...e, image_url: result.imageUrl } : e)
      )
      await filmaScenes.update(sceneId, { master_image_url: result.imageUrl })
      setScene((prev) => ({ ...prev, master_image_url: result.imageUrl }))
      toast.success('Master shot generated')
    } catch (err) {
      toast.error(err.message || 'Generation failed')
    } finally {
      setGeneratingMaster(false)
    }
  }

  // ── Master: lock / unlock ─────────────────────────────────────────────────
  const handleMasterLock   = async () => {
    if (!masterEnv?.image_url) { toast.error('Upload or generate the master image first'); return }
    const { data } = await filmaSceneEnvironments.lock(masterEnv.id)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === masterEnv.id ? data : e))
    toast.success('Master locked — N / E / S / W angles now available')
  }
  const handleMasterUnlock = async () => {
    const { data } = await filmaSceneEnvironments.unlock(masterEnv.id)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === masterEnv.id ? data : e))
  }

  // ── Angle: generate i2i via edge function ─────────────────────────────────
  const handleAngleGenerate = async (angle) => {
    if (!masterEnv?.image_url) {
      toast.error('Lock the master shot first')
      return
    }
    setGeneratingAngle(angle.key)
    try {
      const existingRow = angleEnv(angle.key)

      const result = await filmaGenerateAngleAsset({
        sceneId,
        filmId,
        angleKey:       angle.key,        // 'N' | 'E' | 'S' | 'W'
        angleLabel:     angle.label,
        angleDescription: angle.description,
        masterImageUrl: masterEnv.image_url,
        masterPrompt:   masterEnv.prompt_text,
        modelId:        angleModels[angle.key],
        envId:          existingRow?.id || null,
        existingPrompt: existingRow?.prompt_text || null,
      })

      // Upsert the angle env row
      setEnvironments((prev) => {
        const existing = prev.find((e) => e.angle_key === angle.key)
        if (existing) {
          return prev.map((e) => e.angle_key === angle.key
            ? { ...e, image_url: result.imageUrl, prompt_text: result.prompt || e.prompt_text }
            : e)
        }
        return [...prev, result.envRow]
      })

      toast.success(`${angle.label} generated`)
    } catch (err) {
      toast.error(err.message || `${angle.label} generation failed`)
    } finally {
      setGeneratingAngle(null)
    }
  }

  // ── Angle: upload image ───────────────────────────────────────────────────
  const handleAngleUpload = async (angle, e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAngle(angle.key)
    try {
      const existingRow = angleEnv(angle.key)
      const result = await filmaSceneEnvironments.uploadAndSave(user.id, filmId, sceneId, file, {
        label:     angle.label,
        isMaster:  false,
        angleKey:  angle.key,
        sortOrder: CARDINAL_ANGLES.findIndex((a) => a.key === angle.key) + 1,
        envId:     existingRow?.id || null,
      })
      if (result.error) throw new Error(result.error.message)
      setEnvironments((prev) => {
        if (existingRow) return prev.map((e) => e.id === existingRow.id ? result.data : e)
        return [...prev, result.data]
      })
      toast.success(`${angle.label} uploaded`)
    } catch (err) {
      toast.error(err.message || 'Upload failed')
    } finally {
      setUploadingAngle(null)
    }
  }

  // ── Angle: lock / unlock / delete ─────────────────────────────────────────
  const handleAngleLock   = async (key) => {
    const row = angleEnv(key)
    if (!row) return
    const { data } = await filmaSceneEnvironments.lock(row.id)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === row.id ? data : e))
  }
  const handleAngleUnlock = async (key) => {
    const row = angleEnv(key)
    if (!row) return
    const { data } = await filmaSceneEnvironments.unlock(row.id)
    if (data) setEnvironments((prev) => prev.map((e) => e.id === row.id ? data : e))
  }
  const handleAngleDelete = async (key) => {
    const row = angleEnv(key)
    if (!row) return
    await filmaSceneEnvironments.delete(row.id)
    setEnvironments((prev) => prev.filter((e) => e.id !== row.id))
  }

  // ── Wardrobe ──────────────────────────────────────────────────────────────
  const handleSuggestWardrobe = async (actor) => {
    setSuggestingWard(actor.id)
    try {
      const result = await filmaSuggestWardrobePrompt(sceneId, actor.id)
      const { data } = await filmaSceneActors.setWardrobePrompt(sceneId, actor.id, result.prompt)
      setSceneActorMap((prev) => ({
        ...prev,
        [actor.id]: data || { ...(prev[actor.id] || {}), wardrobe_prompt: result.prompt, wardrobe_locked: false },
      }))
      toast.success(`Wardrobe prompt suggested for ${actor.name}`)
    } catch (err) {
      toast.error(err.message || 'Suggestion failed')
    } finally {
      setSuggestingWard(null)
    }
  }

  const handleOutfitUpload = async (actorId, file) => {
    if (!file) return
    setUploadingOutfit(actorId)
    try {
      const { data, error, url } = await filmaSceneActors.uploadOutfitAndSave(user.id, sceneId, actorId, file)
      if (error) throw new Error(error.message)
      setSceneActorMap((prev) => ({
        ...prev,
        [actorId]: data || { ...(prev[actorId] || {}), outfit_image_url: url, wardrobe_locked: false },
      }))
    } catch { toast.error('Outfit upload failed') }
    finally { setUploadingOutfit(null) }
  }

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
      setGeneratingWard(null)
    }
  }

  const handleWardrobeLock = async (actorId) => {
    const { data } = await filmaSceneActors.lockWardrobe(sceneId, actorId)
    setSceneActorMap((prev) => ({
      ...prev,
      [actorId]: data || { ...(prev[actorId] || {}), wardrobe_locked: true },
    }))
  }
  const handleWardrobeUnlock = async (actorId) => {
    const { data } = await filmaSceneActors.unlockWardrobe(sceneId, actorId)
    setSceneActorMap((prev) => ({
      ...prev,
      [actorId]: data || { ...(prev[actorId] || {}), wardrobe_locked: false },
    }))
  }

  // ── Script ────────────────────────────────────────────────────────────────
  const handleSaveScript = async () => {
    if (!script.trim()) return
    await filmaScenes.saveScript(sceneId, script)
    setScriptSaved(true)
    try { sessionStorage.removeItem(ssScriptKey(sceneId)) } catch { /* noop */ }
    toast.success('Script saved')
  }

  // ── Scaffold ──────────────────────────────────────────────────────────────
  const handleScaffold = async () => {
    if (!script.trim()) { toast.error('Paste the scene script first'); return }
    if (!envReady)       { toast.error('Lock master + angle shots before scaffolding'); return }
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

          {/* ── 1. SCENE CAST ────────────────────────────────────────────── */}
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

          {/* ── 2. SCRIPT ────────────────────────────────────────────────── */}
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

          {/* ── 3. SCENE ENVIRONMENT ─────────────────────────────────────── */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--text-muted)' }}>Scene Environment</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  Lock master → generate N / E / S / W angles → lock all to scaffold
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

              {/* Master Shot — always first */}
              <MasterSlot
                envRow={masterEnv}
                onUpload={handleMasterUpload}
                onGenerate={handleMasterGenerate}
                onCopyPrompt={(text) => { navigator.clipboard.writeText(text); toast.success('Prompt copied') }}
                onLock={handleMasterLock}
                onUnlock={handleMasterUnlock}
                uploading={uploadingMaster}
                generating={generatingMaster}
              />

              {/* Cardinal angles — gated behind master lock */}
              <div className="flex flex-col gap-3">
                {/* Section header */}
                <div className="flex items-center gap-3 mt-1">
                  <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                  <div className="flex items-center gap-1.5">
                    <Compass size={11} style={{ color: masterLocked ? ACCENT : 'var(--text-muted)' }} />
                    <span className="text-xs font-semibold uppercase tracking-widest"
                      style={{ color: masterLocked ? ACCENT : 'var(--text-muted)' }}>
                      Cardinal Angles
                    </span>
                  </div>
                  <div className="flex-1 h-px" style={{ background: 'var(--border-color)' }} />
                </div>

                {!masterLocked && (
                  <div
                    className="flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-medium"
                    style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)', color: 'var(--text-muted)' }}
                  >
                    <Lock size={11} />
                    Lock the master shot to generate N / E / S / W angles
                  </div>
                )}

                {CARDINAL_ANGLES.map((angle) => (
                  <AngleSlot
                    key={angle.key}
                    angle={angle}
                    envRow={angleEnv(angle.key)}
                    masterEnv={masterEnv}
                    selectedModel={angleModels[angle.key]}
                    onModelChange={(modelId) => setAngleModels((prev) => ({ ...prev, [angle.key]: modelId }))}
                    onUpload={(e) => handleAngleUpload(angle, e)}
                    onGenerate={() => handleAngleGenerate(angle)}
                    onCopyPrompt={(text) => { navigator.clipboard.writeText(text); toast.success('Prompt copied') }}
                    onLock={() => handleAngleLock(angle.key)}
                    onUnlock={() => handleAngleUnlock(angle.key)}
                    onDelete={() => handleAngleDelete(angle.key)}
                    uploading={uploadingAngle === angle.key}
                    generating={generatingAngle === angle.key}
                    masterLocked={masterLocked}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* ── 4. WARDROBE ──────────────────────────────────────────────── */}
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

          {/* ── 5. SCAFFOLD / SHOTS ──────────────────────────────────────── */}
          {!scene?.scaffolded ? (
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-1.5 mb-1">
                {[
                  { label: 'Script saved',              ok: scriptSaved },
                  { label: 'Master shot locked',         ok: masterLocked },
                  { label: 'Environment fully locked',   ok: envReady },
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
