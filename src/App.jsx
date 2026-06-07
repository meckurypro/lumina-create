// src/App.jsx
//
// Routing only. Auth state and pending payment retry live in AuthContext.
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

import LandingPage              from '@/pages/LandingPage'
import AuthPage                 from '@/pages/AuthPage'
import ResetPasswordPage        from '@/pages/ResetPasswordPage'
import FeedPage                 from '@/pages/FeedPage'
import CreatePage               from '@/pages/CreatePage'
import CreateImagePage          from '@/pages/CreateImagePage'
import CreateVideoPage          from '@/pages/CreateVideoPage'
import CreateTalkingHeadPage    from '@/pages/CreateTalkingHeadPage'
import CinematicTransitionPage  from '@/pages/CinematicTransitionPage'
import CinematicResultPage      from '@/pages/CinematicResultPage'
import GeneratePage             from '@/pages/GeneratePage'
import ResultPage               from '@/pages/ResultPage'
import MediaPage                from '@/pages/MediaPage'
import ProfilePage              from '@/pages/ProfilePage'
import SettingsPage             from '@/pages/SettingsPage'
import AdminPage                from '@/pages/AdminPage'
import TemplateRunnerPage       from '@/pages/TemplateRunnerPage'
import AuthCallbackPage         from '@/pages/AuthCallbackPage'
import PaymentCallbackPage      from '@/pages/PaymentCallbackPage'
import CommunityFeedPage        from '@/pages/CommunityFeedPage'
import CreateCopyMotionPage     from '@/pages/CreateCopyMotionPage'
import CreateUGCPage            from '@/pages/CreateUGCPage'
import UGCWizardPage            from '@/pages/UGCWizardPage'
import UGCGeneratePage          from '@/pages/UGCGeneratePage'
import UGCMediaPage             from '@/pages/UGCMediaPage'
import UGCVoicesPage            from '@/pages/UGCVoicesPage'
import UGCVoiceGeneratePage     from '@/pages/UGCVoiceGeneratePage'
import CreatePhotoPolishPage    from '@/pages/CreatePhotoPolishPage'

import FilmaHubPage             from '@/pages/filma/FilmaHubPage'
import FilmaSetupPage           from '@/pages/filma/FilmaSetupPage'
import FilmaCastPage            from '@/pages/filma/FilmaCastPage'
import FilmaStructurePage       from '@/pages/filma/FilmaStructurePage'
import FilmaScenePage           from '@/pages/filma/FilmaScenePage'
import FilmaShotPage            from '@/pages/filma/FilmaShotPage'

import { BottomNav } from '@/components/layout/BottomNav'

const FullLoader = () => (
  <div className="min-h-dvh flex items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  </div>
)

function RequireAuth({ children }) {
  const { user, loading, onboardingNeeded } = useAuth()
  const location = useLocation()
  if (loading)          return <FullLoader />
  if (!user)            return <Navigate to="/auth" replace state={{ from: location }} />
  if (onboardingNeeded) return <Navigate to="/auth" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user, loading, onboardingNeeded, isAdmin } = useAuth()
  if (loading)          return <FullLoader />
  if (!user)            return <Navigate to="/auth" replace />
  if (onboardingNeeded) return <Navigate to="/auth" replace />
  if (!isAdmin)         return <Navigate to="/feed" replace />
  return children
}

const AppLayout = ({ children }) => (
  <div className="w-full min-h-dvh" style={{ background: 'var(--bg-primary)' }}>
    {children}
    <BottomNav />
  </div>
)

export default function App() {
  const { user, loading, onboardingNeeded } = useAuth()

  return (
    <Routes>
      <Route path="/auth/callback"  element={<AuthCallbackPage />} />
      <Route path="/payment/callback" element={<PaymentCallbackPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {loading ? (
        <Route path="*" element={<FullLoader />} />
      ) : (
        <>
          <Route
            path="/"
            element={user ? <Navigate to={onboardingNeeded ? '/auth' : '/feed'} replace /> : <LandingPage />}
          />
          <Route
            path="/auth"
            element={user && !onboardingNeeded ? <Navigate to="/feed" replace /> : <AuthPage />}
          />

          {/* ── Feed ─────────────────────────────────────────────── */}
          <Route path="/feed"           element={<RequireAuth><AppLayout><FeedPage /></AppLayout></RequireAuth>} />
          <Route path="/feed/community" element={<RequireAuth><AppLayout><CommunityFeedPage /></AppLayout></RequireAuth>} />

          {/* ── Create — base tools ──────────────────────────────── */}
          <Route path="/create"              element={<RequireAuth><AppLayout><CreatePage /></AppLayout></RequireAuth>} />
          <Route path="/create/image"        element={<RequireAuth><AppLayout><CreateImagePage /></AppLayout></RequireAuth>} />
          <Route path="/create/video"        element={<RequireAuth><AppLayout><CreateVideoPage /></AppLayout></RequireAuth>} />
          <Route path="/create/copy-motion"  element={<RequireAuth><AppLayout><CreateCopyMotionPage /></AppLayout></RequireAuth>} />
          <Route path="/create/talking-head" element={<RequireAuth><AppLayout><CreateTalkingHeadPage /></AppLayout></RequireAuth>} />
          <Route path="/create/photo-polish" element={<RequireAuth><AppLayout><CreatePhotoPolishPage /></AppLayout></RequireAuth>} />

          {/* ── Cinematic ────────────────────────────────────────── */}
          <Route path="/create/cinematic-transition" element={<RequireAuth><AppLayout><CinematicTransitionPage /></AppLayout></RequireAuth>} />
          <Route path="/cinematic/:projectId"        element={<RequireAuth><AppLayout><CinematicResultPage /></AppLayout></RequireAuth>} />

          {/* ── Filma — full-screen, no AppLayout/BottomNav ──────── */}
          <Route path="/filma"                        element={<RequireAuth><FilmaHubPage /></RequireAuth>} />
          <Route path="/filma/new"                    element={<RequireAuth><FilmaSetupPage /></RequireAuth>} />
          <Route path="/filma/:filmId/cast"           element={<RequireAuth><FilmaCastPage /></RequireAuth>} />
          <Route path="/filma/:filmId/structure"      element={<RequireAuth><FilmaStructurePage /></RequireAuth>} />
          <Route path="/filma/:filmId/scene/:sceneId" element={<RequireAuth><FilmaScenePage /></RequireAuth>} />
          <Route path="/filma/:filmId/shot/:shotId"   element={<RequireAuth><FilmaShotPage /></RequireAuth>} />

          {/* ── UGC ──────────────────────────────────────────────── */}
          <Route path="/create/ugc"                    element={<RequireAuth><AppLayout><CreateUGCPage /></AppLayout></RequireAuth>} />
          <Route path="/create/ugc/new"                element={<RequireAuth><AppLayout><UGCWizardPage /></AppLayout></RequireAuth>} />
          <Route path="/create/ugc/voices"             element={<RequireAuth><AppLayout><UGCVoicesPage /></AppLayout></RequireAuth>} />
          <Route path="/create/ugc/voice/:voiceId"     element={<RequireAuth><AppLayout><UGCVoiceGeneratePage /></AppLayout></RequireAuth>} />
          <Route path="/create/ugc/:profileId/media"   element={<RequireAuth><AppLayout><UGCMediaPage /></AppLayout></RequireAuth>} />
          <Route path="/create/ugc/:profileId"         element={<RequireAuth><AppLayout><UGCGeneratePage /></AppLayout></RequireAuth>} />

          {/* ── Generic template runner — MUST stay last ─────────── */}
          <Route path="/create/:templateSlug" element={<RequireAuth><AppLayout><TemplateRunnerPage /></AppLayout></RequireAuth>} />

          {/* ── Generate / Result ────────────────────────────────── */}
          <Route path="/generate"   element={<RequireAuth><AppLayout><GeneratePage /></AppLayout></RequireAuth>} />
          <Route path="/result/:id" element={<RequireAuth><AppLayout><ResultPage /></AppLayout></RequireAuth>} />

          {/* ── Media ────────────────────────────────────────────── */}
          <Route path="/media"   element={<RequireAuth><AppLayout><MediaPage /></AppLayout></RequireAuth>} />
          <Route path="/history" element={<Navigate to="/media" replace />} />

          {/* ── Profile / Settings / Admin ───────────────────────── */}
          <Route path="/profile"  element={<RequireAuth><AppLayout><ProfilePage /></AppLayout></RequireAuth>} />
          <Route path="/settings" element={<RequireAuth><AppLayout><SettingsPage /></AppLayout></RequireAuth>} />
          <Route path="/admin"    element={<RequireAdmin><AdminPage /></RequireAdmin>} />

          <Route
            path="*"
            element={<Navigate to={user ? (onboardingNeeded ? '/auth' : '/feed') : '/'} replace />}
          />
        </>
      )}
    </Routes>
  )
}
