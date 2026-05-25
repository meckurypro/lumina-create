// src/App.jsx
import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Pages
import LandingPage         from '@/pages/LandingPage'
import AuthPage            from '@/pages/AuthPage'
import ResetPasswordPage   from '@/pages/ResetPasswordPage'
import FeedPage            from '@/pages/FeedPage'
import CreatePage          from '@/pages/CreatePage'
import GeneratePage        from '@/pages/GeneratePage'
import ResultPage          from '@/pages/ResultPage'
import HistoryPage         from '@/pages/HistoryPage'
import ProfilePage         from '@/pages/ProfilePage'
import SettingsPage        from '@/pages/SettingsPage'
import AdminPage           from '@/pages/AdminPage'
import TemplateRunnerPage  from '@/pages/TemplateRunnerPage'
import AuthCallbackPage    from '@/pages/AuthCallbackPage'

// Layout
import { BottomNav } from '@/components/layout/BottomNav'

// ── Loader ─────────────────────────────────────────────────

const FullLoader = () => (
  <div
    className="min-h-dvh flex items-center justify-center"
    style={{ background: 'var(--bg-primary)' }}
  >
    <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading…</div>
  </div>
)

// ── Guards ─────────────────────────────────────────────────

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

// ── App layout ─────────────────────────────────────────────
// On mobile: constrained by page-container (480px centered)
// On desktop: full width, BottomNav hidden via lg:hidden in BottomNav

const AppLayout = ({ children }) => (
  <div
    className="w-full min-h-dvh"
    style={{ background: 'var(--bg-primary)' }}
  >
    {children}
    <BottomNav />
  </div>
)

// ── Routes ─────────────────────────────────────────────────

export default function App() {
  const { user, loading, onboardingNeeded } = useAuth()

  return (
    <Routes>

      {/* Auth callbacks — never blocked */}
      <Route path="/auth/callback"  element={<AuthCallbackPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />

      {loading ? (
        <Route path="*" element={<FullLoader />} />
      ) : (
        <>
          {/* Public */}
          <Route
            path="/"
            element={user ? <Navigate to={onboardingNeeded ? '/auth' : '/feed'} replace /> : <LandingPage />}
          />
          <Route
            path="/auth"
            element={user && !onboardingNeeded ? <Navigate to="/feed" replace /> : <AuthPage />}
          />

          {/* Protected */}
          <Route path="/feed" element={
            <RequireAuth><AppLayout><FeedPage /></AppLayout></RequireAuth>
          } />
          <Route path="/create" element={
            <RequireAuth><AppLayout><CreatePage /></AppLayout></RequireAuth>
          } />
          <Route path="/create/:templateSlug" element={
            <RequireAuth><AppLayout><TemplateRunnerPage /></AppLayout></RequireAuth>
          } />
          <Route path="/generate" element={
            <RequireAuth><AppLayout><GeneratePage /></AppLayout></RequireAuth>
          } />
          <Route path="/result/:id" element={
            <RequireAuth><AppLayout><ResultPage /></AppLayout></RequireAuth>
          } />
          <Route path="/history" element={
            <RequireAuth><AppLayout><HistoryPage /></AppLayout></RequireAuth>
          } />
          <Route path="/profile" element={
            <RequireAuth><AppLayout><ProfilePage /></AppLayout></RequireAuth>
          } />
          <Route path="/settings" element={
            <RequireAuth><AppLayout><SettingsPage /></AppLayout></RequireAuth>
          } />

          {/* Admin — no AppLayout */}
          <Route path="/admin" element={
            <RequireAdmin><AdminPage /></RequireAdmin>
          } />

          {/* Fallback */}
          <Route
            path="*"
            element={<Navigate to={user ? (onboardingNeeded ? '/auth' : '/feed') : '/'} replace />}
          />
        </>
      )}

    </Routes>
  )
}
