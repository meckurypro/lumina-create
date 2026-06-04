// src/pages/ProfilePage.jsx
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Settings, Zap, Plus, LogOut, Crown, ChevronRight, Gift, Copy, Check, Share2 } from 'lucide-react'
import { credits as creditsDb, auth, supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useMasterUpgrade } from '@/hooks/useMasterUpgrade'
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

// ─── Referral Card ────────────────────────────────────────

const ReferralCard = ({ profile }) => {
  const [copied, setCopied]   = useState(false)
  const [stats,  setStats]    = useState(null)

  const referralCode = profile?.referral_code
  const referralLink = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : null

  useEffect(() => {
    if (!profile?.id) return
    supabase
      .from('referral_stats')
      .select('*')
      .eq('user_id', profile.id)
      .maybeSingle()
      .then(({ data }) => setStats(data))
  }, [profile?.id])

  const handleCopy = async () => {
    if (!referralLink) return
    await navigator.clipboard.writeText(referralLink)
    setCopied(true)
    toast.success('Link copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsApp = () => {
    if (!referralLink) return
    const text = encodeURIComponent(
      `🎬 I've been using Meckury AI to create insane AI videos — try it!\n\n${referralLink}`
    )
    window.open(`https://wa.me/?text=${text}`, '_blank')
  }

  const handleNativeShare = async () => {
    if (!referralLink) return
    if (navigator.share) {
      await navigator.share({
        title: 'Join me on Meckury AI',
        text:  'Create insane AI videos. Use my referral link:',
        url:   referralLink,
      })
    } else {
      handleCopy()
    }
  }

  return (
    <div
      className="rounded-2xl p-5 mb-3"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
    >
      <div className="flex items-center gap-2 mb-4">
        <Gift size={15} style={{ color: 'var(--text-muted)' }} />
        <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          Refer &amp; Earn
        </p>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-4 mb-4">
        <div>
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            {stats?.converted_referrals ?? 0}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>converted</p>
        </div>
        <div className="w-px h-8 self-center" style={{ background: 'var(--border-color)' }} />
        <div>
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            {stats?.total_referrals ?? 0}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>total</p>
        </div>
        <div className="w-px h-8 self-center" style={{ background: 'var(--border-color)' }} />
        <div>
          <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
            {stats?.total_commission_earned ?? 0}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>credits earned</p>
        </div>
      </div>

      {/* Copyable link */}
      <div
        className="flex items-center gap-2 rounded-xl px-3 py-2.5 mb-3"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-color)' }}
      >
        <p className="flex-1 text-xs font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
          {referralLink ?? '—'}
        </p>
        <button
          onClick={handleCopy}
          className="flex-shrink-0 transition-all active:scale-90"
          aria-label="Copy referral link"
        >
          {copied
            ? <Check size={14} style={{ color: 'var(--brand)' }} />
            : <Copy size={14} style={{ color: 'var(--text-muted)' }} />
          }
        </button>
      </div>

      {/* Share buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleWhatsApp}
          className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
          style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
        >
          {/* WhatsApp SVG icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          WhatsApp
        </button>

        <button
          onClick={handleNativeShare}
          className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
          style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
          aria-label="Share"
        >
          <Share2 size={13} />
          Share
        </button>
      </div>

      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>
        You earn 500 credits + 4% of every purchase they make.
      </p>
    </div>
  )
}

// ─── Profile Page ─────────────────────────────────────────

export default function ProfilePage() {
  const navigate                                                  = useNavigate()
  const { user, profile, credits, refreshProfile, isAdmin }      = useAuth()
  const { upgrade: upgradeToMaster, loading: upgrading, price: masterPrice } = useMasterUpgrade()

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
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Your plan</p>
          <p className="text-lg font-black mb-1" style={{ color: isMaster ? '#f59e0b' : 'var(--text-primary)' }}>
            {isMaster ? '⭐ Master' : 'Novice'}
          </p>
          {isMaster && daysRemaining !== null && (
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
              {daysRemaining} days remaining
            </p>
          )}

          {!isMaster && (
            <>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Upgrade to unlock everything:
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {[
                  { icon: '🤖', text: 'Access to all models, including premium ones' },
                  { icon: '📁', text: 'Your generated media never expires' },
                  { icon: '🎙️', text: 'Clone your voice and use it as TTS' },
                  { icon: '🎬', text: 'Unlimited Copy Motion (use your credits freely)' },
                  { icon: '🧑‍🎤', text: 'Full UGC — unlimited characters and features' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-start gap-2.5">
                    <span style={{ fontSize: 13, lineHeight: '18px', flexShrink: 0 }}>{icon}</span>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)', lineHeight: 1.55 }}>{text}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={upgradeToMaster}
                disabled={upgrading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
                style={{
                  background: upgrading ? 'rgba(245,158,11,0.08)' : 'rgba(245,158,11,0.12)',
                  color:      '#f59e0b',
                  border:     '1px solid rgba(245,158,11,0.3)',
                  opacity:    upgrading ? 0.7 : 1,
                }}
              >
                ⭐ {upgrading ? 'Opening…' : 'Upgrade to Master · ₦5,000/mo'}
              </button>
            </>
          )}
        </div>

        {/* ── Referral card ── */}
        <ReferralCard profile={profile} />

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
