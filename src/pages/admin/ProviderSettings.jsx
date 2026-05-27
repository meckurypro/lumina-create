import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

const SETTING_KEYS = ['active_provider', 'model_kling', 'model_seedance', 'model_image']

export default function ProviderSettings() {
  const [settings, setSettings] = useState({})
  const [saving,   setSaving]   = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('app_settings').select('key, value').in('key', SETTING_KEYS)
      setSettings(Object.fromEntries((data || []).map((r) => [r.key, JSON.parse(r.value)])))
      setLoading(false)
    }
    load()
  }, [])

  const updateSetting = async (key, value) => {
    setSaving(true)
    const { error } = await supabase.from('app_settings').update({ value: JSON.stringify(value) }).eq('key', key)
    setSaving(false)
    if (error) { toast.error('Failed to update setting'); return }
    setSettings((prev) => ({ ...prev, [key]: value }))
    toast.success('Setting updated!')
  }

  if (loading) return <Skeleton className="h-64 w-full" />

  const ToggleGroup = ({ label, settingKey, options, description }) => (
    <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
      <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{label}</p>
      {description && <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>{description}</p>}
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => updateSetting(settingKey, opt.value)}
            disabled={saving}
            className="flex-1 py-3 rounded-xl text-sm font-bold transition-all"
            style={{
              background: settings[settingKey] === opt.value ? 'var(--brand)' : 'var(--bg-elevated)',
              color:      settings[settingKey] === opt.value ? 'white' : 'var(--text-muted)',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
        Changes apply instantly to all new generations. Failed generations automatically fall back to the other provider.
      </p>
      <ToggleGroup label="Active Provider" settingKey="active_provider" description="Primary AI provider for all generation requests." options={[{ value: 'fal', label: 'fal.ai' }, { value: 'wavespeed', label: 'WaveSpeed' }]} />
      <ToggleGroup label="Kling Model"     settingKey="model_kling"     options={[{ value: 'kling_2_5',     label: 'Kling 2.5'    }, { value: 'kling_3_0',    label: 'Kling 3.0'    }]} />
      <ToggleGroup label="Seedance Model"  settingKey="model_seedance"  options={[{ value: 'seedance_1_5',  label: 'Seedance 1.5' }, { value: 'seedance_2_0', label: 'Seedance 2.0' }]} />
      <ToggleGroup label="Image Model"     settingKey="model_image"     options={[{ value: 'imagen_3_fast', label: 'Imagen 3 Fast'}, { value: 'imagen_3',     label: 'Imagen 3'     }]} />
    </div>
  )
}
