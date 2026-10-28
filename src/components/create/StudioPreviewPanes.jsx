// src/components/create/StudioPreviewPanes.jsx
// Desktop results panes for studios whose output lives outside `generations`.
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Music2, Clapperboard, AlertTriangle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'

const Frame = ({ title, children }) => (
  <section className="hidden lg:flex flex-1 min-w-0 flex-col p-6 gap-4 overflow-y-auto" style={{ background: 'var(--bg-secondary)' }} aria-label={title}>
    <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{title}</p>
    {children}
  </section>
)
const Empty = ({ icon: Icon, text }) => (
  <div className="flex-1 flex flex-col items-center justify-center text-center rounded-3xl px-8"
    style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
    <Icon size={34} strokeWidth={1.2} style={{ color: 'var(--text-muted)' }} className="mb-3" />
    <p className="text-sm font-semibold">{text}</p>
  </div>
)
const Chip = ({ active, failed, children }) => (
  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full capitalize"
    style={{ background: failed ? 'rgba(239,68,68,0.14)' : active ? 'var(--brand-light)' : 'color-mix(in srgb, var(--tool-motion) 16%, transparent)',
             color: failed ? '#ef4444' : active ? 'var(--brand)' : 'var(--tool-motion)' }}>{children}</span>
)

function usePoll(load, active) {
  useEffect(() => { load() }, [load])
  useEffect(() => {
    const t = setInterval(load, active ? 4000 : 20000)
    return () => clearInterval(t)
  }, [load, active])
}

// ── DAW AI ────────────────────────────────────────────────────────────────
export function DawPreviewPane() {
  const { user } = useAuth(); const navigate = useNavigate()
  const [gens, setGens] = useState([]); const [vars, setVars] = useState({})
  const load = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('daw_generations')
      .select('id,status,prompt,mode,variation_count,error_message,created_at')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(6)
    setGens(data || [])
    const ids = (data || []).map((g) => g.id)
    if (!ids.length) return
    const { data: v } = await supabase.from('daw_generation_variations')
      .select('id,daw_generation_id,variation_index,output_url,duration_seconds,status')
      .in('daw_generation_id', ids).order('variation_index')
    const by = {}; (v || []).forEach((r) => { (by[r.daw_generation_id] ||= []).push(r) })
    setVars(by)
  }, [user?.id])
  const active = gens.some((g) => !['completed', 'failed'].includes(g.status))
  usePoll(load, active)

  return (
    <Frame title="Your tracks">
      {!gens.length ? <Empty icon={Music2} text="Your songs will appear here" /> : gens.map((g) => (
        <article key={g.id} className="rounded-2xl p-4 flex flex-col gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-bold truncate">{g.prompt || 'Untitled track'}</p>
            <Chip active={!['completed', 'failed'].includes(g.status)} failed={g.status === 'failed'}>{g.status}</Chip>
          </div>
          {g.status === 'failed' && <p className="text-xs flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}><AlertTriangle size={13} />{g.error_message || 'Generation failed'}</p>}
          {(vars[g.id] || []).map((v) => v.output_url ? (
            <div key={v.id} className="flex items-center gap-3">
              <span className="text-xs font-semibold w-6" style={{ color: 'var(--text-muted)' }}>V{(v.variation_index ?? 0) + 1}</span>
              <audio src={v.output_url} controls preload="none" className="flex-1 h-9" />
            </div>
          ) : null)}
          <button onClick={() => navigate(`/daw/result/${g.id}`)} className="text-xs font-bold self-start" style={{ color: 'var(--brand)' }}>Open · master & stems →</button>
        </article>
      ))}
    </Frame>
  )
}

// ── IQ Ads ────────────────────────────────────────────────────────────────
export function IqAdsPreviewPane() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const load = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase.from('iqads_orders')
      .select('id,status,flyer_url,output_url,error_message,created_at,duration,aspect_ratio')
      .eq('user_id', user.id).order('created_at', { ascending: false }).limit(6)
    setOrders(data || [])
  }, [user?.id])
  const active = orders.some((o) => !o.output_url && !o.error_message)
  usePoll(load, active)

  return (
    <Frame title="Your ads">
      {!orders.length ? <Empty icon={Clapperboard} text="Your cinematic ads will appear here" /> : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {orders.map((o) => (
            <article key={o.id} className="rounded-2xl overflow-hidden" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <div className="relative flex items-center justify-center" style={{ aspectRatio: '16 / 10', background: 'var(--bg-primary)' }}>
                {o.output_url
                  ? <video src={o.output_url} controls playsInline className="w-full h-full object-contain" />
                  : o.flyer_url
                    ? <img src={o.flyer_url} alt="Flyer" className="w-full h-full object-contain" style={{ opacity: o.error_message ? 0.4 : 0.75 }} />
                    : <Clapperboard size={28} style={{ color: 'var(--text-muted)' }} />}
              </div>
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{o.duration ? `${o.duration}s` : ''} {o.aspect_ratio || ''}</span>
                <Chip active={!o.output_url && !o.error_message} failed={!!o.error_message}>
                  {o.output_url ? 'ready' : o.error_message ? 'failed' : (o.status || 'in progress')}
                </Chip>
              </div>
            </article>
          ))}
        </div>
      )}
    </Frame>
  )
}
