// src/pages/CreatePage.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ImageIcon, VideoIcon, Sparkles, ArrowRight, Layers, UserCircle, Crown, Mic } from 'lucide-react'
import { templates as templatesDb, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Skeleton } from '@/components/ui/Modal'

const TYPE_LABELS = {
  text_to_image:   'Text to Image',
  image_to_image:  'Image to Image',
  text_to_video:   'Text to Video',
  image_to_video:  'Image to Video',
  start_end_frame: 'Start + End Frame',
  end_frame_text:  'End Frame + Text',
  motion_transfer: 'Motion Transfer',
}

// Each tool carries its own accent token name so ToolCard reads from CSS vars
const TOOLS = [
  {
    id:        'create_image',
    label:     'Create Image',
    subtitle:  'From text or reference photo',
    icon:      ImageIcon,
    route:     '/create/image',
    accentVar: '--tool-image',
  },
  {
    id:        'create_video',
    label:     'Create Video',
    subtitle:  'Animate, generate or transform frames',
    icon:      VideoIcon,
    route:     '/create/video',
    accentVar: '--tool-video',
  },
  {
    id:        'copy_motion',
    label:     'Copy Motion',
    subtitle:  'Transfer motion from video to image',
    icon:      Layers,
    route:     '/create/copy-motion',
    accentVar: '--tool-motion',
  },
  {
    id:        'talking_head',
    label:     'Talking Head',
    subtitle:  'Animate faces with voice or audio',
    icon:      Mic,
    route:     '/create/talking-head',
    accentVar: '--tool-talking-head',
  },
  {
    id:        'create_ugc',
    label:     'UGC',
    subtitle:  'Generate content with your characters',
    icon:      UserCircle,
    route:     '/create/ugc',
    accentVar: '--tool-ugc',
  },
]

// ── Template Card ─────────────────────────────────────────────────────────────
const TemplateCard = ({ template, index, onClick }) => (
  <motion.button
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: index * 0.06 }}
    whileTap={{ scale: 0.97 }}
    onClick={onClick}
    className="w-full rounded-2xl overflow-hidden text-left flex flex-col"
    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
  >
    <div
      className="w-full relative flex items-center justify-center overflow-hidden"
      style={{
        aspectRatio: '1 / 1',
        background: template.thumbnail_url || template.demo_video_url
          ? undefined
          : 'linear-gradient(135deg, rgba(249,115,22,0.12), rgba(234,88,12,0.06))',
      }}
    >
      {template.demo_video_url ? (
        <video
          src={template.demo_video_url}
          autoPlay muted loop playsInline
          className="absolute inset-0 w-full h-full object-cover"
          poster={template.thumbnail_url || undefined}
        />
      ) : template.thumbnail_url ? (
        <img
          src={template.thumbnail_url}
          alt={template.name}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <Sparkles size={28} style={{ color: 'var(--brand)', opacity: 0.35 }} />
      )}
    </div>

    <div className="px-3 py-2.5 flex items-center justify-between">
      <div className="min-w-0 flex-1 mr-2">
        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {template.name}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
          {template.description}
        </p>
      </div>
      <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  </motion.button>
)

// ── Square tool card (used in 2-col row) ──────────────────────────────────────
function ToolCard({ id, label, subtitle, icon: Icon, route, accentVar, index, navigate }) {
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileTap={{ scale: 0.97 }}
      onClick={() => navigate(route)}
      className="flex flex-col items-center justify-between rounded-2xl overflow-hidden transition-all"
      style={{
        background:  'var(--bg-card)',
        border:      `1px solid var(${accentVar}-border, var(--border-color))`,
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
            background:  `var(${accentVar}-subtle, var(--bg-elevated))`,
            border:      `1px solid var(${accentVar}-border, var(--border-color))`,
          }}
        >
          <Icon
            style={{
              width:  '42%',
              height: '42%',
              color:  `var(${accentVar}, var(--text-primary))`,
            }}
            strokeWidth={1.4}
          />
        </div>
      </div>
      <div className="w-full flex flex-col gap-0.5 items-center text-center flex-shrink-0">
        <span
          className="text-sm font-bold"
          style={{ color: `var(${accentVar}, var(--text-primary))` }}
        >
          {label}
        </span>
        <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
          {subtitle}
        </span>
      </div>
    </motion.button>
  )
}

// ── Wide tool card (used for 3rd tool and beyond) ─────────────────────────────

function ToolCardWide({ id, label, subtitle, icon: Icon, route, accentVar, index, navigate, locked, weeklyBadge }) {
  const handleClick = () => {
    if (!locked) navigate(route)
  }
  return (
    <motion.button
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      whileTap={{ scale: locked ? 1 : 0.97 }}
      onClick={handleClick}
      className="flex items-center gap-4 w-full rounded-2xl transition-all mb-4"
      style={{
        background: 'var(--bg-card)',
        border:     `1px solid var(${accentVar}-border, var(--border-color))`,
        padding:    '16px 20px',
        opacity:    locked ? 0.75 : 1,
        cursor:     locked ? 'default' : 'pointer',
      }}
    >
      <div
        className="rounded-2xl flex items-center justify-center flex-shrink-0"
        style={{
          width:      52,
          height:     52,
          background: `var(${accentVar}-subtle, var(--bg-elevated))`,
          border:     `1px solid var(${accentVar}-border, var(--border-color))`,
        }}
      >
        <Icon
          style={{
            width:  22,
            height: 22,
            color:  `var(${accentVar}, var(--text-primary))`,
          }}
          strokeWidth={1.4}
        />
      </div>
      <div className="flex flex-col gap-0.5 text-left flex-1 min-w-0">
        <span
          className="text-sm font-bold"
          style={{ color: `var(${accentVar}, var(--text-primary))` }}
        >
          {label}
        </span>
        {locked ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            <Crown size={10} />
            Upgrade to Master
          </span>
        ) : weeklyBadge ? (
          <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
            <span
              className="ml-2 px-1.5 py-0.5 rounded-md text-xs font-semibold"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 10 }}
            >
              {weeklyBadge}
            </span>
          </span>
        ) : (
          <span className="text-xs leading-snug" style={{ color: 'var(--text-muted)' }}>
            {subtitle}
          </span>
        )}
      </div>
      {locked
        ? <Crown size={15} style={{ color: 'var(--brand)', flexShrink: 0 }} />
        : <ArrowRight size={16} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
      }
    </motion.button>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function CreatePage() {
  const navigate                        = useNavigate()
  const location                        = useLocation()
  const { isStaff, isAdmin, profile }   = useAuth()
  const isNovice                        = profile?.user_tier !== 'master'
  const [activeTab, setActiveTab]       = useState(location.state?.tab || 'tools')
  const [templates,  setTemplates]      = useState([])
  const [loading,    setLoading]        = useState(true)
  const [weeklyUsed, setWeeklyUsed]     = useState(null)
  const [weeklyLimit, setWeeklyLimit]   = useState(20)

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)
      const { data } = await templatesDb.getPublic()
      setTemplates(data || [])
      setLoading(false)
    }
    fetchTemplates()
  }, [])

  // Fetch weekly Copy Motion count + limit for Novices
  useEffect(() => {
    if (!isNovice || !profile?.id) return
    const fetchWeekly = async () => {
      const [{ data: settingRow }, { count }] = await Promise.all([
        supabase.from('app_settings').select('value').eq('key', 'novice_copy_motion_weekly_limit').single(),
        supabase
          .from('generations')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', profile.id)
          .eq('generation_type', 'motion_transfer')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ])
      if (settingRow) setWeeklyLimit(Number(JSON.parse(settingRow.value)))
      setWeeklyUsed(count ?? 0)
    }
    fetchWeekly()
  }, [isNovice, profile?.id])

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
                <div className="w-full" style={{ maxWidth: '520px' }}>
                  {/* First row — 2 columns */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    {TOOLS.slice(0, 2).map(({ id, label, subtitle, icon: Icon, route, accentVar }, i) => (
                      <ToolCard
                        key={id}
                        id={id}
                        label={label}
                        subtitle={subtitle}
                        icon={Icon}
                        route={route}
                        accentVar={accentVar}
                        index={i}
                        navigate={navigate}
                      />
                    ))}
                  </div>
                  {/* Remaining tools — full width each */}
                  {TOOLS.slice(2).map(({ id, label, subtitle, icon: Icon, route, accentVar }, i) => {
                    const isCopyMotion  = id === 'copy_motion'
                    const locked        = false
                    const weeklyBadge   = isCopyMotion && isNovice && weeklyUsed !== null
                      ? `${weeklyUsed}/${weeklyLimit} this week`
                      : null
                    return (
                      <ToolCardWide
                        key={id}
                        id={id}
                        label={label}
                        subtitle={subtitle}
                        icon={Icon}
                        route={route}
                        accentVar={accentVar}
                        index={i + 2}
                        navigate={navigate}
                        locked={locked}
                        weeklyBadge={weeklyBadge}
                      />
                    )
                  })}
                </div>
              </motion.div>
            )}

            {/* Templates Tab */}
            {activeTab === 'templates' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="overflow-y-auto"
              >
                {loading ? (
                  <div className="grid grid-cols-2 gap-3">
                    {[...Array(4)].map((_, i) => (
                      <div
                        key={i}
                        className="w-full rounded-2xl"
                        style={{ aspectRatio: '1/1', background: 'var(--bg-card)' }}
                      />
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    No templates yet
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {templates.map((template, i) => (
                      <TemplateCard
                        key={template.id}
                        template={template}
                        index={i}
                        onClick={() => handleTemplateSelect(template)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* Canvas Tab — Coming Soon */}
            {activeTab === 'canvas' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 flex-col items-center justify-center text-center px-6 py-16"
              >
                <div
                  className="rounded-2xl flex items-center justify-center mb-5"
                  style={{
                    width: 64,
                    height: 64,
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-color)',
                  }}
                >
                  <Sparkles size={28} style={{ color: 'var(--brand)' }} />
                </div>
                <h2 className="text-lg font-black mb-2" style={{ color: 'var(--text-primary)' }}>
                  Coming Soon
                </h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 260 }}>
                  Canvas is on its way. We're putting the finishing touches on something great — check back soon.
                </p>
              </motion.div>
            )}

          </div>
        </div>
      </PageWrapper>
    </>
  )
}
