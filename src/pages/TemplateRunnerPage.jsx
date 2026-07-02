// src/pages/TemplateRunnerPage.jsx
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { templates as templatesDb } from '@/lib/supabase'
import { TemplateRunner } from '@/components/templates/TemplateRunner'

export default function TemplateRunnerPage() {
  const { templateSlug } = useParams()
  const navigate         = useNavigate()
  const [template,       setTemplate] = useState(null)
  const [loading,        setLoading]  = useState(true)
  const [error,          setError]    = useState(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      setLoading(true)
      const { data, error } = await templatesDb.getBySlug(templateSlug)
      if (!alive) return
      if (error || !data) setError(error?.message || 'Template not found')
      else setTemplate(data)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [templateSlug])

  if (loading) return (
    <div
      className="h-full flex items-center justify-center"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-muted)', fontSize: 14 }}
    >
      Loading template…
    </div>
  )

  if (error || !template) return (
    <div
     className="h-full flex flex-col items-center justify-center gap-3 px-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Template not available</p>
      <p className="text-sm text-center" style={{ color: 'var(--text-muted)' }}>{error}</p>
      <button
        onClick={() => navigate('/create')}
        className="mt-2 px-5 py-2.5 rounded-xl text-sm font-semibold"
        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
      >
        Back to Create
      </button>
    </div>
  )

  return <TemplateRunner template={template} onBack={() => navigate('/create')} />
}
