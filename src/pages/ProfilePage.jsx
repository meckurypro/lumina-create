// src/pages/ProfilePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings, Zap, Plus, LogOut, Crown, ChevronRight } from 'lucide-react'
import { credits as creditsDb, auth } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import { Modal } from '@/components/ui/Modal'
import toast from 'react-hot-toast'

// ─── Package Card ─────────────────────────────────────────

const PackageCard = ({ pkg, onSelect, loading }) => (
  <motion.button
    whileTap={{ scale: 0.98 }}
    onClick={() => onSelect(pkg)}
    disabled={loading}
    className="w-full text-left"
    style={{
      background:              'none',
      border:                  'none',
      borderBottom:            '1px solid var(--border-color)',
      padding:                 '16px 0',
      cursor:                  loading ? 'not-allowed' : 'pointer',
      opacity:                 loading ? 0.5 : 1,
      WebkitTapHighlightColor: 'transparent',
    }}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {pkg.name}
        </p>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {pkg.credits}{pkg.bonus_credits > 0 ? ` + ${pkg.bonus_credits} bonus` : ''} credits
        </p>
      </div>
      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
        ₦{pkg.price_ngn?.toLocaleString()}
      </p>
    </div>
  </motion.button>
)

// ─── Profile Page ─────────────────────────────────────────

export default function ProfilePage() {
  const navigate                                                  = useNavigate()
  const { user, profile, credits, refreshProfile, isAdmin }      = useAuth()

  const [packages,         setPackages]         = useState([])
  const [showCreditsModal, setShowCreditsModal] = useState(false)
  const [purchaseLoading,  setPurchaseLoading]  = useState(false)

  useEffect(() => {
    creditsDb.getPackages().then(({ data }) => setPackages(data || []))
  }, [])

  const handlePurchase = async (pkg) => {
    if (!user?.email) { toast.error('Please log in to purchase credits'); return }
    setPurchaseLoading(true)
    try {
      const { initializePayment } = await import('@/lib/paystack')
      await initializePayment({
        email:        user.email,
        amountNgn:    pkg.price_ngn,
        credits:      pkg.credits,
        bonusCredits: pkg.bonus_credits || 0,
        packageSlug:  pkg.slug,
        userId:       user.id,
        onSuccess: async () => {
          await refreshProfile()
          setShowCreditsModal(false)
          toast.success(`${pkg.credits + (pkg.bonus_credits || 0)} credits added!`)
          setPurchaseLoading(false)
        },
        onClose: () => setPurchaseLoading(false),
      })
    } catch (err) {
      console.error('Paystack error:', err)
      toast.error(err.message || 'Could not launch payment. Try again.')
      setPurchaseLoading(false)
    }
  }

  const handleSignOut = async () => {
    await auth.signOut()
    navigate('/auth')
  }

  const isMaster      = profile?.user_tier === 'master'
  const daysRemaining = isMaster && profile?.tier_expires_at
    ? Math.max(0, Math.ceil((new Date(profile.tier_expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>

        {/* ── Profile header ── */}
        <div className="pt-2 pb-6 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black flex-shrink-0"
            style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}
          >
            {profile?.username?.[0]?.toUpperCase() || 'M'}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {profile?.display_name || profile?.username}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              @{profile?.username}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <span
                className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
              >
                {profile?.tier || 'free'}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {profile?.total_generations || 0} generations
              </span>
            </div>
          </div>
        </div>

        {/* ── Credits card ── */}
        <div
          className="rounded-2xl p-5 mb-3"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Available credits
          </p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Zap size={20} style={{ color: 'var(--text-primary)' }} fill="currentColor" />
              <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
                {Math.floor(credits)}
              </span>
            </div>
            <button
              onClick={() => setShowCreditsModal(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'var(--text-primary)', color: 'var(--text-inverse)' }}
            >
              <Plus size={14} />
              Buy credits
            </button>
          </div>
          <div
            className="mt-4 pt-3 flex items-center gap-3 text-xs"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}
          >
            <span>Used: {profile?.total_credits_used?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Purchased: {profile?.total_credits_purchased?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Generations: {profile?.total_generations || 0}</span>
          </div>
        </div>

        {/* ── Tier card ── */}
        <div
          className="rounded-2xl p-5 mb-3"
          style={{
            background: isMaster ? 'rgba(245,158,11,0.06)' : 'var(--bg-card)',
            border:     `1px solid ${isMaster ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'}`,
          }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Your plan</p>
              <p className="text-lg font-black" style={{ color: isMaster ? '#f59e0b' : 'var(--text-primary)' }}>
                {isMaster ? '⭐ Master' : 'Novice'}
              </p>
              {isMaster && daysRemaining !== null && (
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {daysRemaining} days remaining
                </p>
              )}
            </div>
            {!isMaster && (
              <a
                href="https://wa.me/2348162465247?text=Hi%2C%20I%20want%20to%20upgrade%20to%20Master%20on%20Meckury%20AI"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]"
                style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                ⭐ Go Master
              </a>
            )}
          </div>
        </div>

        {/* ── Actions list ── */}
        <div
          className="rounded-2xl overflow-hidden mb-3"
          style={{ border: '1px solid var(--border-color)' }}
        >
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-between px-4 py-4"
            style={{
              background:   'var(--bg-card)',
              borderBottom: '1px solid var(--border-color)',
              color:        'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-3">
              <Settings size={17} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
              <span className="text-sm font-medium">Settings</span>
            </div>
            <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
          </button>

          {isAdmin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between px-4 py-4"
              style={{ background: 'var(--bg-card)', color: 'var(--text-primary)' }}
            >
              <div className="flex items-center gap-3">
                <Crown size={17} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
                <span className="text-sm font-medium">Admin panel</span>
              </div>
              <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
            </button>
          )}
        </div>

        {/* ── Sign out ── */}
        <button
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-medium transition-all active:scale-[0.98]"
          style={{
            background: 'var(--bg-card)',
            color:      'var(--text-muted)',
            border:     '1px solid var(--border-color)',
          }}
        >
          <LogOut size={15} strokeWidth={1.5} />
          Sign out
        </button>

      </PageWrapper>

      {/* ── Credits modal ── */}
      <Modal isOpen={showCreditsModal} onClose={() => setShowCreditsModal(false)} title="Credits">
        <div style={{ padding: '0 2px' }}>
          <div style={{ borderTop: '1px solid var(--border-color)' }}>
            {packages.map((pkg) => (
              <PackageCard
                key={pkg.id}
                pkg={pkg}
                onSelect={handlePurchase}
                loading={purchaseLoading}
              />
            ))}
          </div>
        </div>
      </Modal>
    </>
  )
}
