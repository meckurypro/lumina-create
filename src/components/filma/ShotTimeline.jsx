// src/components/filma/ShotTimeline.jsx
// Storyboard film-strip + proportional runtime timeline for a scene's shots.
import { Film } from 'lucide-react'

const STATUS = {
  completed:  'var(--tool-motion)',
  generating: 'var(--gold)',
  processing: 'var(--gold)',
  failed:     'var(--destructive, #ef4444)',
}
const label = (t = '') => t.split('_').join(' ')
const dur = (s) => Number(s.duration_seconds) || 4

export function ShotTimeline({ shots, onOpen }) {
  if (!shots?.length) return null
  const total = shots.reduce((n, s) => n + dur(s), 0)
  const done  = shots.filter((s) => s.status === 'completed').length

  return (
    <section aria-label="Storyboard" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>Storyboard</p>
        <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
          {done}/{shots.length} shots · {total}s runtime
        </p>
      </div>

      {/* Film strip */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar py-2 px-2 rounded-2xl" style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
        {shots.map((shot) => {
          const c = STATUS[shot.status] || 'var(--border-color)'
          const live = shot.status === 'generating' || shot.status === 'processing'
          return (
            <button key={shot.id} onClick={() => onOpen(shot)} className="relative flex-shrink-0 rounded-lg overflow-hidden text-left"
              style={{ width: 168, aspectRatio: '16 / 9', background: 'var(--bg-elevated)', border: `1px solid ${c}` }}
              aria-label={`Shot ${shot.shot_number}, ${label(shot.shot_type)}`}>
              {shot.output_url
                ? <video src={shot.output_url} muted playsInline preload="metadata" className="absolute inset-0 w-full h-full object-cover" />
                : <span className="absolute inset-0 flex items-center justify-center"><Film size={20} style={{ color: 'var(--text-muted)' }} strokeWidth={1.3} /></span>}
              <span className="absolute inset-x-0 bottom-0 h-1/2 pointer-events-none" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)' }} />
              <span className="absolute left-2 top-2 text-[10px] font-black px-1.5 py-0.5 rounded" style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>{shot.shot_number}</span>
              {live && <span className="absolute right-2 top-2 w-2 h-2 rounded-full animate-pulse" style={{ background: c }} />}
              <span className="absolute left-2 bottom-1.5 text-[10px] font-bold capitalize" style={{ color: '#fff' }}>{label(shot.shot_type)} · {dur(shot)}s</span>
            </button>
          )
        })}
      </div>

      {/* Runtime timeline: width = duration */}
      <div className="flex gap-[3px] h-7 rounded-lg overflow-hidden" role="list" aria-label="Runtime timeline">
        {shots.map((shot) => (
          <button key={shot.id} role="listitem" onClick={() => onOpen(shot)} title={`Shot ${shot.shot_number} · ${dur(shot)}s`}
            className="h-full flex items-center justify-center text-[10px] font-bold min-w-[14px]"
            style={{
              flex: dur(shot),
              background: shot.status === 'completed' ? 'color-mix(in srgb, var(--tool-motion) 30%, var(--bg-elevated))' : 'var(--bg-elevated)',
              color: 'var(--text-secondary)',
              borderBottom: `2px solid ${STATUS[shot.status] || 'transparent'}`,
            }}>
            {shot.shot_number}
          </button>
        ))}
      </div>
    </section>
  )
}
