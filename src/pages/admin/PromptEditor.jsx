import { useState, useEffect, useCallback } from 'react'
import { Edit3, Save, X, RotateCcw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function PromptEditor({ template, onSave }) {
  const { user }                          = useAuth()
  const [prompts,       setPrompts]       = useState([])
  const [editingPrompt, setEditingPrompt] = useState('')
  const [editingNotes,  setEditingNotes]  = useState('')
  const [isEditing,     setIsEditing]     = useState(false)
  const [saving,        setSaving]        = useState(false)
  const [loading,       setLoading]       = useState(true)

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
    <div className="rounded-2xl overflow-hidden mb-4" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between p-4" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
        <div>
          <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{template.name}</h3>
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
        <div style={{ borderTop: '1px solid var(--border-color)' }}>
          <p className="px-4 py-2 text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
            Version history
          </p>
          {prompts.map((p) => (
            <div key={p.id} className="flex items-start gap-3 px-4 py-3" style={{ borderTop: '1px solid var(--border-color)' }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>v{p.version_number}</span>
                  {p.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(249,115,22,0.15)', color: 'var(--brand)' }}>Active</span>
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
