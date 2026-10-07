// src/pages/ReferralsPage.jsx
import { useState, useEffect } from 'react'
import { Gift, Copy, Check, Share2, MessageCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'
import toast from 'react-hot-toast'

const RW_SELLER_WHATSAPP = '2348162465247'

export default function ReferralsPage() {
  const { profile } = useAuth()
  const [copied, setCopied] = useState(false)
  const [stats,  setStats]  = useState(null)

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

  const handleRwSellerInquiry = () => {
    const text = encodeURIComponent(
      "Hi, I'd like to become an RW Seller on Meckury AI — can you help me get set up?"
    )
    window.open(`https://wa.me/${RW_SELLER_WHATSAPP}?text=${text}`, '_blank')
  }

  return (
    <>
      <TopBar showBack title="Referrals" showCredits />
      <PageWrapper>

        <div
          className="rounded-3xl p-5 mb-3"
          style={{ background: 'radial-gradient(90% 120% at 100% 0%, var(--brand-light), transparent 60%), var(--bg-card)', border: '1px solid var(--border-color)' }}
        >
          <div className="flex items-center gap-2 mb-4">
            <Gift size={15} style={{ color: 'var(--text-muted)' }} />
            <p className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
              Refer &amp; Earn
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats?.converted_referrals ?? 0}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>converted</p>
            </div>
            <div className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats?.total_referrals ?? 0}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>total</p>
            </div>
            <div className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-elevated)' }}>
              <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
                {stats?.total_commission_earned ?? 0}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>credits earned</p>
            </div>
          </div>

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

          <div className="flex gap-2">
            <button
              onClick={handleWhatsApp}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all active:scale-[0.98]"
              style={{ background: 'rgba(37,211,102,0.14)', color: '#25d366', border: '1px solid rgba(37,211,102,0.3)' }}
            >
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
            You earn 500 credits + 4% of every credit purchase they make.
          </p>
        </div>

        {/* ── RW Seller inquiry CTA ── */}
        {!profile?.is_rw_seller && (
          <div
            className="rounded-2xl p-5"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
          >
            <p className="text-sm font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
              Want to sell Team access?
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>
              RW Sellers can offer Render Window Team subscriptions to their community.
            </p>
            <button
              onClick={handleRwSellerInquiry}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all active:scale-[0.98]"
              style={{ background: 'rgba(37,211,102,0.12)', color: '#25d366', border: '1px solid rgba(37,211,102,0.25)' }}
            >
              <MessageCircle size={15} />
              Contact us on WhatsApp
            </button>
          </div>
        )}

      </PageWrapper>
    </>
  )
}
