import { useState, useEffect, useCallback } from 'react'
import { Lock, Unlock, Upload, Trash2, Image, Film, Zap, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import toast from 'react-hot-toast'

export default function TemplateManager({ templates, onRefresh }) {
  const [uploading, setUploading] = useState({})
  const [assets,    setAssets]    = useState({})

  const loadAssets = useCallback(async (templateId) => {
    const { data } = await supabase
      .from('template_assets')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at', { ascending: false })
    setAssets((prev) => ({ ...prev, [templateId]: data || [] }))
  }, [])

  useEffect(() => {
    templates.forEach((t) => loadAssets(t.id))
  }, [templates, loadAssets])

  const handleToggleVisibility = async (template) => {
    const next = template.visibility === 'promptiq' ? 'public' : 'promptiq'
    const { error } = await supabase
      .from('templates')
      .update({ visibility: next, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    if (error) { toast.error('Failed to update visibility'); return }
    toast.success(`Moved to ${next === 'promptiq' ? 'PromptIQ' : 'Public'}`)
    onRefresh()
  }

  const handleToggleActive = async (template) => {
    const { error } = await supabase
      .from('templates')
      .update({ is_active: !template.is_active, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    if (error) { toast.error('Failed to update'); return }
    toast.success(template.is_active ? 'Template hidden' : 'Template activated')
    onRefresh()
  }

  const handleMediaUpload = async (template, field, file) => {
    const key = `${template.id}_${field}`
    setUploading((prev) => ({ ...prev, [key]: true }))
    const isVideo = file.type.startsWith('video/')
    const ext     = file.name.split('.').pop()
    const path    = `${template.id}/${field}.${ext}`
    const { error: storageErr } = await supabase.storage
      .from('template-assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    if (storageErr) {
      toast.error(`Upload failed: ${storageErr.message}`)
      setUploading((prev) => ({ ...prev, [key]: false }))
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('template-assets').getPublicUrl(path)
    const { error: dbErr } = await supabase
      .from('templates')
      .update({ [field]: publicUrl, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    setUploading((prev) => ({ ...prev, [key]: false }))
    if (dbErr) { toast.error('Saved to storage but failed to update template'); return }
    toast.success(`${isVideo ? 'Demo video' : 'Thumbnail'} updated!`)
    onRefresh()
  }

  const handleMediaClear = async (template, field) => {
    const { error } = await supabase
      .from('templates')
      .update({ [field]: null, updated_at: new Date().toISOString() })
      .eq('id', template.id)
    if (error) { toast.error('Failed to clear'); return }
    toast.success(`${field === 'demo_video_url' ? 'Demo video' : 'Thumbnail'} removed`)
    onRefresh()
  }

  const handleAssetUpload = async (template, assetKey, file) => {
    const key  = `${template.id}_${assetKey}`
    setUploading((prev) => ({ ...prev, [key]: true }))
    const ext  = file.name.split('.').pop()
    const path = `${template.id}/${assetKey}.${ext}`
    const { error: storageErr } = await supabase.storage
      .from('template-assets')
      .upload(path, file, { upsert: true, cacheControl: '3600' })
    if (storageErr) { toast.error('Upload failed'); setUploading((prev) => ({ ...prev, [key]: false })); return }
    const { data: { publicUrl } } = supabase.storage.from('template-assets').getPublicUrl(path)
    await supabase.from('template_assets').upsert(
      { template_id: template.id, asset_key: assetKey, file_name: file.name, file_type: file.type, storage_path: path, public_url: publicUrl, updated_at: new Date().toISOString() },
      { onConflict: 'template_id,asset_key' }
    )
    toast.success('Asset uploaded!')
    setUploading((prev) => ({ ...prev, [key]: false }))
    loadAssets(template.id)
  }

  const handleDeleteAsset = async (templateId, assetKey, storagePath) => {
    await supabase.storage.from('template-assets').remove([storagePath])
    await supabase.from('template_assets').delete().eq('template_id', templateId).eq('asset_key', assetKey)
    toast.success('Asset deleted')
    loadAssets(templateId)
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Toggle visibility, upload thumbnail and demo video, manage assets per template.
      </p>

      {templates.map((template) => {
        const isPromptIQ     = template.visibility === 'promptiq'
        const templateAssets = assets[template.id] || []

        return (
          <div key={template.id} className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>

            {/* Header */}
            <div className="flex items-center gap-3 p-4" style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-elevated)' }}>
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center relative" style={{ background: 'rgba(249,115,22,0.1)' }}>
                {template.demo_video_url ? (
                  <video src={template.demo_video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                ) : template.thumbnail_url ? (
                  <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
                ) : (
                  <Zap size={20} style={{ color: 'var(--brand)' }} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>{template.name}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{template.usage_count ?? 0} uses · ⚡ {template.credit_cost} cr</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleToggleActive(template)}
                  className="text-xs px-2 py-1 rounded-lg font-semibold"
                  style={{ background: template.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: template.is_active ? '#10b981' : '#ef4444' }}
                >
                  {template.is_active ? 'Live' : 'Hidden'}
                </button>
                <button
                  onClick={() => handleToggleVisibility(template)}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-xl font-bold transition-all"
                  style={{ background: isPromptIQ ? 'rgba(249,115,22,0.12)' : 'rgba(16,185,129,0.12)', color: isPromptIQ ? 'var(--brand)' : '#10b981' }}
                >
                  {isPromptIQ ? <Lock size={11} /> : <Unlock size={11} />}
                  {isPromptIQ ? 'PromptIQ' : 'Public'}
                </button>
              </div>
            </div>

            <div className="p-4 flex flex-col gap-4">

              {/* Thumbnail */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Thumbnail</p>
                <div className="flex items-center gap-3">
                  {template.thumbnail_url && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0">
                      <img src={template.thumbnail_url} alt="thumbnail" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleMediaClear(template, 'thumbnail_url')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <label
                    className="flex items-center gap-2 flex-1 py-2.5 px-3 rounded-xl cursor-pointer"
                    style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)' }}
                  >
                    <Image size={14} style={{ color: 'var(--brand)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {uploading[`${template.id}_thumbnail_url`] ? 'Uploading…' : template.thumbnail_url ? 'Replace thumbnail' : 'Upload thumbnail'}
                    </span>
                    <input
                      type="file" accept="image/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaUpload(template, 'thumbnail_url', f); e.target.value = '' }}
                    />
                  </label>
                </div>
              </div>

              {/* Demo Video */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Demo Video <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0, opacity: 0.6 }}>— shown on template cards</span>
                </p>
                <div className="flex items-center gap-3">
                  {template.demo_video_url && (
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0" style={{ background: '#000' }}>
                      <video src={template.demo_video_url} autoPlay muted loop playsInline className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleMediaClear(template, 'demo_video_url')}
                        className="absolute top-1 right-1 w-5 h-5 rounded-full flex items-center justify-center"
                        style={{ background: 'rgba(0,0,0,0.6)', color: 'white' }}
                      >
                        <X size={10} />
                      </button>
                    </div>
                  )}
                  <label
                    className="flex items-center gap-2 flex-1 py-2.5 px-3 rounded-xl cursor-pointer"
                    style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)' }}
                  >
                    <Film size={14} style={{ color: 'var(--brand)' }} />
                    <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>
                      {uploading[`${template.id}_demo_video_url`] ? 'Uploading…' : template.demo_video_url ? 'Replace demo video' : 'Upload demo video'}
                    </span>
                    <input
                      type="file" accept="video/*" className="hidden"
                      onChange={(e) => { const f = e.target.files?.[0]; if (f) handleMediaUpload(template, 'demo_video_url', f); e.target.value = '' }}
                    />
                  </label>
                </div>
              </div>

              {/* Other Assets */}
              <div>
                <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Other Assets</p>
                {templateAssets.length > 0 && (
                  <div className="flex flex-col gap-2 mb-3">
                    {templateAssets.map((asset) => (
                      <div key={asset.id} className="flex items-center gap-3 p-2 rounded-xl" style={{ background: 'var(--bg-elevated)' }}>
                        {asset.file_type?.startsWith('image/') ? (
                          <img src={asset.public_url} alt={asset.asset_key} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(249,115,22,0.1)' }}>
                            <Image size={16} style={{ color: 'var(--brand)' }} />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{asset.asset_key}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{asset.file_name}</p>
                        </div>
                        <button
                          onClick={() => handleDeleteAsset(template.id, asset.asset_key, asset.storage_path)}
                          className="p-1.5 rounded-lg"
                          style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)' }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <label
                  className="flex items-center gap-2 w-full py-2.5 px-3 rounded-xl cursor-pointer"
                  style={{ background: 'var(--bg-elevated)', border: '1px dashed var(--border-color)' }}
                >
                  <Upload size={14} style={{ color: 'var(--brand)' }} />
                  <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Upload asset (audio, overlay…)</span>
                  <input
                    type="file" accept="image/*,video/*,audio/*" className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (!file) return
                      const assetKey = file.name.split('.')[0].toLowerCase().replace(/\s+/g, '-')
                      handleAssetUpload(template, assetKey, file)
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>

            </div>
          </div>
        )
      })}
    </div>
  )
}
