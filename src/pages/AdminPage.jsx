// src/pages/AdminPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, Film, DollarSign,
  Edit3, Save, X, CheckCircle, XCircle,
  RotateCcw, TrendingUp, Clock, AlertTriangle,
  Zap, Lock, Unlock, Upload, Trash2, Image,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Stat Card ────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color = 'var(--brand)', sub }) => (
  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
      {value}
    </p>
    {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
)

// ─── Prompt Editor ────────────────────────────────────────

const PromptEditor = ({ template, onSave }) => {
  const { user }                           = useAuth()
  const [prompts,       setPrompts]        = useState([])
  const [editingPrompt, setEditingPrompt]  = useState('')
  const [editingNotes,  setEditingNotes]   = useState('')
  const [isEditing,     setIsEditing]      = useState(false)
  const [saving,        setSaving]         = useState(false)
  const [loading,       setLoading]        = useState(true)

  const loadPrompts = useCallback(async () => {
    const { data } = await supabase
      .from('template_prompts')
      .select('*')
      .eq('template_id', template.id)
      .order('version_number', { ascending: false })
    setPrompts(data || [])
    const active = data?.find((p) => p.is_active)
    if (active) setEditingPrompt(active.prompt_text)
    setLoading(false)
  }, [template.id])

  useEffect(() => { loadPrompts() }, [loadPrompts])

  const handleSave = async () => {
    if (!editingPrompt.trim()) return toast.error('Prompt cannot be empty')
    setSaving(true)
    const { data, error } = await supabase.rpc('save_prompt_version', {
      p_admin_id:    user.id,
      p_template_id: template.id,
      p_prompt_text: editingPrompt,
      p_notes:       editingNotes || null,
    })
    setSaving(false)
    if (error || !data?.success) { toast.error('Failed to save prompt'); return }
    toast.success(`Saved as version ${data.version}!`)
    setIsEditing(false)
    setEditingNotes('')
    loadPrompts()
    onSave?.()
  }

  const handleRollback = async (promptId) => {
    const { data, error } = await supabase.rpc('rollback_prompt_version', {
      p_admin_id:  user.id,
      p_prompt_id: promptId,
    })
    if (error || !data?.success) { toast.error('Failed to rollback'); return }
    toast.success('Rolled back!')
    loadPrompts()
  }

  const activePrompt = prompts.find((p) => p.is_active)

  return (
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
            {template.name}
          </h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {prompts.length} version{prompts.length !== 1 ? 's' : ''} · Used {template.usage_count ?? 0} times
          </p>
        </div>
        {isEditing ? (
          <div className="flex gap-2">
            <Button onClick={() => setIsEditing(false)} variant="ghost" size="sm" icon={X}>Cancel</Button>
            <Button onClick={handleSave} loading={saving} variant="primary" size="sm" icon={Save}>Save</Button>
          </div>
        ) : (
          <Button onClick={() => setIsEditing(true)} variant="outline" size="sm" icon={Edit3}>Edit</Button>
        )}
      </div>

      <div className="p-4">
        {loading ? (
          <Skeleton className="h-24 w-full" />
        ) : isEditing ? (
          <div className="flex flex-col gap-3">
            <textarea
              value={editingPrompt}
              onChange={(e) => setEditingPrompt(e.target.value)}
              rows={5}
              className="input-base resize-none"
              style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '13px' }}
            />
            <input
              value={editingNotes}
              onChange={(e) => setEditingNotes(e.target.value)}
              placeholder="Version notes (optional)..."
              className="input-base text-sm"
            />
          </div>
        ) : activePrompt ? (
          <p className="text-sm leading-relaxed" style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-secondary)', fontSize: '12px' }}>
            {activePrompt.prompt_text}
          </p>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active prompt yet.</p>
        )}
      </div>

      {prompts.length > 1 && (
        <div style={{ borderTop: '1px solid var(--border)' }}>
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
            Version history
          </p>
          {prompts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--border)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>v{p.version_number}</span>
                  {p.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--brand)' }}>
                      Active
                    </span>
                  )}
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</span>
                </div>
                {p.notes && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.notes}</p>}
              </div>
              {!p.is_active && (
                <button
                  onClick={() => handleRollback(p.id)}
                  className="flex items-center gap-1 text-xs px-2 py-1 rounded-lg"
                  style={{ color: 'var(--brand)', background: 'rgba(249,115,22,0.1)' }}
                >
                  <RotateCcw size={10} /> Restore
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Template Visibility + Asset Manager ─────────────────

const TemplateManager = ({ templates, onRefresh }) => {
  const { user }                      = useAuth()
  const [uploading, setUploading]     = useState({})
  const [assets, setAssets]           = useState({})

  const loadAssets = useCallback(async (templateId) => {
    const { data } = await supabase
      .from('template_assets')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
    setAssets((prev) => ({ ...prev, [templateId]: data || [] }))
  }, [])

  useEffect(() => {
    templates.forEach((t) => loadAssets(t.id))
  }, [templates, loadAssets])

  const handleToggleVisibility = async (template) => {
    const next = template.visibility === 'promptiq' ? 'public' : 'promptiq'
    const { error } = await supabase
      .from('templates')
      .update({ visibility: next, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    if (error) { toast.error('Failed to update visibility'); return }
    toast.success(`Moved to ${next === 'promptiq' ? 'PromptIQ' : 'Public'}`)
    onRefresh()
  }

  const handleToggleActive = async (template) => {
    const { error } = await supabase
      .from('templates')
      .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(template.is_active ? 'Template hidden' : 'Template activated')
    onRefresh()
  }

  const handleAssetUpload = async (template, assetKey, file) => {
    const key = `${template.id}_${assetKey}`
    setUploading((prev) => ({ ...prev, [key]: true }))

    const ext  = file.name.split('.').pop()
    const path = `${template.id}/${assetKey}.${ext}`

    const { error: storageErr } = await supabase.storage
      .from('template-assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' })

    if (storageErr) {
      toast.error('Upload failed')
      setUploading((prev) => ({ ...prev, [key]: false }))
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('template-assets').getPublicUrl(path)

    await supabase.from('template_assets').upsert(
      { template_id: template.id, asset_key: assetKey, file_name: file.name, file_type: file.type, storage_path: path, public_url: publicUrl, updated_at: new Date().toISOString() },
      { onConflict: 'template_id,asset_key' }
    )

    toast.success('Asset uploaded!')
    setUploading((prev) => ({ ...prev, [key]: false }))
    loadAssets(template.id)
  }

  const handleDeleteAsset = async (templateId, assetKey, storagePath) => {
    await supabase.storage.from('template-assets').remove([storagePath])
    await supabase.from('template_assets').delete().eq('template_id', templateId).eq('asset_key', assetKey)
    toast.success('Asset deleted')
    loadAssets(templateId)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Toggle visibility between PromptIQ (staff-only) and Public. Upload or replace media assets per template.
      </p>

      {templates.map((template) => {
        const isPromptIQ = template.visibility === 'promptiq'
        const templateAssets = assets[template.id] || []

        return (
          <div
            key={template.id}
            className="rounded-2xl overflow-hidden"
            style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}
          >
            {/* Header row */}
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              {/* Thumbnail */}
              <div
                className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center"
                style={{ background: 'rgba(249,115,22,0.1)' }}
              >
                {template.thumbnail_url
                  ? <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
                  : <Zap size={20} style={{ color: 'var(--brand)' }} />
                }
              </div>

              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {template.name}
                </p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {template.usage_count ?? 0} uses
                </p>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {/* Active toggle */}
                <button
                  onClick={() => handleToggleActive(template)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold"
                  style={{
                    background: template.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                    color:      template.is_active ? '#10b981' : '#ef4444',
                  }}
                >
                  {template.is_active ? 'Live' : 'Hidden'}
                </button>

                {/* Visibility toggle */}
                <button
                  onClick={() => handleToggleVisibility(template)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-bold transition-all"
                  style={{
                    background: isPromptIQ ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)',
                    color:      isPromptIQ ? 'var(--brand)' : '#10b981',
                  }}
                  title={isPromptIQ ? 'Move to Public' : 'Move to PromptIQ'}
                >
                  {isPromptIQ ? <Lock size={11} /> : <Unlock size={11} />}
                  {isPromptIQ ? 'PromptIQ' : 'Public'}
                </button>
              </div>
            </div>

            {/* Asset management */}
            <div className="p-4">
              <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-muted)' }}>
                Media Assets
              </p>

              {/* Existing assets */}
              {templateAssets.length > 0 && (
                <div className="flex flex-col gap-2 mb-3">
                  {templateAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="flex items-center gap-3 p-2 rounded-xl"
                      style={{ background: 'var(--bg-elevated)' }}
                    >
                      {asset.file_type?.startsWith('image/') ? (
                        <img src={asset.public_url} alt={asset.asset_key} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
                          <Image size={16} style={{ color: 'var(--brand)' }} />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {asset.asset_key}
                        </p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{asset.file_name}</p>
                      </div>
                      <button
                        onClick={() => handleDeleteAsset(template.id, asset.asset_key, asset.storage_path)}
                        className="p-1.5 rounded-lg"
                        style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                        aria-label="Delete asset"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload new asset */}
              <label
                className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl cursor-pointer transition-colors"
                style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border)' }}
              >
                <Upload size={14} style={{ color: 'var(--brand)' }} />
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                  Upload asset (thumbnail, audio, overlay…)
                </span>
                <input
                  type="file"
                  accept="image/*,video/*,audio/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    const assetKey = file.name.split('.')[0].toLowerCase().replace(/\s+/g, '-')
                    handleAssetUpload(template, assetKey, file)
                    e.target.value = ''
                  }}
                />
              </label>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Feed Moderation Item ─────────────────────────────────

const FeedModerationItem = ({ post, onApprove, onReject }) => (
  <div className="rounded-2xl overflow-hidden mb-3" style={{ border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
    <div className="flex gap-3 p-3">
      <div className="w-16 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-black">
        <img src={post.thumbnail_url} alt={`Post by @${post.profiles?.username}`} className="w-full h-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{post.profiles?.username}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{post.templates?.name || post.output_type}</p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{new Date(post.created_at).toLocaleDateString()}</p>
        <div className="flex gap-2 mt-3">
          <button onClick={() => onApprove(post.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>
            <CheckCircle size={12} /> Approve
          </button>
          <button onClick={() => onReject(post.id)} className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-semibold" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            <XCircle size={12} /> Reject
          </button>
        </div>
      </div>
    </div>
  </div>
)

// ─── Staff Manager ────────────────────────────────────────

const StaffManager = () => {
  const { user }                      = useAuth()
  const [staffList,    setStaffList]  = useState([])
  const [allUsers,     setAllUsers]   = useState([])
  const [poolBalance,  setPoolBalance] = useState(null)
  const [loading,      setLoading]    = useState(true)
  const [searchQuery,  setSearchQuery] = useState('')
  const [promoting,    setPromoting]  = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)

    const [staffRes, usersRes] = await Promise.all([
      supabase.from('profiles').select('id, username, display_name, avatar_url, credits, total_generations').eq('is_staff', true).order('username'),
      supabase.from('profiles').select('id, username, display_name, credits').eq('is_staff', false).neq('role', 'admin').order('username').limit(50),
    ])

    setStaffList(staffRes.data  || [])
    setAllUsers(usersRes.data   || [])

    const { data: poolSetting } = await supabase.from('app_settings').select('value').eq('key', 'staff_pool_user_id').single()
    if (poolSetting?.value) {
      const { data: poolProfile } = await supabase.from('profiles').select('credits, username').eq('id', poolSetting.value).single()
      setPoolBalance(poolProfile?.credits ?? null)
    }

    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handlePromote = async (userId, username) => {
    setPromoting(userId)
    const { data, error } = await supabase.rpc('promote_to_staff', {
      p_admin_id: user.id,
      p_user_id:  userId,
      p_note:     'Promoted via Admin Panel',
    })
    setPromoting(null)
    if (error || !data?.success) { toast.error('Failed to promote user'); return }
    toast.success(`@${username} is now staff!`)
    loadData()
  }

  const handleDemote = async (userId, username) => {
    const { data, error } = await supabase.rpc('demote_from_staff', {
      p_admin_id: user.id,
      p_user_id:  userId,
    })
    if (error || !data?.success) { toast.error('Failed to demote user'); return }
    toast.success(`@${username} removed from staff`)
    loadData()
  }

  const filteredUsers = allUsers.filter((u) =>
    u.username?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) return <Skeleton className="h-64 w-full" />

  return (
    <div className="flex flex-col gap-5">

      {/* Pool balance */}
      <div className="rounded-2xl p-4" style={{ background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)' }}>
        <div className="flex items-center gap-2 mb-1">
          <Zap size={14} fill="var(--brand)" style={{ color: 'var(--brand)' }} />
          <p className="text-sm font-bold" style={{ color: 'var(--brand)' }}>Staff Credit Pool</p>
        </div>
        <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
          {poolBalance !== null ? `⚡ ${Math.floor(poolBalance)} credits` : 'Not configured'}
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Set staff_pool_user_id in app_settings to configure a dedicated pool account.
        </p>
      </div>

      {/* Current staff */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Current Staff ({staffList.length})
        </p>
        {staffList.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No staff members yet.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {staffList.map((s) => (
              <div key={s.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--brand)', color: 'white' }}>
                  {s.username?.[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{s.username}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {s.credits?.toFixed(1)} credits · {s.total_generations} gens</p>
                </div>
                <button
                  onClick={() => handleDemote(s.id, s.username)}
                  className="text-xs px-3 py-1.5 rounded-xl font-semibold"
                  style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Promote a user */}
      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
          Promote User to Staff
        </p>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by username…"
          className="input-base text-sm w-full mb-3"
        />
        <div className="flex flex-col gap-2 max-h-60 overflow-y-auto no-scrollbar">
          {filteredUsers.map((u) => (
            <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                {u.username?.[0]?.toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{u.username}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>⚡ {u.credits?.toFixed(1)} credits</p>
              </div>
              <button
                onClick={() => handlePromote(u.id, u.username)}
                disabled={promoting === u.id}
                className="text-xs px-3 py-1.5 rounded-xl font-bold"
                style={{ background: 'rgba(249,115,22,0.12)', color: 'var(--brand)' }}
              >
                {promoting === u.id ? '…' : 'Promote'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Provider Settings ────────────────────────────────────

const SETTING_KEYS = ['active_provider', 'model_kling', 'model_seedance', 'model_image']

const ProviderSettings = () => {
  const [settings, setSettings] = useState({})
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', SETTING_KEYS)
      setSettings(Object.fromEntries((data || []).map((r) => [r.key, JSON.parse(r.value)])))
      setLoading(false)
    }
    load()
  }, [])

  const updateSetting = async (key, value) => {
    setSaving(true)
    const { error } = await supabase.from('app_settings').update({ value: JSON.stringify(value) }).eq('key', key)
    setSaving(false)
    if (error) { toast.error('Failed to update setting'); return }
    setSettings((prev) => ({ ...prev, [key]: value }))
    toast.success('Setting updated!')
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const ToggleGroup = ({ label, settingKey, options, description }) => (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {description && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateSetting(settingKey, opt.value)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: settings[settingKey] === opt.value ? 'var(--brand)' : 'var(--bg-elevated)',
              color:      settings[settingKey] === opt.value ? 'white' : 'var(--text-muted)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Changes apply instantly to all new generations. Failed generations automatically fall back to the other provider.
      </p>
      <ToggleGroup label="Active Provider" settingKey="active_provider" description="Primary AI provider for all generation requests." options={[{ value: 'fal', label: 'fal.ai' }, { value: 'wavespeed', label: 'WaveSpeed' }]} />
      <ToggleGroup label="Kling Model" settingKey="model_kling" options={[{ value: 'kling_2_5', label: 'Kling 2.5' }, { value: 'kling_3_0', label: 'Kling 3.0' }]} />
      <ToggleGroup label="Seedance Model" settingKey="model_seedance" options={[{ value: 'seedance_1_5', label: 'Seedance 1.5' }, { value: 'seedance_2_0', label: 'Seedance 2.0' }]} />
      <ToggleGroup label="Image Model" settingKey="model_image" options={[{ value: 'imagen_3_fast', label: 'Imagen 3 Fast' }, { value: 'imagen_3', label: 'Imagen 3' }]} />
    </div>
  )
}

// ─── Tabs ─────────────────────────────────────────────────

const TABS = (pendingCount) => [
  { id: 'dashboard', label: 'Dashboard'              },
  { id: 'prompts',   label: 'Prompts'                },
  { id: 'templates', label: 'Templates'              },
  { id: 'staff',     label: 'Staff'                  },
  { id: 'feed',      label: `Feed (${pendingCount})` },
  { id: 'users',     label: 'Users'                  },
  { id: 'settings',  label: 'Settings'               },
]

// ─── Admin Page ───────────────────────────────────────────

export default function AdminPage() {
  const navigate        = useNavigate()
  const { user }        = useAuth()
  const [activeTab,     setActiveTab]    = useState('dashboard')
  const [stats,         setStats]        = useState(null)
  const [templates,     setTemplates]    = useState([])
  const [pendingPosts,  setPendingPosts] = useState([])
  const [recentUsers,   setRecentUsers]  = useState([])
  const [loading,       setLoading]      = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [statsRes, templatesRes, feedRes, usersRes] = await Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.from('templates').select('*').order('sort_order'),
      supabase.from('feed_posts').select('*, profiles(username), templates(name)').eq('status', 'pending').order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles').select('id, username, display_name, credits, total_generations, tier, created_at').order('created_at', { ascending: false }).limit(20),
    ])
    setStats(statsRes.data)
    setTemplates(templatesRes.data || [])
    setPendingPosts(feedRes.data   || [])
    setRecentUsers(usersRes.data   || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleApprove = async (postId) => {
    const { data, error } = await supabase.rpc('approve_feed_post', { p_post_id: postId, p_admin_id: user.id })
    if (error || !data?.success) { toast.error('Failed to approve post'); return }
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    toast.success('Post approved!')
  }

  const handleReject = async (postId) => {
    const { data, error } = await supabase.rpc('reject_feed_post', { p_post_id: postId, p_admin_id: user.id, p_notes: 'Does not meet community guidelines' })
    if (error || !data?.success) { toast.error('Failed to reject post'); return }
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    toast.success('Post rejected')
  }

  const tabs = TABS(pendingPosts.length)

  return (
    <div className="page-container min-h-dvh" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }} aria-label="Back to profile">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
        <button onClick={loadData} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }} aria-label="Refresh data">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 no-scrollbar" style={{ borderBottom: '1px solid var(--border)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.id ? 'var(--brand)' : 'var(--bg-elevated)',
              color:      activeTab === tab.id ? 'white' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="px-4 py-5 pb-24">

        {/* Dashboard */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard icon={Users}         label="Total users"       value={stats.total_users?.toLocaleString()}           sub={`+${stats.new_users_today} today`} />
                  <StatCard icon={Film}          label="Total generations" value={stats.total_generations?.toLocaleString()}      sub={`${stats.generations_today} today`}  color="#8b5cf6" />
                  <StatCard icon={TrendingUp}    label="Success rate"      value={`${stats.success_rate_today}%`}                sub="Today"                               color="#10b981" />
                  <StatCard icon={AlertTriangle} label="Failed today"      value={stats.failed_today}                            sub="Auto-refunded"                       color="#ef4444" />
                  <StatCard icon={DollarSign}    label="Revenue (NGN)"     value={`₦${stats.total_revenue_ngn?.toLocaleString()}`} sub={`₦${stats.revenue_today_ngn?.toLocaleString()} today`} color="#10b981" />
                  <StatCard icon={Clock}         label="Pending feed"      value={stats.pending_feed_posts}                      sub="Awaiting review"                     color="#eab308" />
                </div>
                <StatCard icon={Users} label="Active users today" value={stats.active_users_today} color="#06b6d4" />
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Failed to load stats.</p>
            )}
          </motion.div>
        )}

        {/* Prompts */}
        {activeTab === 'prompts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Edit template prompts. Changes apply instantly to all new generations.
            </p>
            {templates.map((template) => (
              <PromptEditor key={template.id} template={template} onSave={loadData} />
            ))}
          </motion.div>
        )}

        {/* Templates */}
        {activeTab === 'templates' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TemplateManager templates={templates} onRefresh={loadData} />
          </motion.div>
        )}

        {/* Staff */}
        {activeTab === 'staff' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StaffManager />
          </motion.div>
        )}

        {/* Feed Moderation */}
        {activeTab === 'feed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {pendingPosts.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">All caught up! No pending posts.</p>
              </div>
            ) : (
              pendingPosts.map((post) => (
                <FeedModerationItem key={post.id} post={post} onApprove={handleApprove} onReject={handleReject} />
              ))
            )}
          </motion.div>
        )}

        {/* Users */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="flex flex-col gap-2">
              {recentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm flex-shrink-0" style={{ background: 'var(--brand)', color: 'white' }}>
                    {u.username?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>@{u.username}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{u.total_generations} generations · ⚡{u.credits?.toFixed(1)} credits</p>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full capitalize" style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}>
                    {u.tier}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Settings */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ProviderSettings />
          </motion.div>
        )}

      </div>
    </div>
  )
}
