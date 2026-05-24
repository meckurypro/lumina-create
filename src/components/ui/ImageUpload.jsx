import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, Plus } from 'lucide-react'

export const ImageUpload = ({ label, sublabel, value, onChange, onRemove, accept = 'image/*', maxSizeMb = 10, className = '' }) => {
  const inputRef = useRef(null)
  const [dragOver, setDragOver] = useState(false)
  const [error, setError] = useState(null)
  const preview = value ? (typeof value === 'string' ? value : URL.createObjectURL(value)) : null
  const handleFile = (file) => {
    setError(null)
    if (!file) return
    if (!file.type.startsWith('image/')) return setError('Please upload an image file')
    if (file.size > maxSizeMb * 1024 * 1024) return setError(`Image must be under ${maxSizeMb}MB`)
    onChange(file)
  }
  return <div className={`w-full ${className}`}>{label && <p className="mb-2 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</p>}<AnimatePresence mode="wait">{preview ? <motion.div key="preview" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative aspect-[9/16] max-h-64 w-full overflow-hidden rounded-2xl"><img src={preview} alt="Upload preview" className="h-full w-full object-cover" /><div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" /><button onClick={onRemove} className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white" aria-label="Remove image"><X size={14} /></button>{sublabel && <div className="absolute bottom-2 left-3 right-3"><p className="text-xs font-medium text-white">{sublabel}</p></div>}</motion.div> : <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => inputRef.current?.click()} onDragOver={(e) => { e.preventDefault(); setDragOver(true) }} onDragLeave={() => setDragOver(false)} onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]) }} className="relative flex aspect-[9/16] max-h-64 cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed transition-all" style={{ borderColor: dragOver ? 'var(--brand)' : 'var(--border-color)', background: dragOver ? 'rgba(249,115,22,0.05)' : 'var(--bg-input)' }}><div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: 'var(--bg-elevated)' }}><Upload size={20} style={{ color: 'var(--text-muted)' }} /></div><div className="px-4 text-center"><p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{sublabel || 'Upload image'}</p><p className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>Tap to browse · Max {maxSizeMb}MB</p></div></motion.div>}</AnimatePresence>{error && <p className="mt-2 text-xs" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}<input ref={inputRef} type="file" accept={accept} className="hidden" onChange={(e) => handleFile(e.target.files[0])} /></div>
}

export const MultiImageUpload = ({ values = [], onChange, maxImages = 20, minImages = 3, className = '' }) => {
  const inputRef = useRef(null)
  const [error, setError] = useState(null)
  const handleFiles = (files) => {
    setError(null)
    const newFiles = Array.from(files).filter((f) => f.type.startsWith('image/'))
    if (values.length + newFiles.length > maxImages) return setError(`Maximum ${maxImages} images allowed`)
    onChange([...values, ...newFiles])
  }
  return <div className={`w-full ${className}`}><div className="mb-3 flex items-center justify-between"><p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Photos ({values.length}/{maxImages})</p>{values.length < minImages && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Minimum {minImages} photos</p>}</div><div className="grid grid-cols-3 gap-2">{values.map((file, index) => <motion.div key={`${file.name}-${index}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="relative aspect-square overflow-hidden rounded-xl"><img src={URL.createObjectURL(file)} alt={`Photo ${index + 1}`} className="h-full w-full object-cover" /><button onClick={() => onChange(values.filter((_, i) => i !== index))} className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/70 text-white" aria-label="Remove photo"><X size={10} /></button><div className="absolute bottom-1 left-1 rounded bg-black/50 px-1"><span className="text-xs text-white">{index + 1}</span></div></motion.div>)}{values.length < maxImages && <motion.button whileTap={{ scale: 0.97 }} onClick={() => inputRef.current?.click()} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed" style={{ borderColor: 'var(--border-color)', background: 'var(--bg-input)' }}><Plus size={20} style={{ color: 'var(--text-muted)' }} /><span className="text-xs" style={{ color: 'var(--text-muted)' }}>Add</span></motion.button>}</div>{error && <p className="mt-2 text-xs" style={{ color: 'hsl(var(--destructive))' }}>{error}</p>}<input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFiles(e.target.files)} /></div>
}
