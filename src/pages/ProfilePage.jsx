// src/pages/ProfilePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings, Zap, Film, Clock, Plus, ChevronRight, LogOut, Crown } from 'lucide-react'
import { generations as generationsDb, credits as creditsDb, auth } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Modal, Skeleton } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Package Card ─────────────────────────────────────────

const PackageCard = ({ pkg, onSelect, loading }) => (
  <motion.button
    whileTap={{ scale: 0.97 }}
    onClick={() => onSelect(pkg)}
    disabled={loading}
    className="w-full rounded-2xl p-4 text-left transition-all relative overflow-hidden"
    style={{
      background: pkg.is_featured
        ? 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08))'
        : 'var(--bg-elevated)',
      border: pkg.is_featured ? '1.5px solid rgba(249,115,22,0.4)' : '1px solid var(--border)',
    }}
  >
    {pkg.is_featured && (
      <div
        className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-bold"
        style={{ background: 'var(--brand)', color: 'white' }}
      >
        Best Value
      </div>
    )}
    <div className="flex items-center gap-3">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center"
        style={{ background: pkg.is_featured ? 'rgba(249,115,22,0.2)' : 'var(--bg-card)' }}
      >
        <Zap size={20} fill={pkg.is_featured ? 'var(--brand)' : 'none'} style={{ color: 'var(--brand)' }} />
      </div>
      <div className="flex-1">
        <p className="font-bold" style={{ color: 'var(--text-primary)' }}>
          {pkg.name}
        </p>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {pkg.credits} credits
          {pkg.bonus_credits > 0 && (
            <span style={{ color: 'var(--brand)' }}> + {pkg.bonus_credits} bonus</span>
          )}
        </p>
      </div>
      <p className="font-black text-lg" style={{ color: 'var(--text-primary)' }}>
        ₦{pkg.price_ngn?.toLocaleString()}
      </p>
    </div>
  </motion.button>
)

// ─── History Item ─────────────────────────────────────────

const HistoryItem = ({ gen, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-colors"
    style={{ background: 'var(--bg-elevated)' }}
  >
    <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-black">
      {gen.output_url ? (
        gen.output_type === 'video' ? (
          <video src={gen.output_url} className="w-full h-full object-cover" muted preload="metadata" />
        ) : (
          <img src={gen.output_url} alt="" className="w-full h-full object-cover" />
        )
      ) : (
        <div className="w-full h-full flex items-center justify-center" style={{ background: 'var(--bg-card)' }}>
          <Film size={16} style={{ color: 'var(--text-muted)' }} />
        </div>
      )}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
        {gen.templates?.name || gen.generation_type?.replace(/_/g, ' ')}
      </p>
      <p className="text-xs truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>
        {new Date(gen.created_at).toLocaleDateString()}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
        gen.status === 'completed' ? 'text-green-500 bg-green-500/10' :
        gen.status === 'failed'    ? 'text-red-500 bg-red-500/10'    :
                                     'text-yellow-500 bg-yellow-500/10'
      }`}>
        {gen.status}
      </span>
      <ChevronRight size={14} style={{ color: 'var(--text-muted)' }} />
    </div>
  </button>
)

// ─── Profile Page ─────────────────────────────────────────

export default function ProfilePage() {
  const navigate                                              = useNavigate()
  const { user, profile, credits, refreshProfile, isAdmin }  = useAuth()

  const [history,         setHistory]         = useState([])
  const [packages,        setPackages]        = useState([])
  const [historyLoading,  setHistoryLoading]  = useState(true)
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [purchaseLoading,  setPurchaseLoading]  = useState(false)

  const loadHistory = useCallback(async () => {
    if (!user) return
    const { data } = await generationsDb.getUserGenerations(user.id, { limit: 10 })
    setHistory(data || [])
    setHistoryLoading(false)
  }, [user])

  const loadPackages = async () => {
    const { data } = await creditsDb.getPackages()
    setPackages(data || [])
  }

  useEffect(() => {
    loadHistory()
    loadPackages()
  }, [loadHistory])

  const handlePurchase = async (pkg) => {
    setPurchaseLoading(true)
    const { initializePayment } = await import('@/lib/paystack')
    initializePayment({
      email:        user.email,
      amountNgn:    pkg.price_ngn,
      credits:      pkg.credits,
      bonusCredits: pkg.bonus_credits,
      packageSlug:  pkg.slug,
      userId:       user.id,
      onSuccess: async () => {
        await refreshProfile()
        setShowCreditsModal(false)
        toast.success(`${pkg.credits + (pkg.bonus_credits || 0)} credits added! 🎉`)
        setPurchaseLoading(false)
      },
      onClose: () => setPurchaseLoading(false),
    })
  }

  const handleSignOut = async () => {
    await auth.signOut()
    navigate('/auth')
  }

  const QUICK_ACTIONS = [
    { label: 'Settings',    icon: Settings, path: '/settings'  },
    { label: 'Admin Panel', icon: Crown,    path: '/admin',    adminOnly: true },
  ].filter((item) => !item.adminOnly || isAdmin)

  return (
    <>
      <TopBar title="Profile" showCredits={false} />
      <PageWrapper>

        {/* Profile Header */}
        <div className="pt-2 pb-6">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #f97316, #ea580c)', color: 'white' }}
            >
              {profile?.username?.[0]?.toUpperCase() || 'M'}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-black truncate" style={{ color: 'var(--text-primary)' }}>
                {profile?.display_name || profile?.username}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{profile?.username}</p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                  style={{ background: 'rgba(249,115,22,0.1)', color: 'var(--brand)' }}
                >
                  {profile?.tier || 'free'}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {profile?.total_generations || 0} generations
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Credits Card */}
        <motion.div
          whileTap={{ scale: 0.98 }}
          onClick={() => setShowCreditsModal(true)}
          className="rounded-3xl p-5 mb-5 cursor-pointer relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(249,115,22,0.15), rgba(234,88,12,0.08))',
            border: '1.5px solid rgba(249,115,22,0.3)',
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Available credits</p>
              <div className="flex items-center gap-2">
                <Zap size={24} fill="var(--brand)" style={{ color: 'var(--brand)' }} />
                <span className="text-4xl font-black" style={{ color: 'var(--text-primary)' }}>
                  {Math.floor(credits)}
                </span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>Credits never expire</p>
            </div>
            <button
              className="flex items-center gap-2 py-3 px-4 rounded-2xl text-sm font-bold tracking-tight"
              style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
            >
              <Plus size={14} />
              Buy credits
            </button>
          </div>
          <div
            className="mt-3 pt-3 flex items-center gap-4 text-xs"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid rgba(249,115,22,0.2)' }}
          >
            <span>Used: {profile?.total_credits_used?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Purchased: {profile?.total_credits_purchased?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Generations: {profile?.total_generations || 0}</span>
          </div>
        </motion.div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {QUICK_ACTIONS.map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="flex items-center gap-3 p-4 rounded-2xl transition-colors"
              style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
            >
              <item.icon size={20} />
              <span className="text-sm font-semibold">{item.label}</span>
            </button>
          ))}
        </div>

        {/* Recent Creations */}
        <div className="mb-6">
          <h3
            className="text-base font-bold flex items-center gap-2 mb-3"
            style={{ color: 'var(--text-primary)' }}
          >
            <Clock size={16} /> Recent Creations
          </h3>

          {historyLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
            </div>
          ) : history.length === 0 ? (
            <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>
              <Film size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No creations yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {history.map((gen) => (
                <HistoryItem
                  key={gen.id}
                  gen={gen}
                  onClick={() => gen.status === 'completed' && navigate(`/result/${gen.id}`)}
                />
              ))}
            </div>
          )}
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98]"
          style={{
            background: 'var(--bg-elevated)',
            color:      'var(--text-secondary)',
            border:     '1px solid var(--border)',
          }}
        >
          <LogOut size={16} />
          Sign out
        </button>
      </PageWrapper>

      {/* Credits Modal */}
      <Modal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} title="Buy credits">
        <div className="flex flex-col gap-3">
          <div className="p-3 rounded-2xl mb-1" style={{ background: 'var(--bg-elevated)' }}>
            <p className="text-xs font-semibold mb-2 uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
              Credit costs
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {[
                ['Image generation', '1 credit'],
                ['Video 5s',         '2–3 credits'],
                ['Video 8s',         '4 credits'],
                ['Video 10s',        '5 credits'],
                ['Office Handover',  '2 credits'],
                ['Memory Lane',      '1 credit/photo'],
              ].map(([label, cost]) => (
                <div key={label} className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
                  <span className="text-xs font-bold" style={{ color: 'var(--brand)' }}>{cost}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            ✅ Credits never expire · No subscription required
          </p>
          {packages.map((pkg) => (
            <PackageCard key={pkg.id} pkg={pkg} onSelect={handlePurchase} loading={purchaseLoading} />
          ))}
        </div>
      </Modal>
    </>
  )
}
