import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { templates as templatesDb } from '@/lib/supabase'
import { TemplateRunner } from '@/components/templates/TemplateRunner'

export default function TemplateRunnerPage() {
  const { templateSlug } = useParams()
  const navigate = useNavigate()
  const [template, setTemplate] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

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

  if (loading) return <div style={{ padding: 24 }}>Loading template…</div>
  if (error || !template) {
    return (
      <div style={{ padding: 24 }}>
        <h1>Template not available</h1>
        <p style={{ color: 'var(--text-muted)' }}>{error}</p>
        <button onClick={() => navigate('/create')} style={{ marginTop: 12 }}>Back to Create</button>
      </div>
    )
  }
  return <TemplateRunner template={template} onBack={() => navigate('/create')} />
}
