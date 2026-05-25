// src/pages/CreatePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Film, Image, Layers, Wand2, Sparkles, ArrowRight } from 'lucide-react'
import { templates as templatesDb } from '@/lib/supabase'
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
  { id: 'text_to_image',   label: 'Text to Image',      icon: Image    },
  { id: 'image_to_image',  label: 'Image to Image',     icon: Wand2    },
  { id: 'text_to_video',   label: 'Text to Video',      icon: Film     },
  { id: 'image_to_video',  label: 'Image to Video',     icon: Sparkles },
  { id: 'start_end_frame', label: 'Start + End Frame',  icon: Layers   },
  { id: 'end_frame_text',  label: 'End Frame + Text',   icon: Film     },
]

export default function CreatePage() {
  const navigate             = useNavigate()
  const [activeTab,  setActiveTab]  = useState('tools')
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)

  useEffect(() => {
    templatesDb.getAll().then(({ data }) => {
      setTemplates(data || [])
      setLoading(false)
    })
  }, [])

  const handleToolSelect = (tool) => {
    navigate('/generate', { state: { type: tool.id, toolLabel: tool.label } })
  }

  const handleTemplateSelect = (template) => {
    navigate('/generate', {
      state: {
        type:                'template',
        templateId:          template.id,
        templateSlug:        template.slug,
        templateName:        template.name,
        templateDescription: template.description,
        minImages:           template.min_images,
        maxImages:           template.max_images,
        creditCost:          template.credit_cost,
        creditCostPerImage:  template.credit_cost_per_image,
      },
    })
  }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        <div className="pt-2 pb-6">
          <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>
            Create
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            What are we making today?
          </p>
        </div>

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-6"
          style={{ background: 'var(--bg-elevated)' }}
        >
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

        {/* Templates Tab */}
        {activeTab === 'templates' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col gap-3"
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
                  className="w-full rounded-2xl overflow-hidden text-left"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
                >
                  {/* Thumbnail */}
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
                    <div
                      className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(8px)' }}
                    >
                      ⚡ {template.credit_cost_per_image
                        ? `${template.credit_cost_per_image}/img`
                        : `${template.credit_cost} cr`}
                    </div>
                  </div>

                  {/* Info row */}
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

{/* Tools Tab */}
{activeTab === 'tools' && (
  <motion.div
    initial={{ opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="grid grid-cols-2 gap-3"
  >
    {TOOLS.map(({ id, label, icon: Icon }, i) => (
      <motion.button
        key={id}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: i * 0.05 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => handleToolSelect({ id, label })}
        className="flex flex-col items-start gap-3 p-4 rounded-2xl transition-colors text-left"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-color)',
        }}
      >
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: 'var(--bg-elevated)' }}
        >
          <Icon size={17} style={{ color: 'var(--brand)' }} strokeWidth={1.6} />
        </div>
        <span className="text-sm font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
          {label}
        </span>
      </motion.button>
    ))}
  </motion.div>
)}
      </PageWrapper>
    </>
  )
}
