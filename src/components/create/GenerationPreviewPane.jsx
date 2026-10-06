// src/components/create/GenerationPreviewPane.jsx
// Desktop-only preview canvas: latest result large, recent results as a film strip.
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Film, Image as ImageIcon, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const ACTIVE = ['pending', 'processing']

const Media = ({ gen, className = '', controls = false }) =>
  gen.output_type === 'video'
    ? <video src={gen.output_url} className={className} muted={!controls} controls={controls} loop playsInline autoPlay={!controls} />
    : <img src={gen.output_url} alt={gen.prompt || 'Generated'} className={className} />

export function GenerationPreviewPane({ outputType = 'image' }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [items, setItems] = useState([])
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('generations')
      .select('id,status,output_url,output_type,prompt,aspect_ratio,created_at')
      .eq('user_id', user.id).eq('output_type', outputType)
      .order('created_at', { ascending: false }).limit(12)
    setItems(data || [])
  }, [user?.id, outputType])

  useEffect(() => { load() }, [load])
  const anyActive = items.some((g) => ACTIVE.includes(g.status))
  useEffect(() => {
    const t = setInterval(load, anyActive ? 4000 : 20000)
    return () => clearInterval(t)
  }, [load, anyActive])

  const latest = items[0]
  const current = items.find((g) => g.id === selected) || latest
  const Icon = outputType === 'video' ? Film : ImageIcon

  return (
    <section className="hidden lg:flex flex-1 min-w-0 flex-col p-6 gap-4" style={{ background: 'var(--bg-secondary)' }} aria-label="Preview">
      <div className="flex-1 min-h-0 flex items-center justify-center rounded-3xl overflow-hidden relative"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
        {!current ? (
          <div className="text-center px-8">
            <Icon size={34} strokeWidth={1.2} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-3" />
            <p className="text-sm font-semibold">Your {outputType} will appear here</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Describe a scene, pick a model and hit Generate.</p>
          </div>
        ) : ACTIVE.includes(current.status) ? (
          <div className="text-center">
            <div className="w-10 h-10 rounded-full border-2 animate-spin mx-auto mb-3"
              style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand)' }} />
            <p className="text-sm font-semibold">Developing your {outputType}…</p>
            <p className="text-xs mt-1 max-w-xs mx-auto truncate" style={{ color: 'var(--text-muted)' }}>{current.prompt}</p>
          </div>
        ) : current.status === 'failed' || !current.output_url ? (
          <div className="text-center px-8">
            <AlertTriangle size={28} style={{ color: 'var(--text-muted)' }} className="mx-auto mb-2" />
            <p className="text-sm font-semibold">This one didn't make it</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Credits for failed generations are refunded automatically.</p>
          </div>
        ) : (
          <button onClick={() => navigate(`/result/${current.id}`)} className="w-full h-full flex items-center justify-center" aria-label="Open result">
            <Media gen={current} className="max-w-full max-h-full object-contain" />
          </button>
        )}
      </div>

      {items.length > 1 && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar flex-shrink-0" role="list">
          {items.map((g) => (
            <button key={g.id} role="listitem" onClick={() => setSelected(g.id)}
              className="relative flex-shrink-0 rounded-xl overflow-hidden"
              style={{ width: 84, height: 84, background: 'var(--bg-elevated)',
                border: `2px solid ${current?.id === g.id ? 'var(--brand)' : 'var(--border-color)'}` }}>
              {g.output_url && g.status === 'completed'
                ? <Media gen={g} className="w-full h-full object-cover" />
                : <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ color: 'var(--text-muted)' }}>
                    {g.status === 'failed' ? '×' : '…'}
                  </span>}
            </button>
          ))}
        </div>
      )}
    </section>
  )
}
