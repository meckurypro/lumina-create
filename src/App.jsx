import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Pages — drop your page files into src/pages/ then uncomment.
import FeedPage from '@/pages/FeedPage'
import CreatePage from '@/pages/CreatePage'
import GeneratePage from '@/pages/GeneratePage'
import HistoryPage from '@/pages/HistoryPage'
import ProfilePage from '@/pages/ProfilePage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
import SettingsPage from '@/pages/SettingsPage'
import AdminPage from '@/pages/AdminPage'
import ResultPage from '@/pages/ResultPage'
import AuthPage from '@/pages/AuthPage'
import TemplateRunnerPage from '@/pages/TemplateRunnerPage'

function RequireAuth({ children }) {
  const { user, loading, onboardingNeeded } = useAuth()
  const location = useLocation()
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!user) return <Navigate to="/auth" replace state={{ from: location }} />
  if (onboardingNeeded) return <Navigate to="/auth" replace />
  return children
}

function RequireAdmin({ children }) {
  const { user, loading, onboardingNeeded, isAdmin } = useAuth()
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!user) return <Navigate to="/auth" replace />
  if (onboardingNeeded) return <Navigate to="/auth" replace />
  if (!isAdmin) return <Navigate to="/feed" replace />
  return children
}

function Placeholder({ name }) {
  return (
    <div style={{ padding: 24 }}>
      <h1>{name}</h1>
      <p style={{ color: '#a3a3a3' }}>
        Drop your <code>{name}.jsx</code> into <code>src/pages/</code> and
        uncomment its import in <code>src/App.jsx</code>.
      </p>
    </div>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/feed" replace />} />
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/auth/callback" element={<Navigate to="/auth" replace />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/feed" element={<RequireAuth><FeedPage /></RequireAuth>} />
      <Route path="/create" element={<RequireAuth><CreatePage /></RequireAuth>} />
      <Route path="/generate" element={<RequireAuth><GeneratePage /></RequireAuth>} />
      <Route path="/create/:templateSlug" element={<RequireAuth><TemplateRunnerPage /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/result/:id" element={<RequireAuth><ResultPage /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><SettingsPage /></RequireAuth>} />
      <Route path="/admin" element={<RequireAdmin><AdminPage /></RequireAdmin>} />
      <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
    </Routes>
  )
}
