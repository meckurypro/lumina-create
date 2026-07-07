// src/pages/CreditsPage.jsx
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Zap } from 'lucide-react'
import { credits as creditsDb } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

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

export default function CreditsPage() {
  const { user, profile, credits } = useAuth()
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

  return (
    <>
      <TopBar showBack title="Credits" showCredits />
      <PageWrapper>

        <div
          className="rounded-2xl p-5 mb-4"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <p className="text-xs font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
            Available credits
          </p>
          <div className="flex items-center gap-2">
            <Zap size={20} style={{ color: 'var(--text-primary)' }} fill="currentColor" />
            <span className="text-3xl font-black" style={{ color: 'var(--text-primary)' }}>
              {Math.floor(credits)}
            </span>
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

        <p className="text-xs font-bold uppercase tracking-wide mb-2 px-1" style={{ color: 'var(--text-muted)' }}>
          Buy credits
        </p>
        <div
          className="rounded-2xl px-4"
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

      </PageWrapper>
    </>
  )
}
