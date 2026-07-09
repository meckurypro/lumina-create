// src/components/renderWindow/ActiveModelsTab.jsx
import { useState, useEffect } from 'react'
import { useAuth } from '@/context/AuthContext'
import { getActiveModelsIfEligible } from '@/lib/activeModels'

export function ActiveModelsTab() {
  const { user } = useAuth()
  const [models,  setModels]  = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    getActiveModelsIfEligible(user.id).then(({ data }) => {
      setModels(data)
      setLoading(false)
    })
  }, [user?.id])

  if (loading) {
    return (
      <div className="flex flex-col gap-2">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-12 rounded-2xl animate-pulse" style={{ background: 'var(--bg-card)', opacity: 0.5 - i * 0.1 }} />
        ))}
      </div>
    )
  }

  if (models.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          Nothing active right now
        </p>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
          Check back when a render window opens.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {models.map((m) => (
        <div
          key={m.model_id}
          className="rounded-2xl px-4 py-3.5 flex items-center gap-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{ background: '#10b981', boxShadow: '0 0 6px #10b981' }}
          />
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
            {m.label}
          </p>
        </div>
      ))}
    </div>
  )
}
