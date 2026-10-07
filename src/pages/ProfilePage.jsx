// src/pages/ProfilePage.jsx
import { useNavigate } from 'react-router-dom'
import { Settings, Wallet, LogOut, Crown, ChevronRight, Gift, MonitorPlay, MessageCircle, Sparkles } from 'lucide-react'
import { auth } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'

const NavRow = ({ icon: Icon, label, hint, onClick }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between px-4 py-4 text-left transition-colors hover:bg-[var(--bg-elevated)]"
    style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
    <div className="flex items-center gap-3 min-w-0">
      <span className="flex items-center justify-center rounded-xl flex-shrink-0" style={{ width: 36, height: 36, background: 'var(--brand-light)' }}>
        <Icon size={17} strokeWidth={1.7} style={{ color: 'var(--brand)' }} />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold">{label}</span>
        {hint && <span className="block text-xs truncate" style={{ color: 'var(--text-muted)' }}>{hint}</span>}
      </span>
    </div>
    <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
  </button>
)

const Stat = ({ label, value }) => (
  <div className="flex-1 rounded-2xl px-4 py-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
    <p className="text-lg font-black" style={{ fontFamily: 'Sora, Inter, sans-serif' }}>{value}</p>
    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</p>
  </div>
)

export default function ProfilePage() {
  const navigate = useNavigate()
  const { profile, isAdmin } = useAuth()
  const isMaster = profile?.user_tier === 'master'

  const handleSignOut = async () => { await auth.signOut(); navigate('/auth') }

  return (
    <>
      <TopBar showLogo showCredits />
      <PageWrapper>
        <div className="lg:max-w-2xl lg:mx-auto">
          {/* Header card */}
          <div className="relative overflow-hidden rounded-3xl p-5 mb-4 mt-2"
            style={{ background: 'radial-gradient(90% 140% at 100% 0%, var(--brand-light), transparent 60%), var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <div className="flex items-center gap-4">
              <div className="rounded-2xl p-[2px] flex-shrink-0" style={{ background: 'var(--gradient-brand)' }}>
                <div className="w-16 h-16 rounded-[14px] flex items-center justify-center text-2xl font-black" style={{ background: 'var(--bg-card)' }}>
                  {profile?.username?.[0]?.toUpperCase() || 'M'}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-xl font-black truncate">{profile?.display_name || profile?.username}</h2>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>@{profile?.username}</p>
                <span className="inline-flex items-center gap-1 mt-2 text-xs px-2.5 py-1 rounded-full font-bold"
                  style={{ background: isMaster ? 'rgba(245,158,11,0.14)' : 'var(--bg-elevated)', color: isMaster ? 'var(--gold)' : 'var(--text-muted)',
                    border: `1px solid ${isMaster ? 'rgba(245,158,11,0.35)' : 'var(--border-color)'}` }}>
                  {isMaster && <Crown size={12} />} {isMaster ? 'Master' : 'Free plan'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex gap-3 mb-4">
            <Stat label="Generations" value={profile?.total_generations || 0} />
            <Stat label="Plan" value={isMaster ? 'Master' : 'Free'} />
          </div>

          {!isMaster && (
            <button onClick={() => navigate('/billing')} className="w-full flex items-center justify-between rounded-2xl px-4 py-4 mb-4 text-left text-white"
              style={{ background: 'var(--gradient-brand)', boxShadow: 'var(--shadow-brand)' }}>
              <span className="flex items-center gap-3"><Sparkles size={18} /><span><span className="block text-sm font-bold">Go Master</span><span className="block text-xs opacity-80">Unlock premium models</span></span></span>
              <ChevronRight size={16} />
            </button>
          )}

          <div className="rounded-2xl overflow-hidden mb-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}>
            <NavRow icon={Wallet}      label="Billing"     hint="Credits and payments"   onClick={() => navigate('/billing')} />
            <NavRow icon={MonitorPlay} label="AI Sessions" hint="Render Window GPU time" onClick={() => navigate('/render-window')} />
            <NavRow icon={Gift}        label="Referrals"   hint="Earn credits"           onClick={() => navigate('/referrals')} />
            <NavRow icon={Settings}    label="Settings"    hint="Theme, models, account" onClick={() => navigate('/settings')} />
            {isAdmin && <NavRow icon={Crown} label="Admin panel" onClick={() => navigate('/admin')} />}
          </div>

          <button onClick={handleSignOut} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-semibold active:scale-[0.98] transition-transform"
            style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}>
            <LogOut size={15} strokeWidth={1.6} /> Sign out
          </button>

          <a href="https://wa.me/2348162465247?text=Hi%2C%20I%20need%20help%20with%20Meckury%20AI" target="_blank" rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-1.5 py-4 text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
            <MessageCircle size={13} strokeWidth={1.5} /> Need help? Chat with us
          </a>
        </div>
      </PageWrapper>
    </>
  )
}
