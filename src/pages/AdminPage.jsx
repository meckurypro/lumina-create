// src/pages/AdminPage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, Users, Film, DollarSign,
  CheckCircle, RotateCcw, TrendingUp, Clock, AlertTriangle,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

import PromptEditor                from '@/pages/admin/PromptEditor'
import TemplateManager             from '@/pages/admin/TemplateManager'
import ModelsManager               from '@/pages/admin/ModelsManager'
import StaffManager                from '@/pages/admin/StaffManager'
import FeedModerationItem          from '@/pages/admin/FeedModerationItem'
import FeedPublishedManager        from '@/pages/admin/FeedPublishedManager'
import TierSettings                from '@/pages/admin/TierSettings'
import UsersManager                from '@/pages/admin/UsersManager'
import CinematicTransitionsManager from '@/pages/admin/CinematicTransitionsManager'
import ModelsAnalytics             from '@/pages/admin/ModelsAnalytics'
import ModelUsageManager           from '@/pages/admin/ModelUsageManager'
import GenerationsManager from '@/pages/admin/GenerationsManager'
import EmailManager          from '@/pages/admin/EmailManager'
import RenderWindowManager   from '@/pages/admin/RenderWindowManager'
import RenderWindowModelManager from '@/pages/admin/RenderWindowModelManager'
import RenderWindowAnalytics from '@/pages/admin/RenderWindowAnalytics'
import RenderWindowTeamTierManager from '@/pages/admin/RenderWindowTeamTierManager'
import RWSellerManager       from '@/pages/admin/RWSellerManager'
import RenderWindowBookingsManager from '@/pages/admin/RenderWindowBookingsManager'
import CohortManager from '@/pages/admin/CohortManager'
import IQAdsManager  from '@/pages/admin/IQAdsManager'
import CreditPackagesManager from '@/pages/admin/CreditPackagesManager'
import ModelPricingManager   from '@/pages/admin/ModelPricingManager'

// ─── Stat Card ────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color = 'var(--brand)', sub }) => (
  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)', fontFamily: 'Sora, Inter, sans-serif' }}>{value ?? '—'}</p>
    {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
)

// ─── Tabs ─────────────────────────────────────────────────

const TABS = (pendingCount) => [
  { id: 'dashboard',      label: 'Dashboard'                                           },
  { id: 'users',          label: 'Users'                                               },
  { id: 'staff',          label: 'Staff'                                               },
  { id: 'models',         label: 'Models'                                              },
  { id: 'model_pricing',  label: '💰 Model Pricing'                                    },
  { id: 'generations',    label: 'Generations'                                         },
 { id: 'render_windows', label: '🪟 Render Windows'                                   },
  { id: 'rw_models', label: '🖥️ RW Models' },
  { id: 'rw_analytics', label: '📊 RW Analytics' },
  { id: 'rw_team_tiers', label: '👥 RW Team Tiers' },
  { id: 'rw_sellers', label: '🛡️ RW Sellers' },
  { id: 'rw_bookings', label: '📅 RW Bookings' },
  { id: 'rw_cohorts', label: '🎓 RW Cohorts' },
  { id: 'iqads',       label: '🎬 IQ Ads' },
  { id: 'prompts',        label: 'Prompts'                                             },
  { id: 'templates',      label: 'Templates'                                           },
  { id: 'cinematic',      label: 'Cinematic'                                           },
  { id: 'feed',           label: pendingCount > 0 ? `Feed · ${pendingCount}` : 'Feed' },
  { id: 'email',          label: 'Email'                                               },
  { id: 'settings',       label: 'Tier Settings'                                       },
  { id: 'usage',          label: 'Usage & Pricing'                                     },
  { id: 'credit_packages', label: '💳 Credit Packages'                                 },
  { id: 'analytics',      label: 'Analytics'                                           },
]

// ─── Navigation groups (23 tabs -> 6 groups) ──────────────

const ADMIN_GROUPS = [
  { id: 'overview', label: 'Overview',        tabs: ['dashboard', 'analytics'] },
  { id: 'people',   label: 'People',          tabs: ['users', 'staff'] },
  { id: 'gen',      label: 'Generation',      tabs: ['models', 'model_pricing', 'generations', 'usage', 'prompts', 'templates'] },
  { id: 'rw',       label: 'Render Window',   tabs: ['render_windows', 'rw_models', 'rw_analytics', 'rw_team_tiers', 'rw_sellers', 'rw_bookings', 'rw_cohorts'] },
  { id: 'revenue',  label: 'Products',        tabs: ['credit_packages', 'settings', 'iqads'] },
  { id: 'content',  label: 'Content',         tabs: ['cinematic', 'feed', 'email'] },
]
const cleanLabel = (l) => l.replace(/^[^\p{L}\p{N}]+/u, '')
const groupOf = (tabId) => ADMIN_GROUPS.find((g) => g.tabs.includes(tabId)) || ADMIN_GROUPS[0]

// ─── Admin Page ───────────────────────────────────────────

export default function AdminPage() {
  const navigate       = useNavigate()
  const { user }       = useAuth()
  const [activeTab,    setActiveTab]    = useState('dashboard')
  const [feedSubTab,   setFeedSubTab]   = useState('pending')
  const [stats,        setStats]        = useState(null)
  const [templates,    setTemplates]    = useState([])
  const [pendingPosts, setPendingPosts] = useState([])
  const [recentUsers,  setRecentUsers]  = useState([])
  const [loading,      setLoading]      = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [statsRes, templatesRes, feedRes, usersRes] = await Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.from('templates').select('*').order('sort_order'),
      supabase
        .from('feed_posts')
        .select('*, profiles!feed_posts_user_id_fkey(username, avatar_url), templates(name)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('profiles')
        .select('id, username, display_name, credits, total_generations, tier, created_at')
        .order('created_at', { ascending: false })
        .limit(20),
    ])
    if (feedRes.error) {
      console.error('Feed query error:', feedRes.error)
      toast.error(`Feed error: ${feedRes.error.message}`)
    }
    setStats(statsRes.data)
    setTemplates(templatesRes.data || [])
    setPendingPosts(feedRes.data   || [])
    setRecentUsers(usersRes.data   || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // ── Feed moderation actions ──────────────────────────────

  const handleApprove = async (postId) => {
    const { data, error } = await supabase.rpc('approve_feed_post', {
      p_post_id:  postId,
      p_admin_id: user.id,
    })
    if (error || !data?.success) { toast.error('Failed to approve post'); return }
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    toast.success('Post approved!')
  }

  const handleReject = async (postId, notes = '') => {
    const { data, error } = await supabase.rpc('reject_feed_post', {
      p_post_id:  postId,
      p_admin_id: user.id,
      p_notes:    notes || 'Does not meet community guidelines',
    })
    if (error || !data?.success) { toast.error('Failed to reject post'); return }
    setPendingPosts((prev) => prev.filter((p) => p.id !== postId))
    toast.success('Post rejected')
  }

  const tabs = TABS(pendingPosts.length)

  return (
    <div className="page-container min-h-dvh lg:flex" style={{ background: 'var(--bg-primary)' }}>

      {/* Desktop: grouped sidebar */}
      <aside className="hidden lg:flex flex-col w-[248px] flex-shrink-0 sticky top-0 h-dvh overflow-y-auto px-3 py-4"
        style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border-color)' }}>
        <button onClick={() => navigate('/profile')} className="flex items-center gap-2 px-2 mb-5 text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>
          <ArrowLeft size={16} /> Back to app
        </button>
        <p className="px-2 mb-4 text-lg font-black" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>Admin</p>
        {ADMIN_GROUPS.map((g) => (
          <div key={g.id} className="mb-4">
            <p className="px-2 mb-1.5 text-[11px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>{g.label}</p>
            {g.tabs.map((id) => {
              const t = tabs.find((x) => x.id === id); if (!t) return null
              const on = activeTab === id
              return (
                <button key={id} onClick={() => setActiveTab(id)} className="w-full text-left px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
                  style={{ background: on ? 'var(--brand-light)' : 'transparent', color: on ? 'var(--brand)' : 'var(--text-secondary)' }}>
                  {cleanLabel(t.label)}
                </button>
              )
            })}
          </div>
        ))}
      </aside>

      <div className="flex-1 min-w-0">
      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 lg:px-8 h-14 glass"
        style={{ borderTop: 0, borderLeft: 0, borderRight: 0 }}
      >
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 rounded-xl lg:hidden" style={{ color: 'var(--text-secondary)' }} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base lg:text-lg font-bold flex-1" style={{ color: 'var(--text-primary)' }}>
          <span className="lg:hidden">Admin Panel</span>
          <span className="hidden lg:inline">{cleanLabel(tabs.find((t) => t.id === activeTab)?.label || '')}</span>
        </h1>
        <button onClick={loadData} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }} aria-label="Refresh">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Mobile: group row + section row */}
      <div className="lg:hidden" style={{ borderBottom: '1px solid var(--border-color)' }}>
        <div className="flex gap-1.5 overflow-x-auto px-4 pt-3 no-scrollbar">
          {ADMIN_GROUPS.map((g) => {
            const on = groupOf(activeTab).id === g.id
            return (
              <button key={g.id} onClick={() => setActiveTab(g.tabs[0])} className="px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap"
                style={{ background: on ? 'var(--brand)' : 'var(--bg-elevated)', color: on ? '#fff' : 'var(--text-muted)' }}>{g.label}</button>
            )
          })}
        </div>
        <div className="flex gap-1 overflow-x-auto px-4 py-3 no-scrollbar">
          {groupOf(activeTab).tabs.map((id) => {
            const t = tabs.find((x) => x.id === id); if (!t) return null
            const on = activeTab === id
            return (
              <button key={id} onClick={() => setActiveTab(id)} className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
                style={{ background: on ? 'var(--brand-light)' : 'transparent', color: on ? 'var(--brand)' : 'var(--text-muted)' }}>{cleanLabel(t.label)}</button>
            )
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 lg:px-8 py-5 pb-24 max-w-6xl">

        {/* ── Dashboard ── */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : stats ? (
              <>
           
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <StatCard icon={Users}         label="Total users"       value={stats.total_users?.toLocaleString()}             sub={`+${stats.new_users_today} new today`}                    />
                  <StatCard icon={Film}          label="Total generations" value={stats.total_generations?.toLocaleString()}        sub={`${stats.generations_today} today`}    color="#8b5cf6"    />
                  <StatCard icon={TrendingUp}    label="Success rate"      value={`${stats.success_rate_today}%`}                  sub="Today"                                 color="#10b981"    />
                  <StatCard icon={AlertTriangle} label="Failed today"      value={stats.failed_today}                              sub="Auto-refunded"                         color="#ef4444"    />
                  <StatCard icon={DollarSign}    label="Revenue (NGN)"     value={`₦${stats.total_revenue_ngn?.toLocaleString()}`} sub={`₦${stats.revenue_today_ngn?.toLocaleString()} today`} color="#10b981" />
                  <StatCard icon={Clock}         label="Pending feed"      value={stats.pending_feed_posts}                        sub="Awaiting review"                       color="#eab308"    />
                  <StatCard icon={Users}         label="Seen today"        value={stats.seen_today}                                sub="Opened the app"                        color="#06b6d4"    />
                  <StatCard icon={TrendingUp}    label="Active today"      value={stats.active_users_today}                        sub="Spent credits"                         color="#f97316"    />
                </div>
              </>
            ) : (
              <p style={{ color: 'var(--text-muted)' }}>Failed to load stats.</p>
            )}
          </motion.div>
        )}

        {/* ── Analytics ── */}
        {activeTab === 'analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ModelsAnalytics />
          </motion.div>
        )}

        {/* ── Usage & Pricing ── */}
        {activeTab === 'usage' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ModelUsageManager />
          </motion.div>
        )}

        {/* ── Credit Packages ── */}
        {activeTab === 'credit_packages' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CreditPackagesManager />
          </motion.div>
        )}

        {/* ── Prompts ── */}
        {activeTab === 'prompts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
              Edit template prompts. Changes apply instantly to all new generations.
            </p>
            {templates.map((template) => (
              <PromptEditor key={template.id} template={template} onSave={loadData} />
            ))}
          </motion.div>
        )}

        {/* ── Templates ── */}
        {activeTab === 'templates' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TemplateManager templates={templates} onRefresh={loadData} />
          </motion.div>
        )}

        {/* ── Models ── */}
        {activeTab === 'models' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ModelsManager />
          </motion.div>
        )}

        {/* ── Model Pricing ── */}
        {activeTab === 'model_pricing' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ModelPricingManager />
          </motion.div>
        )}

        {/* ── Cinematic Transitions ── */}
        {activeTab === 'cinematic' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CinematicTransitionsManager />
          </motion.div>
        )}

        {/* ── Staff ── */}
        {activeTab === 'staff' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <StaffManager />
          </motion.div>
        )}

        {/* ── Feed ── */}
        {activeTab === 'feed' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {/* Sub-tabs */}
            <div className="flex gap-2 mb-4">
              {['pending', 'published'].map((sub) => (
                <button
                  key={sub}
                  onClick={() => setFeedSubTab(sub)}
                  className="px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all"
                  style={{
                    background: feedSubTab === sub ? 'var(--brand)' : 'var(--bg-elevated)',
                    color:      feedSubTab === sub ? 'white' : 'var(--text-muted)',
                  }}
                >
                  {sub === 'pending' && pendingPosts.length > 0
                    ? `Pending · ${pendingPosts.length}`
                    : sub.charAt(0).toUpperCase() + sub.slice(1)
                  }
                </button>
              ))}
            </div>

            {/* Pending */}
            {feedSubTab === 'pending' && (
              pendingPosts.length === 0 ? (
                <div className="text-center py-16" style={{ color: 'var(--text-muted)' }}>
                  <CheckCircle size={32} className="mx-auto mb-2 opacity-30" />
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>All caught up!</p>
                  <p className="text-xs mt-1">No posts pending review.</p>
                </div>
              ) : (
                <>
                  <p className="text-xs font-bold uppercase tracking-wide mb-4" style={{ color: 'var(--text-muted)' }}>
                    {pendingPosts.length} post{pendingPosts.length !== 1 ? 's' : ''} awaiting review
                  </p>
                  {pendingPosts.map((post) => (
                    <FeedModerationItem
                      key={post.id}
                      post={post}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  ))}
                </>
              )
            )}

            {/* Published */}
            {feedSubTab === 'published' && <FeedPublishedManager />}

          </motion.div>
        )}

        {/* ── Users ── */}
        {activeTab === 'users' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <UsersManager />
          </motion.div>
        )}
        {/* ── Generations ── */}
{activeTab === 'generations' && (
<motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
<GenerationsManager />
</motion.div>
)}
{activeTab === 'email' && (
  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
    <EmailManager />
  </motion.div>
)}
        {/* ── Render Windows ── */}
        {activeTab === 'render_windows' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RenderWindowManager />
          </motion.div>
        )}
       {/* ── RW Model Manager ── */}
        {activeTab === 'rw_models' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RenderWindowModelManager />
          </motion.div>
        )}

     {/* ── RW Analytics ── */}
        {activeTab === 'rw_analytics' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RenderWindowAnalytics />
          </motion.div>
        )}

        {/* ── RW Team Tiers ── */}
        {activeTab === 'rw_team_tiers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RenderWindowTeamTierManager />
          </motion.div>
        )}

      {/* ── RW Sellers ── */}
        {activeTab === 'rw_sellers' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RWSellerManager />
          </motion.div>
        )}

        {/* ── RW Bookings ── */}
        {activeTab === 'rw_bookings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <RenderWindowBookingsManager />
          </motion.div>
        )}
 
       {/* ── RW Cohorts ── */}
        {activeTab === 'rw_cohorts' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <CohortManager />
          </motion.div>
        )}

        {/* ── IQ Ads ── */}
        {activeTab === 'iqads' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <IQAdsManager onNavigateToPricing={() => setActiveTab('model_pricing')} />
          </motion.div>
        )}

        {/* ── Tier Settings ── */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <TierSettings />
          </motion.div>
        )}

      </div>
      </div>
    </div>
  )
}
