import { useState, useEffect, useCallback } from 'react'
import {
  Lock, Unlock, CheckCircle, XCircle,
  ChevronDown, ChevronUp, Pencil, Check, X,
  Image, Video, Repeat, Layers, Zap, RefreshCw
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

// ─────────────────────────────────────────────────────────────────────────────
// WAVESPEED PRICING REFERENCE (per-model, sourced from docs)
// image: USD per generation at highest quality
// video: USD per second
// ─────────────────────────────────────────────────────────────────────────────
const WAVESPEED_PRICING = {
  // Image models — per generation (highest quality)
  flux_schnell:           { type: 'image', usd: 0.003  },
  flux_dev_ultra_fast:    { type: 'image', usd: 0.004  },
  flux_dev:               { type: 'image', usd: 0.025  },
  flux_klein:             { type: 'image', usd: 0.002  },
  flux_2_dev:             { type: 'image', usd: 0.007  },
  flux_2_turbo:           { type: 'image', usd: 0.003  },
  flux_2_pro:             { type: 'image', usd: 0.050  },
  flux_2_max:             { type: 'image', usd: 0.080  },
  gpt_image_1_mini:       { type: 'image', usd: 0.020  },
  gpt_image_1_5:          { type: 'image', usd: 0.040  },
  gpt_image_2:            { type: 'image', usd: 0.060  },
  gpt_image_2_hd:         { type: 'image', usd: 0.220  },
  imagen_4_fast:          { type: 'image', usd: 0.020  },
  imagen_4:               { type: 'image', usd: 0.040  },
  imagen_4_ultra:         { type: 'image', usd: 0.060  },
  nano_banana_pro:        { type: 'image', usd: 0.050  },
  nano_banana_2_fast:     { type: 'image', usd: 0.035  },
  seedream_v4_5:          { type: 'image', usd: 0.080  },
  seedream_v5_lite:       { type: 'image', usd: 0.018  },
  wan_2_7_image:          { type: 'image', usd: 0.022  },
  wan_2_7_image_pro:      { type: 'image', usd: 0.040  },
  stable_diffusion_3_5:   { type: 'image', usd: 0.035  },
  grok_imagine:           { type: 'image', usd: 0.015  },
  grok_2_image:           { type: 'image', usd: 0.030  },
  z_image_turbo:          { type: 'image', usd: 0.008  },
  ernie_image_turbo:      { type: 'image', usd: 0.012  },
  face_swap:              { type: 'image', usd: 0.060  },
  head_swap:              { type: 'image', usd: 0.060  },
  // Video models — per second
  wan_2_7:                { type: 'video', usdPerSec: 0.060 },
  grok_video_t2v:         { type: 'video', usdPerSec: 0.040 },
  grok_video_i2v:         { type: 'video', usdPerSec: 0.040 },
  grok_video_ref:         { type: 'video', usdPerSec: 0.040 },
  grok_imagine_video:     { type: 'video', usdPerSec: 0.040 },
  kling_v3_pro:           { type: 'video', usdPerSec: 0.100 },
  kling_v3_std:           { type: 'video', usdPerSec: 0.060 },
  kling_v3_pro_s2e:       { type: 'video', usdPerSec: 0.130 },
  kling_v3_std_s2e:       { type: 'video', usdPerSec: 0.080 },
  kling_v3_pro_motion:    { type: 'video', usdPerSec: 0.090 },
  kling_v3_std_motion:    { type: 'video', usdPerSec: 0.055 },
  kling_v2_6_pro:         { type: 'video', usdPerSec: 0.080 },
  kling_v2_5_turbo_pro_s2e:{ type: 'video', usdPerSec: 0.050 },
  seedance_2_0_i2v:       { type: 'video', usdPerSec: 0.120 },
  seedance_2_0_t2v:       { type: 'video', usdPerSec: 0.120 },
  seedance_1_5_fast_i2v:  { type: 'video', usdPerSec: 0.015 },
  seedance_1_5_fast_t2v:  { type: 'video', usdPerSec: 0.015 },
  seedance_1_5_pro:       { type: 'video', usdPerSec: 0.050 },
  seedance_v1_lite_i2v:   { type: 'video', usdPerSec: 0.010 },
  seedance_2_fast:        { type: 'video', usdPerSec: 0.060 },
  vidu_q3_i2v:            { type: 'video', usdPerSec: 0.090 },
  vidu_q3_pro_s2e:        { type: 'video', usdPerSec: 0.110 },
  vidu_q2_pro_s2e_fast:   { type: 'video', usdPerSec: 0.025 },
  vidu_i2v_q2_turbo:      { type: 'video', usdPerSec: 0.020 },
  vidu_s2v_2:             { type: 'video', usdPerSec: 0.030 },
  vidu_s2e:               { type: 'video', usdPerSec: 0.018 },
  veo3_1_lite:            { type: 'video', usdPerSec: 0.035 },
  veo3_1_fast:            { type: 'video', usdPerSec: 0.070 },
  veo3_1_lite_s2e:        { type: 'video', usdPerSec: 0.095 },
  hailuo_02_pro:          { type: 'video', usdPerSec: 0.200 },
  dreamactor_v2:          { type: 'video', usdPerSec: 0.040 },
  wan_2_2_i2v:            { type: 'video', usdPerSec: 0.025 },
  wan_2_2_i2v_ultra_fast: { type: 'video', usdPerSec: 0.015 },
  wan_2_2_animate:        { type: 'video', usdPerSec: 0.030 },
  wan_2_5:                { type: 'video', usdPerSec: 0.020 },
  wan_2_6:                { type: 'video', usdPerSec: 0.035 },
  hunyuan_video_i2v:      { type: 'video', usdPerSec: 0.150 },
  pixverse_v6:            { type: 'video', usdPerSec: 0.025 },
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY CONFIG
// ─────────────────────────────────────────────────────────────────────────────
const CATEGORIES = [
  {
    key: 'text_to_image',
    label: 'Text → Image',
    icon: Image,
    features: ['text_to_image'],
    color: '#6366f1',
  },
  {
    key: 'image_to_image',
    label: 'Image → Image',
    icon: Repeat,
    features: ['image_to_image', 'text_image_to_image', 'image_generation'],
    color: '#8b5cf6',
  },
  {
    key: 'face_swap',
    label: 'Face / Head Swap',
    icon: Layers,
    features: ['face_swap', 'head_swap'],
    color: '#ec4899',
  },
  {
    key: 'text_to_video',
    label: 'Text → Video',
    icon: Video,
    features: ['text_to_video', 'prompt_to_video'],
    color: '#f59e0b',
  },
  {
    key: 'image_to_video',
    label: 'Image → Video',
    icon: Zap,
    features: ['image_to_video', 'image_text_to_video'],
    color: '#10b981',
  },
  {
    key: 'frame_to_frame',
    label: 'Frame to Frame',
    icon: RefreshCw,
    features: ['frame_to_frame'],
    color: '#06b6d4',
  },
  {
    key: 'motion_transfer',
    label: 'Motion Transfer',
    icon: Layers,
    features: ['motion_transfer', 'cinematic'],
    color: '#f97316',
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// INLINE COST EDITOR
// ─────────────────────────────────────────────────────────────────────────────
function CostPill({ label, value, onSave, color }) {
  const [editing, setEditing] = useState(false)
  const [draft,   setDraft]   = useState(String(value))

  const commit = async () => {
    const n = parseInt(draft, 10)
    if (isNaN(n) || n < 0) { toast.error('Enter a valid number'); return }
    await onSave(n)
    setEditing(false)
  }

  const cancel = () => { setDraft(String(value)); setEditing(false) }

  if (editing) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <input
          autoFocus
          type="number"
          min={0}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel() }}
          style={{
            width: 56, padding: '2px 6px', fontSize: 11, fontWeight: 700,
            borderRadius: 6, border: `1.5px solid ${color}`,
            background: 'var(--bg-input, #1a1a2e)', color: 'var(--text-primary, #fff)',
            outline: 'none',
          }}
        />
        <button onClick={commit}  style={{ color: '#10b981', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><Check size={12} /></button>
        <button onClick={cancel}  style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X size={12} /></button>
      </span>
    )
  }

  return (
    <button
      onClick={() => { setDraft(String(value)); setEditing(true) }}
      title={`Edit ${label}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        padding: '2px 8px', borderRadius: 8, border: `1px solid ${color}33`,
        background: `${color}15`, color, fontSize: 10, fontWeight: 700,
        cursor: 'pointer', letterSpacing: '0.03em', whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      <Pencil size={8} style={{ opacity: 0.7 }} />
      {label} {value}cr
    </button>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MODEL ROW
// ─────────────────────────────────────────────────────────────────────────────
function ModelRow({ model, onUpdate, catColor }) {
  const [saving, setSaving] = useState(null)
  const ws = WAVESPEED_PRICING[model.value]

  const toggle = async (field, current) => {
    setSaving(field)
    const { error } = await supabase
      .from('models')
      .update({ [field]: !current, updated_at: new Date().toISOString() })
      .eq('id', model.id)
    setSaving(null)
    if (error) { toast.error('Update failed'); return }
    onUpdate(model.id, { [field]: !current })
    toast.success(`${model.label} — ${field} set to ${!current}`)
  }

  const saveCost = async (field, value) => {
    const { error } = await supabase
      .from('models')
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq('id', model.id)
    if (error) { toast.error('Cost update failed'); return }
    onUpdate(model.id, { [field]: value })
    toast.success(`${model.label} cost updated`)
  }

  const isActive   = model.is_active
  const isVerified = model.is_verified
  const isLocked   = model.is_locked

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 12,
        padding: '10px 14px',
        borderRadius: 14,
        background: isActive
          ? 'var(--bg-card, rgba(255,255,255,0.04))'
          : 'var(--bg-card-dim, rgba(255,255,255,0.02))',
        border: `1px solid ${isActive ? 'var(--border-color, rgba(255,255,255,0.08))' : 'rgba(255,255,255,0.04)'}`,
        opacity: isActive ? 1 : 0.55,
        transition: 'all 0.2s',
      }}
    >
      {/* LEFT — model info + costs */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary, #fff)', letterSpacing: '-0.01em' }}>
  {model.label}
  {model.aka && (
    <span style={{
      marginLeft: 6, fontSize: 10, fontWeight: 600,
      padding: '1px 7px', borderRadius: 20,
      background: 'rgba(255,255,255,0.08)',
      color: 'var(--text-muted, #888)',
      letterSpacing: '0.03em',
    }}>
      {model.aka}
    </span>
  )}
</span>
          {isLocked && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 5, background: 'rgba(239,68,68,0.15)', color: '#ef4444', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              LOCKED
            </span>
          )}
          {!isVerified && isActive && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '1px 5px', borderRadius: 5, background: 'rgba(251,191,36,0.15)', color: '#fbbf24', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              UNVERIFIED
            </span>
          )}
        </div>

        <p style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 8, lineHeight: 1.3 }}>
          {model.sublabel}
        </p>

        {/* Cost pills */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center' }}>
          <CostPill
            label="T2I"
            value={model.credit_cost_t2i}
            color={catColor}
            onSave={v => saveCost('credit_cost_t2i', v)}
          />
          <CostPill
            label="I2I"
            value={model.credit_cost_i2i}
            color={catColor}
            onSave={v => saveCost('credit_cost_i2i', v)}
          />

          {/* WaveSpeed pricing reference — read only */}
          {ws && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 3,
              padding: '2px 8px', borderRadius: 8,
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.04)',
              color: 'var(--text-muted, #888)', fontSize: 10, fontWeight: 600,
              letterSpacing: '0.02em', whiteSpace: 'nowrap',
            }}>
              WS:&nbsp;
              {ws.type === 'video'
                ? `$${ws.usdPerSec}/sec`
                : `$${ws.usd}/img`
              }
            </span>
          )}
        </div>
      </div>

      {/* RIGHT — toggles */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'flex-end', justifyContent: 'center' }}>

        {/* Active toggle */}
        <button
          onClick={() => toggle('is_active', isActive)}
          disabled={saving === 'is_active'}
          title={isActive ? 'Deactivate' : 'Activate'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 10, border: 'none',
            fontSize: 10, fontWeight: 800, cursor: 'pointer',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            transition: 'all 0.15s',
            background: isActive ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.12)',
            color: isActive ? '#10b981' : '#ef4444',
            minWidth: 76, justifyContent: 'center',
          }}
        >
          {saving === 'is_active' ? '…' : isActive
            ? <><CheckCircle size={10} /> Active</>
            : <><XCircle size={10} /> Inactive</>
          }
        </button>

        {/* Verified toggle */}
        <button
          onClick={() => toggle('is_verified', isVerified)}
          disabled={saving === 'is_verified'}
          title={isVerified ? 'Mark unverified' : 'Mark verified'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 10, border: 'none',
            fontSize: 10, fontWeight: 800, cursor: 'pointer',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            transition: 'all 0.15s',
            background: isVerified ? 'rgba(99,102,241,0.15)' : 'rgba(251,191,36,0.12)',
            color: isVerified ? '#818cf8' : '#fbbf24',
            minWidth: 76, justifyContent: 'center',
          }}
        >
          {saving === 'is_verified' ? '…' : isVerified
            ? <><CheckCircle size={10} /> Verified</>
            : <><XCircle size={10} /> Unverified</>
          }
        </button>

        {/* Lock toggle */}
        <button
          onClick={() => toggle('is_locked', isLocked)}
          disabled={saving === 'is_locked'}
          title={isLocked ? 'Unlock' : 'Lock'}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 10px', borderRadius: 10, border: 'none',
            fontSize: 10, fontWeight: 800, cursor: 'pointer',
            letterSpacing: '0.04em', textTransform: 'uppercase',
            transition: 'all 0.15s',
            background: isLocked ? 'rgba(239,68,68,0.12)' : 'rgba(255,255,255,0.06)',
            color: isLocked ? '#ef4444' : 'var(--text-muted, #888)',
            minWidth: 76, justifyContent: 'center',
          }}
        >
          {saving === 'is_locked' ? '…' : isLocked
            ? <><Lock size={10} /> Locked</>
            : <><Unlock size={10} /> Unlocked</>
          }
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// CATEGORY SECTION
// ─────────────────────────────────────────────────────────────────────────────
function CategorySection({ cat, models, onUpdate }) {
  const [open, setOpen] = useState(true)

  const catModels = models
    .filter(m => cat.features.includes(m.feature))
    .sort((a, b) => {
      // Active before inactive, then by sort_order
      if (a.is_active !== b.is_active) return a.is_active ? -1 : 1
      return (a.sort_order ?? 0) - (b.sort_order ?? 0)
    })

  if (catModels.length === 0) return null

  const activeCount   = catModels.filter(m => m.is_active).length
  const verifiedCount = catModels.filter(m => m.is_verified).length
  const Icon = cat.icon

  return (
    <div style={{
      borderRadius: 18,
      border: `1px solid ${cat.color}22`,
      overflow: 'hidden',
      background: `${cat.color}06`,
    }}>
      {/* Header */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
          borderBottom: open ? `1px solid ${cat.color}18` : 'none',
        }}
      >
        <span style={{
          width: 32, height: 32, borderRadius: 10, display: 'flex',
          alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          background: `${cat.color}20`,
        }}>
          <Icon size={16} color={cat.color} />
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary, #fff)', letterSpacing: '-0.01em' }}>
              {cat.label}
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: `${cat.color}20`, color: cat.color, letterSpacing: '0.04em',
            }}>
              {activeCount}/{catModels.length} active
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 20,
              background: 'rgba(99,102,241,0.15)', color: '#818cf8', letterSpacing: '0.04em',
            }}>
              {verifiedCount} verified
            </span>
          </div>
        </div>

        <span style={{ color: 'var(--text-muted, #888)', flexShrink: 0, display: 'flex' }}>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </span>
      </button>

      {/* Model list */}
      {open && (
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {catModels.map(model => (
            <ModelRow
              key={model.id}
              model={model}
              onUpdate={onUpdate}
              catColor={cat.color}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// STATS BAR
// ─────────────────────────────────────────────────────────────────────────────
function StatsBar({ models }) {
  const total    = models.length
  const active   = models.filter(m => m.is_active).length
  const verified = models.filter(m => m.is_verified).length
  const locked   = models.filter(m => m.is_locked).length

  const stat = (label, value, color) => (
    <div style={{ textAlign: 'center', padding: '8px 16px' }}>
      <div style={{ fontSize: 22, fontWeight: 900, color, letterSpacing: '-0.03em', lineHeight: 1 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--text-muted, #888)', marginTop: 2, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        {label}
      </div>
    </div>
  )

  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', justifyContent: 'space-around',
      padding: '4px 0 12px',
      borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
      marginBottom: 16,
    }}>
      {stat('Total', total, 'var(--text-primary, #fff)')}
      {stat('Active', active, '#10b981')}
      {stat('Verified', verified, '#818cf8')}
      {stat('Locked', locked, '#ef4444')}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// FILTER BAR
// ─────────────────────────────────────────────────────────────────────────────
function FilterBar({ filter, setFilter }) {
  const btn = (key, label, color) => (
    <button
      key={key}
      onClick={() => setFilter(f => f === key ? 'all' : key)}
      style={{
        padding: '5px 12px', borderRadius: 10, border: 'none', fontSize: 11,
        fontWeight: 700, cursor: 'pointer', letterSpacing: '0.03em',
        transition: 'all 0.15s',
        background: filter === key ? `${color}25` : 'var(--bg-card, rgba(255,255,255,0.04))',
        color: filter === key ? color : 'var(--text-muted, #888)',
        outline: filter === key ? `1.5px solid ${color}50` : 'none',
      }}
    >
      {label}
    </button>
  )

  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 16 }}>
      {btn('all',        'All',         '#aaa'    )}
      {btn('active',     'Active',      '#10b981' )}
      {btn('inactive',   'Inactive',    '#ef4444' )}
      {btn('verified',   'Verified',    '#818cf8' )}
      {btn('unverified', 'Unverified',  '#fbbf24' )}
      {btn('locked',     'Locked',      '#ef4444' )}
      {btn('image',      'Images',      '#6366f1' )}
      {btn('video',      'Videos',      '#f59e0b' )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ModelsManager() {
  const [models,  setModels]  = useState([])
  const [loading, setLoading] = useState(true)
  const [filter,  setFilter]  = useState('all')

  const loadModels = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('models')
      .select('*')
      .order('sort_order')
    if (error) toast.error('Failed to load models')
    setModels(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  // Optimistic local update — avoids full refetch on every toggle
  const handleUpdate = useCallback((id, patch) => {
    setModels(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))
  }, [])

  // Apply filter
  const filteredModels = models.filter(m => {
    if (filter === 'active')     return  m.is_active
    if (filter === 'inactive')   return !m.is_active
    if (filter === 'verified')   return  m.is_verified
    if (filter === 'unverified') return !m.is_verified
    if (filter === 'locked')     return  m.is_locked
    if (filter === 'image')      return  m.type === 'image'
    if (filter === 'video')      return  m.type === 'video'
    return true
  })

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 4 }}>
        {[...Array(6)].map((_, i) => (
          <div key={i} style={{
            height: 72, borderRadius: 14,
            background: 'var(--bg-card, rgba(255,255,255,0.04))',
            animation: 'pulse 1.4s ease-in-out infinite',
            animationDelay: `${i * 0.07}s`,
            opacity: 1 - i * 0.12,
          }} />
        ))}
        <style>{`@keyframes pulse { 0%,100%{opacity:0.4} 50%{opacity:0.8} }`}</style>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      <StatsBar models={models} />
      <FilterBar filter={filter} setFilter={setFilter} />

      {/* Helper text */}
      <p style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginBottom: 16, lineHeight: 1.5 }}>
        Tap <strong style={{ color: 'var(--text-primary, #fff)' }}>Active</strong> to enable/disable a model for users.&nbsp;
        <strong style={{ color: 'var(--text-primary, #fff)' }}>Verified</strong> marks production-ready models.&nbsp;
        <strong style={{ color: 'var(--text-primary, #fff)' }}>Locked</strong> shows "Coming Soon" in the UI.&nbsp;
        Tap any <strong style={{ color: 'var(--text-primary, #fff)' }}>credit cost</strong> to edit it inline.&nbsp;
        <em>WS price</em> is the WaveSpeed cost for reference only.
      </p>

      {/* Categories */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {CATEGORIES.map(cat => (
          <CategorySection
            key={cat.key}
            cat={cat}
            models={filteredModels}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {/* Models not matching any category */}
      {(() => {
        const allCatFeatures = CATEGORIES.flatMap(c => c.features)
        const uncategorised = filteredModels.filter(m => !allCatFeatures.includes(m.feature))
        if (!uncategorised.length) return null
        return (
          <div style={{ marginTop: 10 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted, #888)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
              Other ({uncategorised.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {uncategorised.map(model => (
                <ModelRow key={model.id} model={model} onUpdate={handleUpdate} catColor="#888" />
              ))}
            </div>
          </div>
        )
      })()}
    </div>
  )
}
