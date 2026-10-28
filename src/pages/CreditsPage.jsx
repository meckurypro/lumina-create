// src/pages/CreditsPage.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { credits as creditsDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useMasterUpgrade } from '@/hooks/useMasterUpgrade'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

// ─── Credit package row ────────────────────────────────────

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

// ─── Billing Page ──────────────────────────────────────────

export default function BillingPage() {
  const { user, profile, credits }                       = useAuth()
  const { upgrade: upgradeToMaster, loading: upgrading }  = useMasterUpgrade()
  const [packages,        setPackages]        = useState([])
  const [purchaseLoading, setPurchaseLoading] = useState(false)

  useEffect(() => {
    creditsDb.getPackages().then(({ data }) => setPackages(data || []))
  }, [])

  const handlePurchase = async (pkg) => {
    if (!user?.email) { toast.error('Please log in to purchase credits'); return }
    setPurchaseLoading(true)
    try {
      const { initializePayment } = await import('@/lib/paystack')
      await initializePayment({
        email:       user.email,
        userId:      user.id,
        packageSlug: pkg.slug,
      })
    } catch (err) {
      console.error('Paystack error:', err)
      toast.error(err.message || 'Could not launch payment. Try again.')
      setPurchaseLoading(false)
    }
  }

  const isMaster      = profile?.user_tier === 'master'
  const daysRemaining = isMaster && profile?.tier_expires_at
    ? Math.max(0, Math.ceil((new Date(profile.tier_expires_at) - new Date()) / (1000 * 60 * 60 * 24)))
    : null

  return (
    <>
      <TopBar showBack title="Billing" showCredits />
      <PageWrapper>

        {/* ── Credits — what you spend to generate ── */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
            Credits
          </p>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={20} style={{ color: 'var(--text-primary)' }} fill="currentColor" />
            <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
              {Math.floor(credits)}
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--text-muted)' }}>
            Spent on every generation — image, video, lipsync, voice.
          </p>
          <div
            className="pt-3 flex items-center gap-3 text-xs"
            style={{ color: 'var(--text-muted)', borderTop: '1px solid var(--border-color)' }}
          >
            <span>Used: {profile?.total_credits_used?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Purchased: {profile?.total_credits_purchased?.toFixed(0) || 0}</span>
            <span>·</span>
            <span>Generations: {profile?.total_generations || 0}</span>
          </div>
        </div>

        <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
          Buy credits
        </p>
        <div
          className="rounded-2xl px-4 mb-6"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          {packages.map((pkg) => (
            <PackageCard
              key={pkg.id}
              pkg={pkg}
              onSelect={handlePurchase}
              loading={purchaseLoading}
            />
          ))}
        </div>

        {/* ── Master — optional extras, not a gate ── */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: isMaster ? 'rgba(245,158,11,0.06)' : 'var(--bg-card)',
            border:     `1px solid ${isMaster ? 'rgba(245,158,11,0.25)' : 'var(--border-color)'}`,
          }}
        >
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>Plan</p>
          <p className="text-lg font-black mb-1" style={{ color: isMaster ? '#f59e0b' : 'var(--text-primary)' }}>
            {isMaster ? '⭐ Master' : 'Free'}
          </p>

          {isMaster ? (
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {daysRemaining} days remaining
            </p>
          ) : (
            <>
              <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                Optional. Credits already get you generating — Master adds:
              </p>
              <div className="flex flex-col gap-2 mb-4">
                {[
                  { icon: '🤖', text: 'Premium models' },
                  { icon: '📁', text: 'Media never expires' },
                  { icon: '🎙️', text: 'Voice cloning for TTS' },
                  { icon: '🎬', text: 'Unlimited Copy Motion' },
                  { icon: '🧑‍🎤', text: 'Full UGC, no limits' },
                ].map(({ icon, text }) => (
                  <div key={text} className="flex items-center gap-2.5">
                    <span style={{ fontSize: 13 }}>{icon}</span>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{text}</p>
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

      </PageWrapper>
    </>
  )
}
