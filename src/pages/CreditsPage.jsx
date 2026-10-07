// src/pages/CreditsPage.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap, Check, Crown, Sparkles } from 'lucide-react'
import { credits as creditsDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useMasterUpgrade } from '@/hooks/useMasterUpgrade'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

// ─── Credit package card ───────────────────────────────────

const PackageCard = ({ pkg, onSelect, loading, best }) => {
  const total = (pkg.credits || 0) + (pkg.bonus_credits || 0)
  return (
    <motion.button
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(pkg)}
      disabled={loading}
      className="relative w-full text-left rounded-2xl p-4 transition-all hover:-translate-y-0.5"
      style={{
        background: best ? 'radial-gradient(120% 90% at 100% 0%, var(--brand-light), transparent 65%), var(--bg-card)' : 'var(--bg-card)',
        border: `1px solid ${best ? 'var(--brand)' : 'var(--border-color)'}`,
        boxShadow: best ? 'var(--shadow-brand)' : 'none',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.5 : 1,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      {best && (
        <span className="absolute -top-2.5 left-4 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full text-white"
          style={{ background: 'var(--gradient-brand)' }}>Best value</span>
      )}
      <p className="text-xs font-semibold mb-2" style={{ color: 'var(--text-muted)' }}>{pkg.name}</p>
      <div className="flex items-baseline gap-1.5 mb-1">
        <Zap size={16} fill="currentColor" style={{ color: 'var(--brand)' }} />
        <span className="text-2xl font-black" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{total.toLocaleString()}</span>
        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>credits</span>
      </div>
      {pkg.bonus_credits > 0 && (
        <p className="text-xs font-semibold mb-2" style={{ color: 'var(--tool-motion)' }}>incl. {pkg.bonus_credits} bonus</p>
      )}
      <p className="text-base font-bold mt-2">₦{pkg.price_ngn?.toLocaleString()}</p>
    </motion.button>
  )
}

const MASTER_PERKS = ['Premium models', 'Media never expires', 'Voice cloning for TTS', 'Unlimited Copy Motion', 'Full UGC, no limits']

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
      await initializePayment({ email: user.email, userId: user.id, packageSlug: pkg.slug })
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

  // Best value = lowest naira per credit (bonus included)
  const bestId = packages.length > 1
    ? packages.reduce((a, b) => (a.price_ngn / ((a.credits || 0) + (a.bonus_credits || 0) || 1) <= b.price_ngn / ((b.credits || 0) + (b.bonus_credits || 0) || 1) ? a : b)).id
    : null

  return (
    <>
      <TopBar showBack title="Billing" showCredits />
      <PageWrapper>
        <div className="grid lg:grid-cols-[380px_1fr] gap-6 items-start">

          {/* Left: balance + plan */}
          <div className="flex flex-col gap-4">
            <div className="relative overflow-hidden rounded-3xl p-6"
              style={{ background: 'radial-gradient(90% 120% at 100% 0%, var(--brand-light), transparent 60%), radial-gradient(70% 90% at 0% 100%, color-mix(in srgb, var(--gold) 12%, transparent), transparent 60%), var(--bg-card)', border: '1px solid var(--border-color)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)' }}>Your balance</p>
              <div className="flex items-center gap-2.5 mb-2">
                <Zap size={26} fill="currentColor" style={{ color: 'var(--brand)' }} />
                <span className="text-5xl font-black" style={{ fontFamily: 'Sora, Inter, sans-serif', letterSpacing: '-0.04em' }}>{Math.floor(credits)}</span>
              </div>
              <p className="text-xs mb-5" style={{ color: 'var(--text-muted)' }}>Spent on every generation: image, video, lipsync, voice.</p>
              <div className="grid grid-cols-3 gap-2">
                {[['Used', profile?.total_credits_used], ['Purchased', profile?.total_credits_purchased], ['Generations', profile?.total_generations]].map(([k, v]) => (
                  <div key={k} className="rounded-xl px-3 py-2.5" style={{ background: 'var(--bg-elevated)' }}>
                    <p className="text-sm font-bold">{Number(v || 0).toFixed(0)}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{k}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Master */}
            <div className="rounded-3xl p-5"
              style={{
                background: isMaster ? 'radial-gradient(100% 120% at 100% 0%, rgba(245,184,61,0.14), transparent 60%), var(--bg-card)' : 'var(--bg-card)',
                border: `1px solid ${isMaster ? 'rgba(245,184,61,0.35)' : 'var(--border-color)'}`,
              }}>
              <div className="flex items-center gap-2 mb-1">
                <Crown size={16} style={{ color: 'var(--gold)' }} />
                <p className="text-lg font-black" style={{ color: isMaster ? 'var(--gold)' : 'var(--text-primary)', fontFamily: 'Sora, Inter, sans-serif' }}>
                  {isMaster ? 'Master' : 'Free plan'}
                </p>
              </div>
              {isMaster ? (
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{daysRemaining} days remaining</p>
              ) : (
                <>
                  <p className="text-xs mb-4" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    Optional. Credits already get you generating. Master adds:
                  </p>
                  <ul className="flex flex-col gap-2.5 mb-5">
                    {MASTER_PERKS.map((t) => (
                      <li key={t} className="flex items-center gap-2.5 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span className="flex items-center justify-center rounded-full flex-shrink-0" style={{ width: 18, height: 18, background: 'rgba(245,184,61,0.16)' }}>
                          <Check size={11} strokeWidth={3} style={{ color: 'var(--gold)' }} />
                        </span>
                        {t}
                      </li>
                    ))}
                  </ul>
                  <button onClick={upgradeToMaster} disabled={upgrading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl text-sm font-bold transition-all active:scale-[0.98]"
                    style={{ background: 'linear-gradient(135deg, #F5B83D, #E8903A)', color: '#1a1200', opacity: upgrading ? 0.7 : 1, boxShadow: '0 12px 30px -16px rgba(245,184,61,0.7)' }}>
                    <Sparkles size={15} /> {upgrading ? 'Opening…' : 'Upgrade to Master · ₦5,000/mo'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right: packages */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest mb-4 px-1" style={{ color: 'var(--text-muted)' }}>Buy credits</p>
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4 pt-2">
              {packages.map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} onSelect={handlePurchase} loading={purchaseLoading} best={pkg.id === bestId} />
              ))}
            </div>
            <p className="text-xs mt-5 px-1" style={{ color: 'var(--text-muted)' }}>
              Payments are processed securely by Paystack. Credits for failed generations are refunded automatically.
            </p>
          </div>
        </div>
      </PageWrapper>
    </>
  )
}
