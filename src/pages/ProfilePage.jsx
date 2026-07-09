// src/pages/ProfilePage.jsx
import { useNavigate } from 'react-router-dom'
import { Settings, Zap, LogOut, Crown, ChevronRight, Gift, MonitorPlay, MessageCircle } from 'lucide-react'
import { auth } from '@/lib/supabase'
import { useAuth } from '@/context/AuthContext'
import { useMasterUpgrade } from '@/hooks/useMasterUpgrade'
import { TopBar } from '@/components/layout/TopBar'
import { PageWrapper } from '@/components/layout/PageWrapper'

// ─── Nav Row ───────────────────────────────────────────────

const NavRow = ({ icon: Icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center justify-between px-4 py-4"
    style={{
      background:   'var(--bg-card)',
      borderBottom: '1px solid var(--border-color)',
      color:        'var(--text-primary)',
    }}
  >
    <div className="flex items-center gap-3">
      <Icon size={17} strokeWidth={1.5} style={{ color: 'var(--text-muted)' }} />
      <span className="text-sm font-medium">{label}</span>
    </div>
    <ChevronRight size={15} style={{ color: 'var(--text-muted)' }} />
  </button>
)

// ─── Profile Page ─────────────────────────────────────────

export default function ProfilePage() {
  const navigate                                          = useNavigate()
  const { profile, isAdmin }                              = useAuth()
  const { upgrade: upgradeToMaster, loading: upgrading }   = useMasterUpgrade()

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

        {/* ── Tier card (Master upgrade) ── */}
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

        {/* ── Navigation list ── */}
        <div
          className="rounded-2xl overflow-hidden mb-3"
          style={{ border: '1px solid var(--border-color)' }}
        >
          <NavRow icon={Zap}         label="Credits"       onClick={() => navigate('/credits')} />
          <NavRow icon={MonitorPlay} label="AI Sessions"   onClick={() => navigate('/render-window')} />
          <NavRow icon={Gift}        label="Referrals"     onClick={() => navigate('/referrals')} />
          <NavRow icon={Settings}    label="Settings"      onClick={() => navigate('/settings')} />
          {isAdmin && (
            <NavRow icon={Crown} label="Admin panel" onClick={() => navigate('/admin')} />
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

        {/* ── Support ── */}
        <a
          href="https://wa.me/2348162465247?text=Hi%2C%20I%20need%20help%20with%20Meckury%20AI"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-1.5 py-4 text-xs font-medium"
          style={{ color: 'var(--text-muted)' }}
        >
          <MessageCircle size={13} strokeWidth={1.5} />
          Need help? Chat with us
        </a>

      </PageWrapper>
    </>
  )
}
