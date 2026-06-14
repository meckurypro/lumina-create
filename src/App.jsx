// src/App.jsx
//
// Routing only. Auth state and pending payment retry live in AuthContext.
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

import LandingPage              from '@/pages/LandingPage'
import AuthPage                 from '@/pages/AuthPage'
import ResetPasswordPage        from '@/pages/ResetPasswordPage'
import PrivacyPage              from '@/pages/PrivacyPage'
import TermsPage                from '@/pages/TermsPage'
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
import CreatePhotoPolishPage    from '@/pages/CreatePhotoPolishPage'
import ModelPreferencesPage     from '@/pages/ModelPreferencesPage'

// ── UGC ──────────────────────────────────────────────────────
import CreateUGCPage            from '@/pages/CreateUGCPage'
import UGCWizardPage            from '@/pages/UGCWizardPage'
import UGCGeneratePage          from '@/pages/UGCGeneratePage'
import UGCMediaPage             from '@/pages/UGCMediaPage'
import UGCVoiceGeneratePage     from '@/pages/UGCVoiceGeneratePage'
import UGCBrandWizardPage       from '@/pages/UGCBrandWizardPage'
import UGCBrandGeneratePage     from '@/pages/UGCBrandGeneratePage'
import UGCBrandMediaPage        from '@/pages/UGCBrandMediaPage'

// ── Filma ─────────────────────────────────────────────────────
import FilmaHubPage             from '@/pages/filma/FilmaHubPage'
import FilmaSetupPage           from '@/pages/filma/FilmaSetupPage'
import FilmaStorySummaryPage    from '@/pages/filma/FilmaStorySummaryPage'
import FilmaCastPage            from '@/pages/filma/FilmaCastPage'
import FilmaStructurePage       from '@/pages/filma/FilmaStructurePage'
import FilmaScenePage           from '@/pages/filma/FilmaScenePage'
import FilmaShotPage            from '@/pages/filma/FilmaShotPage'
import FilmaActorProfilePage    from '@/pages/filma/FilmaActorProfilePage'

import { BottomNav }    from '@/components/layout/BottomNav'
import PWAUpdateToast   from '@/components/PWAUpdateToast'

// ── Loaders / guards ──────────────────────────────────────────

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

// ── Layout wrapper (includes BottomNav) ───────────────────────

const AppLayout = ({ children }) => (
  <div className="w-full min-h-dvh" style={{ background: 'var(--bg-primary)' }}>
    {children}
    <BottomNav />
  </div>
)

// ── Shorthand wrappers ────────────────────────────────────────
// keeps route declarations concise

const Auth  = ({ children }) => <RequireAuth><AppLayout>{children}</AppLayout></RequireAuth>
const Admin = ({ children }) => <RequireAdmin>{children}</RequireAdmin>

// ─────────────────────────────────────────────────────────────

export default function App() {
  const { user, loading, onboardingNeeded } = useAuth()

  return (
    <>
      <Routes>

        {/* ── Public (no auth gate) ───────────────────────────── */}
        <Route path="/auth/callback"    element={<AuthCallbackPage />} />
        <Route path="/payment/callback" element={<PaymentCallbackPage />} />
        <Route path="/reset-password"   element={<ResetPasswordPage />} />
        <Route path="/privacy"          element={<PrivacyPage />} />
        <Route path="/terms"            element={<TermsPage />} />

        {loading ? (
          <Route path="*" element={<FullLoader />} />
        ) : (
          <>

            {/* ── Root / Auth ─────────────────────────────────── */}
            <Route
              path="/"
              element={user
                ? <Navigate to={onboardingNeeded ? '/auth' : '/feed'} replace />
                : <LandingPage />
              }
            />
            <Route
              path="/auth"
              element={user && !onboardingNeeded
                ? <Navigate to="/feed" replace />
                : <AuthPage />
              }
            />

            {/* ── Feed ────────────────────────────────────────── */}
            <Route path="/feed"           element={<Auth><FeedPage /></Auth>} />
            <Route path="/feed/community" element={<Auth><CommunityFeedPage /></Auth>} />

            {/* ── Create — base tools ─────────────────────────── */}
            <Route path="/create"              element={<Auth><CreatePage /></Auth>} />
            <Route path="/create/image"        element={<Auth><CreateImagePage /></Auth>} />
            <Route path="/create/video"        element={<Auth><CreateVideoPage /></Auth>} />
            <Route path="/create/copy-motion"  element={<Auth><CreateCopyMotionPage /></Auth>} />
            <Route path="/create/talking-head" element={<Auth><CreateTalkingHeadPage /></Auth>} />
            <Route path="/create/photo-polish" element={<Auth><CreatePhotoPolishPage /></Auth>} />

            {/* ── Cinematic ───────────────────────────────────── */}
            <Route path="/create/cinematic-transition" element={<Auth><CinematicTransitionPage />  </Auth>} />
            <Route path="/cinematic/:projectId"        element={<Auth><CinematicResultPage /></Auth>} />

            {/* ── Filma (full-screen — no AppLayout/BottomNav) ── */}
            <Route path="/filma"                        element={<RequireAuth><FilmaHubPage /></RequireAuth>} />
            <Route path="/filma/new"                    element={<RequireAuth><FilmaSetupPage /></RequireAuth>} />
            <Route path="/filma/:filmId/edit"           element={<RequireAuth><FilmaSetupPage /></RequireAuth>} />
            <Route path="/filma/:filmId/story-summary"  element={<RequireAuth><FilmaStorySummaryPage /></RequireAuth>} />
            <Route path="/filma/:filmId/actor/:actorId" element={<RequireAuth><FilmaActorProfilePage /></RequireAuth>} />
            <Route path="/filma/:filmId/cast"           element={<RequireAuth><FilmaCastPage /></RequireAuth>} />
            <Route path="/filma/:filmId/structure"      element={<RequireAuth><FilmaStructurePage /></RequireAuth>} />
            <Route path="/filma/:filmId/scene/:sceneId" element={<RequireAuth><FilmaScenePage /></RequireAuth>} />
            <Route path="/filma/:filmId/shot/:shotId"   element={<RequireAuth><FilmaShotPage /></RequireAuth>} />

            {/* ── UGC — hub ───────────────────────────────────── */}
            {/* Voices tab is now inline on CreateUGCPage.         */}
            {/* /create/ugc/voices redirects back with tab state.  */}
            <Route path="/create/ugc"
              element={<Auth><CreateUGCPage /></Auth>}
            />
            <Route path="/create/ugc/voices"
              element={<Navigate to="/create/ugc" replace state={{ tab: 'voices' }} />}
            />

            {/* ── UGC — Characters ────────────────────────────── */}
            <Route path="/create/ugc/new"
              element={<Auth><UGCWizardPage /></Auth>}
            />
            <Route path="/create/ugc/:profileId"
              element={<Auth><UGCGeneratePage /></Auth>}
            />
            <Route path="/create/ugc/:profileId/media"
              element={<Auth><UGCMediaPage /></Auth>}
            />

            {/* ── UGC — Voices ────────────────────────────────── */}
            <Route path="/create/ugc/voice/:voiceId"
              element={<Auth><UGCVoiceGeneratePage /></Auth>}
            />

            {/* ── UGC — Brands ────────────────────────────────── */}
            <Route path="/create/ugc/brand/new"
              element={<Auth><UGCBrandWizardPage /></Auth>}
            />
            <Route path="/create/ugc/brand/:brandId"
              element={<Auth><UGCBrandGeneratePage /></Auth>}
            />
            <Route path="/create/ugc/brand/:brandId/media"
              element={<Auth><UGCBrandMediaPage /></Auth>}
            />

            {/* ── Generic template runner ──────────────────────── */}
            {/* MUST stay last inside /create/* to avoid swallowing */}
            {/* the specific routes above.                          */}
            <Route path="/create/:templateSlug"
              element={<Auth><TemplateRunnerPage /></Auth>}
            />

            {/* ── Generate / Result ───────────────────────────── */}
            <Route path="/generate"   element={<Auth><GeneratePage /></Auth>} />
            <Route path="/result/:id" element={<Auth><ResultPage /></Auth>} />

            {/* ── Media ───────────────────────────────────────── */}
            <Route path="/media"   element={<Auth><MediaPage /></Auth>} />
            <Route path="/history" element={<Navigate to="/media" replace />} />

            {/* ── Profile / Settings / Admin ──────────────────── */}
            <Route path="/profile"  element={<Auth><ProfilePage /></Auth>} />
            <Route path="/settings" element={<Auth><SettingsPage /></Auth>} />
            <Route path="/settings/models" element={<Auth><ModelPreferencesPage /></Auth>} />
            <Route path="/admin"    element={<Admin><AdminPage /></Admin>} />

            {/* ── Fallback ────────────────────────────────────── */}
            <Route
              path="*"
              element={<Navigate to={user ? (onboardingNeeded ? '/auth' : '/feed') : '/'} replace />}
            />

          </>
        )}
      </Routes>

      {/* PWA update banner — shown when a new version deploys */}
      <PWAUpdateToast />
    </>
  )
}
