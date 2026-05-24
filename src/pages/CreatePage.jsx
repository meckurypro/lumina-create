// src/pages/CreatePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sparkles, Wand2, Film, Image, Layers, ArrowRight, Star, Zap } from 'lucide-react'
import { templates as templatesDb } from '@/lib/supabase'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Modal'
import { SmartPromptInput } from '@/components/ui/SmartPromptInput'
import { useAuth } from '@/context/AuthContext'

// ─── Tools ────────────────────────────────────────────────

const TOOLS = [
  {
    id:          'text_to_image',
    label:       'Text to Image',
    description: 'Generate images from your words',
    icon:        Image,
    color:       '#8b5cf6',
    bg:          'rgba(139,92,246,0.12)',
    credits:     1,
  },
  {
    id:          'image_to_image',
    label:       'Image to Image',
    description: 'Transform an image with a prompt',
    icon:        Wand2,
    color:       '#06b6d4',
    bg:          'rgba(6,182,212,0.12)',
    credits:     1,
  },
  {
    id:          'text_to_video',
    label:       'Text to Video',
    description: 'Turn your words into video',
    icon:        Film,
    color:       '#f97316',
    bg:          'rgba(249,115,22,0.12)',
    credits:     3,
  },
  {
    id:          'image_to_video',
    label:       'Image to Video',
    description: 'Animate any image',
    icon:        Sparkles,
    color:       '#10b981',
    bg:          'rgba(16,185,129,0.12)',
    credits:     2,
  },
  {
    id:          'start_end_frame',
    label:       'Start + End Frame',
    description: 'AI fills motion between two images',
    icon:        Layers,
    color:       '#f43f5e',
    bg:          'rgba(244,63,94,0.12)',
    credits:     2,
  },
  {
    id:          'end_frame_text',
    label:       'End Frame + Text',
    description: 'Generate video that lands on your image',
    icon:        Film,
    color:       '#eab308',
    bg:          'rgba(234,179,8,0.12)',
    credits:     2,
  },
]

const TYPE_LABELS = {
  text_to_image:   'Text to Image',
  image_to_image:  'Image to Image',
  text_to_video:   'Text to Video',
  image_to_video:  'Image to Video',
  start_end_frame: 'Start + End Frame',
  end_frame_text:  'End Frame + Text',
}

const LOW_CREDIT_THRESHOLD = 3

// ─── Create Page ──────────────────────────────────────────

export default function CreatePage() {
  const navigate                  = useNavigate()
  const { credits }               = useAuth()
  const [activeTab,  setActiveTab]  = useState('smart')
  const [templates,  setTemplates]  = useState([])
  const [loading,    setLoading]    = useState(true)

  const isLowCredits = credits < LOW_CREDIT_THRESHOLD

  useEffect(() => {
    const fetchTemplates = async () => {
      const { data } = await templatesDb.getAll()
      setTemplates(data || [])
      setLoading(false)
    }
    fetchTemplates()
  }, [])

  const handleToolSelect = (tool) => {
    navigate('/generate', { state: { type: tool.id, toolLabel: tool.label } })
  }

  const handleTemplateSelect = (template) => {
    navigate('/generate', {
      state: {
        type:               'template',
        templateId:         template.id,
        templateSlug:       template.slug,
        templateName:       template.name,
        templateDescription: template.description,
        minImages:          template.min_images,
        maxImages:          template.max_images,
        creditCost:         template.credit_cost,
        creditCostPerImage: template.credit_cost_per_image,
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

        {/* Low credits warning */}
        {isLowCredits && (
          <div
            className="flex items-center gap-2 p-3 rounded-2xl mb-4"
            style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}
          >
            <Zap size={14} style={{ color: '#eab308', flexShrink: 0 }} />
            <p className="text-xs font-medium" style={{ color: '#eab308' }}>
              You're running low on credits.{' '}
              <button onClick={() => navigate('/profile')} className="underline font-bold">
                Top up here
              </button>
            </p>
          </div>
        )}

        {/* Tabs */}
        <div
          className="flex gap-1 p-1 rounded-2xl mb-6"
          style={{ background: 'var(--bg-elevated)' }}
        >
          {['smart', 'templates', 'tools'].map((tab) => (
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
              {tab === 'smart' ? '✦ AI' : tab}
            </button>
          ))}
        </div>

        {/* Smart Tab */}
        {activeTab === 'smart' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="mb-5">
              <p className="text-xs font-semibold mb-1 uppercase tracking-widest" style={{ color: 'var(--brand)' }}>
                ✦ AI-powered
              </p>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Describe anything — Claude picks the right tool, refines your prompt, and gets you to generate in one step.
              </p>
            </div>
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
            className="flex flex-col gap-4"
          >
            {loading ? (
              <>
                <Skeleton className="h-40 w-full" />
                <Skeleton className="h-40 w-full" />
              </>
            ) : templates.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                No templates available yet
              </div>
            ) : (
              templates.map((template, i) => (
                <motion.button
                  key={template.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTemplateSelect(template)}
                  className="w-full rounded-3xl overflow-hidden text-left relative"
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
                >
                  <div
                    className="h-36 w-full relative flex items-center justify-center"
                    style={{
                      background: template.thumbnail_url
                        ? undefined
                        : 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08))',
                    }}
                  >
                    {template.thumbnail_url ? (
                      <img src={template.thumbnail_url} alt={template.name} className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles size={40} style={{ color: 'var(--brand)', opacity: 0.4 }} />
                    )}

                    {template.is_featured && (
                      <div
                        className="absolute top-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold"
                        style={{ background: 'var(--brand)', color: 'white' }}
                      >
                        <Star size={10} fill="white" />
                        Featured
                      </div>
                    )}

                    <div
                      className="absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-bold"
                      style={{ background: 'rgba(0,0,0,0.5)', color: 'white', backdropFilter: 'blur(8px)' }}
                    >
                      ⚡{' '}
                      {template.credit_cost_per_image
                        ? `${template.credit_cost_per_image}/img`
                        : `${template.credit_cost} credits`}
                    </div>
                  </div>

                  <div className="p-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                        {template.name}
                      </h3>
                      <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        {template.description}
                      </p>
                      <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
                        {template.min_images === template.max_images
                          ? `${template.min_images} image${template.min_images !== 1 ? 's' : ''} required`
                          : `${template.min_images}–${template.max_images} images`}
                      </p>
                    </div>
                    <div
                      className="ml-4 w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                      style={{ background: 'rgba(249,115,22,0.1)' }}
                    >
                      <ArrowRight size={18} style={{ color: 'var(--brand)' }} />
                    </div>
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
            {TOOLS.map((tool, i) => (
              <motion.button
                key={tool.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => handleToolSelect(tool)}
                className="rounded-3xl p-4 text-left"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
              >
                <div
                  className="w-11 h-11 rounded-2xl flex items-center justify-center mb-3"
                  style={{ background: tool.bg }}
                >
                  <tool.icon size={22} style={{ color: tool.color }} />
                </div>
                <h3 className="font-bold text-sm leading-tight mb-1" style={{ color: 'var(--text-primary)' }}>
                  {tool.label}
                </h3>
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {tool.description}
                </p>
                <div className="mt-3 text-xs font-bold" style={{ color: tool.color }}>
                  ⚡ from {tool.credits} credits
                </div>
              </motion.button>
            ))}
          </motion.div>
        )}
      </PageWrapper>
    </>
  )
}
