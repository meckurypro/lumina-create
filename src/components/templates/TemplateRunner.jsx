import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { ImageUpload, MultiImageUpload } from '@/components/ui/ImageUpload'
import { Button } from '@/components/ui/Button'

export const TemplateRunner = ({ template, onBack }) => {
  const navigate = useNavigate()
  const [startFrame, setStartFrame] = useState(null)
  const [endFrame, setEndFrame] = useState(null)
  const [photos, setPhotos] = useState([])
  const isMemory = template?.slug === 'memory-lane'
  const canContinue = isMemory ? photos.length >= 3 : startFrame && endFrame
  return <div className="min-h-full" style={{ background: 'var(--bg)' }}><div className="sticky top-0 z-10 flex items-center gap-3 px-4 py-4" style={{ background: 'var(--bg)', borderBottom: '1px solid var(--border-color)' }}><button onClick={onBack} className="rounded-xl p-2" style={{ background: 'var(--bg-elevated)' }}><ArrowLeft size={18} /></button><div><h2 className="font-extrabold" style={{ fontFamily: 'Syne, sans-serif' }}>{template?.name || 'Template'}</h2><p className="text-xs" style={{ color: 'var(--text-muted)' }}>{template?.description}</p></div></div><div className="mx-auto max-w-2xl space-y-5 p-4 pb-28"><div className="rounded-3xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}><p className="whitespace-pre-line text-sm leading-6" style={{ color: 'var(--text-secondary)' }}>{template?.instructions}</p></div>{isMemory ? <MultiImageUpload values={photos} onChange={setPhotos} minImages={3} maxImages={20} /> : <div className="grid grid-cols-2 gap-3"><ImageUpload label="Start Frame" sublabel="Outgoing person" value={startFrame} onChange={setStartFrame} onRemove={() => setStartFrame(null)} /><ImageUpload label="End Frame" sublabel="Incoming person" value={endFrame} onChange={setEndFrame} onRemove={() => setEndFrame(null)} /></div>}<Button fullWidth disabled={!canContinue} icon={Sparkles} onClick={() => navigate('/generate', { state: { type: 'template', templateSlug: template.slug, templateName: template.name, prefillImages: isMemory ? photos : [startFrame, endFrame] } })}>Generate with template</Button></div></div>
}
