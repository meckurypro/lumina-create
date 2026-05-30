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

import PromptEditor                  from '@/pages/admin/PromptEditor'
import TemplateManager               from '@/pages/admin/TemplateManager'
import ModelsManager                 from '@/pages/admin/ModelsManager'
import StaffManager                  from '@/pages/admin/StaffManager'
import FeedModerationItem            from '@/pages/admin/FeedModerationItem'
import FeedPublishedManager          from '@/pages/admin/FeedPublishedManager'
import ProviderSettings              from '@/pages/admin/ProviderSettings'
import UsersManager                  from '@/pages/admin/UsersManager'
import CinematicTransitionsManager   from '@/pages/admin/CinematicTransitionsManager'
import ModelsAnalytics               from '@/pages/admin/ModelsAnalytics'
import ModelUsageManager             from '@/pages/admin/ModelUsageManager'

// ─── Stat Card ────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color = 'var(--brand)', sub }) => (
  <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <div className="flex items-center gap-2 mb-2">
      <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: `${color}20` }}>
        <Icon size={16} style={{ color }} />
      </div>
      <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
    </div>
    <p className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>{value ?? '—'}</p>
    {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
  </div>
)

// ─── Tabs ─────────────────────────────────────────────────

const TABS = (pendingCount) => [
  { id: 'dashboard',  label: 'Dashboard'                                           },
  { id: 'analytics',  label: 'Analytics'                                           },
  { id: 'usage',      label: 'Usage & Pricing'                                     },
  { id: 'prompts',    label: 'Prompts'                                             },
  { id: 'templates',  label: 'Templates'                                           },
  { id: 'models',     label: 'Models'                                              },
  { id: 'cinematic',  label: 'Cinematic'                                           },
  { id: 'staff',      label: 'Staff'                                               },
  { id: 'feed',       label: pendingCount > 0 ? `Feed · ${pendingCount}` : 'Feed' },
  { id: 'users',      label: 'Users'                                               },
  { id: 'settings',   label: 'Settings'                                            },
]

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

  // ── Feed moderation actions ──

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
    <div className="page-container min-h-dvh" style={{ background: 'var(--bg-primary)' }}>

      {/* Header */}
      <div
        className="sticky top-0 z-40 flex items-center gap-3 px-4 h-14"
        style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)' }}
      >
        <button onClick={() => navigate('/profile')} className="p-2 -ml-2 rounded-xl" style={{ color: 'var(--text-secondary)' }}>
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-base font-bold flex-1" style={{ color: 'var(--text-primary)' }}>Admin Panel</h1>
        <button onClick={loadData} className="p-2 rounded-xl" style={{ color: 'var(--text-muted)' }}>
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto px-4 py-3 no-scrollbar" style={{ borderBottom: '1px solid var(--border-color)' }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 rounded-xl text-sm font-semibold whitespace-nowrap transition-all"
            style={{
              background: activeTab === tab.id ? 'var(--brand)' : 'var(--bg-elevated)',
              color:      activeTab === tab.id ? 'white' : 'var(--text-muted)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-5 pb-24">

        {/* ── Dashboard ── */}
        {activeTab === 'dashboard' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            {loading ? (
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
            ) : stats ? (
              <>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <StatCard icon={Users}         label="Total users"       value={stats.total_users?.toLocaleString()}             sub={`+${stats.new_users_today} today`}                        />
                  <StatCard icon={Film}          label="Total generations" value={stats.total_generations?.toLocaleString()}        sub={`${stats.generations_today} today`}    color="#8b5cf6"    />
                  <StatCard icon={TrendingUp}    label="Success rate"      value={`${stats.success_rate_today}%`}                  sub="Today"                                 color="#10b981"    />
                  <StatCard icon={AlertTriangle} label="Failed today"      value={stats.failed_today}                              sub="Auto-refunded"                         color="#ef4444"    />
                  <StatCard icon={DollarSign}    label="Revenue (NGN)"     value={`₦${stats.total_revenue_ngn?.toLocaleString()}`} sub={`₦${stats.revenue_today_ngn?.toLocaleString()} today`} color="#10b981" />
                  <StatCard icon={Clock}         label="Pending feed"      value={stats.pending_feed_posts}                        sub="Awaiting review"                       color="#eab308"    />
                </div>
                <StatCard icon={Users} label="Active users today" value={stats.active_users_today} color="#06b6d4" />
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

        {/* ── Settings ── */}
        {activeTab === 'settings' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <ProviderSettings />
          </motion.div>
        )}

      </div>
    </div>
  )
}
