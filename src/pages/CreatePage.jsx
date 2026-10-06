// src/pages/CreatePage.jsx
import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ImageIcon, VideoIcon, Sparkles, ArrowRight, Layers, UserCircle,
  Crown, Mic, Clock, ScanSearch, Maximize, Clapperboard, Music2,
} from 'lucide-react'
import { templates as templatesDb, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'

// ── Accent system ────────────────────────────────────────────────────────────
// Color is a category signal, not a per-feature decoration: every tile that
// produces the same kind of output shares the same accent. Five families —
// image, video, voice, ugc, and motion — so a color always means the same
// thing everywhere it appears, in both themes. "Motion" is Copy Motion's own
// established green identity (it already carries through to the Copy Motion
// generation page), kept distinct from the general "video" family rather
// than folded into it. These map onto the existing tokens in index.css; no
// new CSS is required.
const ACCENTS = {
  image:  { color: 'var(--tool-image)', subtle: 'var(--tool-image-subtle)', border: 'var(--tool-image-border)' },
  video:  { color: 'var(--tool-video)', subtle: 'var(--tool-video-subtle)', border: 'var(--tool-video-border)' },
  voice:  { color: 'var(--tool-talking-head)', subtle: 'var(--tool-talking-head-subtle)', border: 'var(--tool-talking-head-border)' },
  ugc:    { color: 'var(--tool-ugc)', subtle: 'var(--tool-ugc-subtle)', border: 'var(--tool-ugc-border)' },
  motion: { color: 'var(--tool-motion)', subtle: 'var(--tool-motion-subtle)', border: 'var(--tool-motion-border)' },
  music:  { color: 'var(--tool-music, #a855f7)', subtle: 'var(--tool-music-subtle, rgba(168,85,247,0.12))', border: 'var(--tool-music-border, rgba(168,85,247,0.32))' },
}

// ── Tools ────────────────────────────────────────────────────────────────────
// requiresMaster / comingSoonForPublic are real flags a tile is driven by,
// not dead props — flip either one and the tile locks/greys out on its own.
const TOOLS = [
  {
    id: 'create_image', label: 'Create Image', subtitle: 'From text or reference photo',
    icon: ImageIcon, route: '/create/image', accent: 'image',
  },
  {
    id: 'create_video', label: 'Create Video', subtitle: 'Animate, generate or transform frames',
    icon: VideoIcon, route: '/create/video', accent: 'video',
  },
  {
    id: 'copy_motion', label: 'Copy Motion', subtitle: 'Transfer motion from video to image',
    icon: Layers, route: '/create/copy-motion', accent: 'motion',
  },
  {
    id: 'talking_head', label: 'Talking Head', subtitle: 'Animate faces with text, voice or audio',
    icon: Mic, route: '/create/talking-head', accent: 'voice',
  },
  {
    id: 'create_ugc', label: 'UGC', subtitle: 'Generate content with your characters',
    icon: UserCircle, route: '/create/ugc', accent: 'ugc',
  },
  {
    id: 'create_daw', label: 'DAW AI', subtitle: 'Compose, edit and master full songs',
    icon: Music2, route: '/create/daw', accent: 'music',
  },
]

// ── Utilities ────────────────────────────────────────────────────────────────
// One flat, ungrouped grid instead of named sections — section headers over
// one or two tiles each read as empty scaffolding more than structure.
// IQ Ads is pinned first (it's the tool being promoted right now); every
// other utility follows in alphabetical order. If IQ Ads no longer needs
// the top slot, delete `featured: true` and it'll sort into its normal
// alphabetical place.
const UTILITIES_PINNED = { id: 'iq_ads', label: 'IQ Ads', subtitle: 'Turn your flyer into a cinematic commercial', icon: Clapperboard, route: '/create/iq-ads', accent: 'video', featured: true }

const UTILITIES_REST = [
  { id: 'image_upscaler', label: 'Image Upscaler', subtitle: 'Enlarge and sharpen any image with AI', icon: ScanSearch, route: '/create/image-upscaler', accent: 'image' },
  { id: 'photo_polish', label: 'Photo Polish', subtitle: 'Transform any photo into a cinematic shot', icon: Sparkles, route: '/create/photo-polish', accent: 'image' },
  { id: 'video_upscaler', label: 'Video Upscaler', subtitle: 'Upscale any video to higher resolution', icon: Maximize, route: '/create/video-upscaler', accent: 'video' },
].sort((a, b) => a.label.localeCompare(b.label))

const UTILITIES = [UTILITIES_PINNED, ...UTILITIES_REST]

const TABS = ['tools', 'utilities', 'templates', 'canvas']
const TAB_LABELS = { tools: 'Studios', utilities: 'Utilities', templates: 'Templates', canvas: 'Canvas' }

// ── Feature tile ─────────────────────────────────────────────────────────────
// One card component for both the Tools tab and the Utilities tab, so the
// two tabs read as the same product instead of two different ones. The
// "Open" affordance is always visible rather than hover-only — this is a
// touch-first app, and most users will never see a :hover state.
function FeatureTile({ label, subtitle, icon: Icon, route, accent, index, navigate, locked, comingSoon, badge }) {
  const a = ACCENTS[accent] ?? ACCENTS.image
  const disabled = locked || comingSoon

  const handleClick = () => {
    if (!disabled) navigate(route)
  }

  return (
    <motion.button
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 8) * 0.04 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      onClick={handleClick}
      aria-disabled={disabled}
      className="flex flex-col items-start text-left transition-all duration-200 hover:-translate-y-0.5"
      style={{
        background: disabled
          ? 'var(--bg-card)'
          : `radial-gradient(120% 90% at 100% 0%, ${a.subtle}, transparent 62%), var(--bg-card)`,
        border: `1px solid ${disabled ? 'var(--border-color)' : a.border}`,
        borderRadius: 20,
        minHeight: 156,
        padding: '20px',
        opacity: disabled ? 0.65 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      <div
        className="rounded-2xl flex items-center justify-center flex-shrink-0 mb-3"
        style={{
          width: 44,
          height: 44,
          background: disabled ? 'var(--bg-elevated)' : a.subtle,
          border: `1px solid ${disabled ? 'var(--border-color)' : a.border}`,
        }}
      >
        <Icon
          style={{ width: 20, height: 20, color: disabled ? 'var(--text-muted)' : a.color }}
          strokeWidth={1.4}
        />
      </div>

      <span className="text-sm font-bold mb-1" style={{ color: disabled ? 'var(--text-muted)' : a.color }}>
        {label}
      </span>
      <span className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
        {subtitle}
      </span>

      <div className="w-full flex items-center justify-between mt-4">
        {locked ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--brand)' }}>
            <Crown size={11} /> Master
          </span>
        ) : comingSoon ? (
          <span className="flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>
            <Clock size={11} /> Coming soon
          </span>
        ) : badge ? (
          <span
            className="px-1.5 py-0.5 rounded-md font-semibold"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', fontSize: 11 }}
          >
            {badge}
          </span>
        ) : (
          <span />
        )}
        {!disabled && <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />}
      </div>
    </motion.button>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────
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
      style={{ aspectRatio: '4 / 5', background: 'var(--bg-elevated)' }}
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
        <Sparkles size={26} style={{ color: 'var(--text-muted)' }} strokeWidth={1.4} />
      )}
      <div className="absolute inset-x-0 bottom-0 h-1/3 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.45), transparent)' }} />
    </div>

    <div className="px-3 py-2.5 flex items-center justify-between">
      <div className="min-w-0 flex-1 mr-2">
        <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
          {template.name}
        </p>
        <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {template.description}
        </p>
      </div>
      <ArrowRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
    </div>
  </motion.button>
)

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CreatePage() {
  const navigate                      = useNavigate()
  const location                      = useLocation()
  const { isStaff, isAdmin, profile } = useAuth()
  const isNovice                      = profile?.user_tier !== 'master'
  const [activeTab, setActiveTab]     = useState(location.state?.tab || 'tools')
  const [templates, setTemplates]     = useState([])
  const [loading, setLoading]         = useState(true)
  const [weeklyUsed, setWeeklyUsed]   = useState(null)
  const [weeklyLimit, setWeeklyLimit] = useState(20)

  // Admins and staff bypass coming-soon gates
  const isPrivileged = isAdmin || isStaff

  useEffect(() => {
    if (location.state?.tab) setActiveTab(location.state.tab)
  }, [location.state?.tab])

  useEffect(() => {
    const fetchTemplates = async () => {
      setLoading(true)
      const { data } = await templatesDb.getPublic()
      setTemplates(data || [])
      setLoading(false)
    }
    fetchTemplates()
  }, [])

  // Weekly Copy Motion usage, for the Novice weekly-count badge
  useEffect(() => {
    if (!isNovice || !profile?.id || !isPrivileged) return
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
  }, [isNovice, profile?.id, isPrivileged])

  const handleTemplateSelect = (template) => navigate(`/create/${template.slug}`)

  // Consistent, explicit breakpoint grid everywhere a tile grid appears —
  // matches the Templates tab's own convention instead of introducing a
  // separate auto-fill pattern that can orphan a lone tile with unclaimed
  // column tracks.
  const gridClass = 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4'

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>
        <div className="flex flex-col h-full">

          {/* Header */}
          <div className="pt-2 pb-5 flex-shrink-0">
            <h1 className="text-3xl lg:text-4xl font-black">
              What will you <span className="brand-gradient-text">direct</span> today?
            </h1>
            <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
              Pick a studio, or start a full film.
            </p>
          </div>

          {/* Flagship: Filma */}
          <motion.button
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            whileTap={{ scale: 0.99 }} onClick={() => navigate('/filma')}
            className="relative w-full overflow-hidden text-left mb-6 flex-shrink-0"
            style={{
              borderRadius: 24, padding: '24px',
              background: 'radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, var(--tool-filma) 26%, transparent), transparent 60%), radial-gradient(70% 120% at 0% 100%, var(--brand-light), transparent 60%), var(--bg-card)',
              border: '1px solid var(--tool-filma-border)',
            }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clapperboard size={16} style={{ color: 'var(--tool-filma)' }} />
              <span className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--tool-filma)' }}>Filma · Film studio</span>
            </div>
            <h2 className="text-xl lg:text-2xl font-black mb-1">Script to scenes to shots</h2>
            <p className="text-sm mb-4 max-w-md" style={{ color: 'var(--text-secondary)' }}>
              Cast your actors, build scenes and direct every shot with consistent characters.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-bold px-4 py-2 rounded-full text-white"
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}>
              Open Filma <ArrowRight size={14} />
            </span>
          </motion.button>

          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-2xl mb-6 flex-shrink-0 overflow-x-auto no-scrollbar lg:w-fit" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}>
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="flex-1 lg:flex-none lg:px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200"
                style={{
                  background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                  color:      activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                  boxShadow:  activeTab === tab ? 'var(--shadow)' : 'none',
                }}
              >
                {TAB_LABELS[tab]}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex flex-col flex-1 min-h-0">

            {/* ── Tools Tab ── */}
            {activeTab === 'tools' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={gridClass}>
                {TOOLS.map((tool, i) => {
                  const locked      = !!tool.requiresMaster && isNovice && !isPrivileged
                  const comingSoon  = !!tool.comingSoonForPublic && !isPrivileged
                  const isCopyMotion = tool.id === 'copy_motion'
                  const badge = isCopyMotion && isNovice && isPrivileged && weeklyUsed !== null
                    ? `${weeklyUsed}/${weeklyLimit} this week`
                    : null

                  return (
                    <FeatureTile
                      key={tool.id}
                      label={tool.label}
                      subtitle={tool.subtitle}
                      icon={tool.icon}
                      route={tool.route}
                      accent={tool.accent}
                      index={i}
                      navigate={navigate}
                      locked={locked}
                      comingSoon={comingSoon}
                      badge={badge}
                    />
                  )
                })}
              </motion.div>
            )}

            {/* ── Templates Tab ── */}
            {activeTab === 'templates' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="overflow-y-auto">
                {loading ? (
                  <div className={gridClass}>
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="w-full rounded-2xl" style={{ aspectRatio: '1/1', background: 'var(--bg-card)' }} />
                    ))}
                  </div>
                ) : templates.length === 0 ? (
                  <p className="text-sm text-center py-16" style={{ color: 'var(--text-muted)' }}>
                    No templates yet
                  </p>
                ) : (
                  <div className={gridClass}>
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

            {/* ── Utilities Tab ── */}
            {activeTab === 'utilities' && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={gridClass}>
                {UTILITIES.map((item, i) => (
                  <FeatureTile
                    key={item.id}
                    label={item.label}
                    subtitle={item.subtitle}
                    icon={item.icon}
                    route={item.route}
                    accent={item.accent}
                    index={i}
                    navigate={navigate}
                    locked={!!item.requiresMaster && isNovice && !isPrivileged}
                    comingSoon={!!item.comingSoonForPublic && !isPrivileged}
                    badge={item.featured ? 'Featured' : null}
                  />
                ))}
              </motion.div>
            )}

            {/* ── Canvas Tab — Coming Soon ── */}
            {activeTab === 'canvas' && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-1 flex-col items-center justify-center text-center px-6 py-16"
              >
                <div
                  className="rounded-2xl flex items-center justify-center mb-5"
                  style={{ width: 64, height: 64, background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
                >
                  <img src="/icon-192.png" alt="Canvas" className="logo-icon" style={{ width: 36, height: 36 }} />
                </div>
                <h2 className="text-lg font-black mb-2" style={{ color: 'var(--text-primary)' }}>Coming Soon</h2>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)', maxWidth: 260 }}>
                  We're putting the finishing touches on something great — check back soon.
                </p>
              </motion.div>
            )}

          </div>
        </div>
      </PageWrapper>
    </>
  )
}
