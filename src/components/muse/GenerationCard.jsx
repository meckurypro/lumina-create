// src/components/muse/GenerationCard.jsx
import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2, XCircle, Download } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const POLL_MS = 4_000

export default function GenerationCard({ generationId }) {
  const navigate = useNavigate()
  const [gen, setGen]   = useState(null)
  const [loading, setLoading] = useState(true)
  const pollRef = useRef(null)

  useEffect(() => {
    let cancelled = false

    const fetchOnce = async () => {
      const { data } = await supabase
        .from('generations')
        .select('id, status, output_url, output_thumbnail_url, output_type, error_message, credits_charged')
        .eq('id', generationId)
        .single()
      if (!cancelled && data) setGen(data)
      setLoading(false)
      return data
    }

    fetchOnce().then((data) => {
      if (data && (data.status === 'pending' || data.status === 'processing')) {
        pollRef.current = setInterval(async () => {
          const fresh = await fetchOnce()
          if (fresh && fresh.status !== 'pending' && fresh.status !== 'processing') {
            clearInterval(pollRef.current)
          }
        }, POLL_MS)
      }
    })

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [generationId])

  if (loading || !gen) {
    return (
      <div
        className="w-48 h-48 rounded-2xl flex items-center justify-center"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <SpinnerDot />
      </div>
    )
  }

  const isPending = gen.status === 'pending' || gen.status === 'processing'
  const isFailed  = gen.status === 'failed'
  const isDone    = gen.status === 'completed'

  return (
    <div
      className="w-48 rounded-2xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div
        className="w-full relative flex items-center justify-center"
        style={{ aspectRatio: '1 / 1', background: 'var(--bg-elevated)' }}
      >
        {isPending && <SpinnerDot />}

        {isFailed && (
          <div className="flex flex-col items-center gap-2 px-3 text-center">
            <XCircle size={22} style={{ color: '#ef4444' }} />
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {gen.error_message || 'Generation failed'}
            </p>
          </div>
        )}

        {isDone && gen.output_type === 'video' ? (
          <video
            src={gen.output_url}
            poster={gen.output_thumbnail_url || undefined}
            controls
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : isDone ? (
          <img
            src={gen.output_url}
            alt="Generated result"
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : null}
      </div>

      <div className="px-3 py-2 flex items-center justify-between">
        <span className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
          {isPending ? 'Creating…' : isFailed ? 'Failed' : 'Ready'}
        </span>
        {isDone && (
          <button
            onClick={() => navigate(`/result/${gen.id}`)}
            className="flex items-center gap-1 text-xs font-semibold"
            style={{ color: 'var(--brand)' }}
          >
            <Download size={12} />
            View
          </button>
        )}
      </div>
    </div>
  )
}

function SpinnerDot() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.9, ease: 'linear' }}
      className="w-6 h-6 rounded-full border-2"
      style={{ borderColor: 'var(--border-color)', borderTopColor: 'var(--brand)' }}
    />
  )
}
