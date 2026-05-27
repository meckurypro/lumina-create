import { useState, useEffect, useCallback } from 'react'
import { Lock, Unlock } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

export default function ModelsManager() {
  const [models,  setModels]  = useState([])
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(null)

  const loadModels = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('models')
      .select('*')
      .eq('type', 'image')
      .order('sort_order')
    setModels(data || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadModels() }, [loadModels])

  const handleToggleLock = async (model) => {
    setSaving(model.id)
    const { error } = await supabase
      .from('models')
      .update({ is_locked: !model.is_locked, updated_at: new Date().toISOString() })
      .eq('id', model.id)
    setSaving(null)
    if (error) { toast.error('Failed to update model'); return }
    toast.success(model.is_locked ? `${model.label} unlocked` : `${model.label} locked`)
    loadModels()
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const unlocked = models.filter((m) => !m.is_locked)
  const locked   = models.filter((m) =>  m.is_locked)

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Unlock models to make them available to users. Locked models appear in the dropdown as "Coming Soon."
      </p>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          Available to users ({unlocked.length})
        </p>
        <div className="flex flex-col gap-2">
          {unlocked.map((model) => (
            <div key={model.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{model.sublabel}</p>
              </div>
              <button
                onClick={() => handleToggleLock(model)}
                disabled={saving === model.id}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444' }}
              >
                <Lock size={11} />
                {saving === model.id ? '…' : 'Lock'}
              </button>
            </div>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
          Locked / Coming Soon ({locked.length})
        </p>
        <div className="flex flex-col gap-2">
          {locked.map((model) => (
            <div key={model.id} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', opacity: 0.7 }}>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{model.label}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{model.sublabel}</p>
              </div>
              <button
                onClick={() => handleToggleLock(model)}
                disabled={saving === model.id}
                className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl font-semibold"
                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981' }}
              >
                <Unlock size={11} />
                {saving === model.id ? '…' : 'Unlock'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
