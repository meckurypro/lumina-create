// src/pages/CreatePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ImageIcon, VideoIcon, Sparkles, ArrowRight } from 'lucide-react'
import { templates as templatesDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Modal'
import { SmartPromptInput } from '@/components/ui/SmartPromptInput'

const TYPE_LABELS = {
  text_to_image:   'Text to Image',
  image_to_image:  'Image to Image',
  text_to_video:   'Text to Video',
  image_to_video:  'Image to Video',
  start_end_frame: 'Start + End Frame',
  end_frame_text:  'End Frame + Text',
}

const TOOLS = [
  {
    id:       'create_image',
    label:    'Create Image',
    subtitle: 'From text or reference photo',
    icon:     ImageIcon,
    route:    '/create/image',
  },
  {
    id:       'create_video',
    label:    'Create Video',
    subtitle: 'Animate, generate or transform frames',
    icon:     VideoIcon,
    route:    '/create/video',
  },
]

export default function CreatePage() {
  const navigate                  = useNavigate()
  const { isStaff, isAdmin }      = useAuth()
  const [activeTab, setActiveTab] = useState('tools')
  const [templates, setTemplates] = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)

      // Staff and admin see promptiq-visibility templates too
      const { data } = (isStaff || isAdmin)
        ? await templatesDb.getAll()
        : await templatesDb.getPublic()

      setTemplates(data || [])
      setLoading(false)
    }

    fetchTemplates()
  }, [isStaff, isAdmin])

  // ── Navigate to TemplateRunnerPage, not GeneratePage ──
  const handleTemplateSelect = (template) => {
    navigate(`/create/${template.slug}`)
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="pt-2 pb-6 flex-shrink-0">
            <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Create</h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>What are we making today?</p>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl mb-6 flex-shrink-0" style={{ background: 'var(--bg-elevated)' }}>
            {['tools', 'templates', 'canvas'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold capitalize transition-all duration-200"
                style={{
                  background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                  color:      activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  activeTab === tab ? 'var(--shadow)' : 'none',
                }}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex flex-col flex-1 min-h-0">

            {/* Tools Tab */}
            {activeTab === 'tools' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 items-center justify-center"
              >
                <div className="grid grid-cols-2 w-full" style={{ gap: '16px', maxWidth: '520px' }}>
                  {TOOLS.map(({ id, label, subtitle, icon: Icon, route }, i) => (
                    <motion.button
                      key={id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.08 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => navigate(route)}
                      className="flex flex-col items-center justify-between rounded-2xl overflow-hidden transition-all"
                      style={{
                        background:  'var(--bg-card)',
                        border:      '1px solid var(--border-color)',
                        aspectRatio: '1 / 1',
                        width:       '100%',
                        padding:     '20px',
                      }}
                    >
                      <div className="flex flex-1 items-center justify-center w-full">
                        <div
                          className="rounded-2xl flex items-center justify-center"
                          style={{
                            width:       '65%',
                            aspectRatio: '1 / 1',
                            background:  'var(--bg-elevated)',
                            border:      '1px solid var(--border-color)',
                          }}
                        >
                          <Icon
                            style={{ width: '42%', height: '42%', color: 'var(--text-primary)' }}
                            strokeWidth={1.4}
                          />
                        </div>
                      </div>
                      <div className="w-full flex flex-col gap-0.5 items-center text-center flex-shrink-0">
                        <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{label}</span>
                        <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>{subtitle}</span>
                      </div>
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col gap-3 overflow-y-auto"
              >
                {loading ? (
                  <>
                    <Skeleton className="h-36 w-full rounded-2xl" />
                    <Skeleton className="h-36 w-full rounded-2xl" />
                  </>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    No templates yet
                  </p>
                ) : (
                  templates.map((template, i) => (
                    <motion.button
                      key={template.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleTemplateSelect(template)}
                      className="w-full rounded-2xl overflow-hidden text-left flex-shrink-0"
                      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                    >
                      <div
                        className="h-32 w-full relative flex items-center justify-center"
                        style={{
                          background: template.thumbnail_url
                            ? undefined
                            : 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,88,12,0.06))',
                        }}
                      >
                        {template.thumbnail_url
                          ? <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
                          : <Sparkles size={32} style={{ color: 'var(--brand)', opacity: 0.35 }} />
                        }
                        

                        {/* Staff-only badge */}
                        {template.visibility === 'promptiq' && (
                          <div
                            className="absolute top-3 left-3 px-2 py-1 rounded-full text-xs font-semibold"
                            style={{ background: 'rgba(249,115,22,0.85)', color: 'white', backdropFilter: 'blur(8px)' }}
                          >
                            Staff
                          </div>
                        )}
                      </div>
                      <div className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                            {template.name}
                          </h3>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                            {template.description}
                          </p>
                        </div>
                        <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0, marginLeft: 12 }} />
                      </div>
                    </motion.button>
                  ))
                )}
              </motion.div>
            )}

            {/* Canvas Tab */}
            {activeTab === 'canvas' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <SmartPromptInput
                  onConfirm={(data) => {
                    navigate('/generate', {
                      state: {
                        type:           data.templateSlug ? 'template' : data.type,
                        templateSlug:   data.templateSlug || null,
                        templateName:   data.templateSlug
                          ? data.templateSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                          : null,
                        toolLabel:      TYPE_LABELS[data.type] || 'AI Creation',
                        prompt:         data.enhanced_prompt,
                        aspectRatio:    data.aspect_ratio,
                        duration:       data.duration,
                        model:          data.model,
                        prefillImages:  data.uploadedImages || [],
                        smartGenerated: true,
                      },
                    })
                  }}
                />
              </motion.div>
            )}

          </div>
        </div>
      </PageWrapper>
    </>
  )
}
