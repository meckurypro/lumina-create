import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'

// Pages — drop your page files into src/pages/ then uncomment.
import FeedPage from '@/pages/FeedPage'
import CreatePage from '@/pages/CreatePage'
import GeneratePage from '@/pages/GeneratePage'
import HistoryPage from '@/pages/HistoryPage'
import ProfilePage from '@/pages/ProfilePage'
import ResetPasswordPage from '@/pages/ResetPasswordPage'
// import TemplateRunner from '@/pages/TemplateRunner'
// import HistoryPage from '@/pages/HistoryPage'
// import ResultPage from '@/pages/ResultPage'
// import ProfilePage from '@/pages/ProfilePage'
// import SettingsPage from '@/pages/SettingsPage'
// import AdminPage from '@/pages/AdminPage'
// import AuthPage from '@/pages/AuthPage'

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ padding: 24 }}>Loading…</div>
  if (!user) return <Navigate to="/auth" replace />
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
      <Route path="/auth" element={<Placeholder name="AuthPage" />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/feed" element={<RequireAuth><FeedPage /></RequireAuth>} />
      <Route path="/create" element={<RequireAuth><CreatePage /></RequireAuth>} />
      <Route path="/generate" element={<RequireAuth><GeneratePage /></RequireAuth>} />
      <Route path="/create/:templateSlug" element={<RequireAuth><Placeholder name="TemplateRunner" /></RequireAuth>} />
      <Route path="/history" element={<RequireAuth><HistoryPage /></RequireAuth>} />
      <Route path="/result/:id" element={<RequireAuth><Placeholder name="ResultPage" /></RequireAuth>} />
      <Route path="/profile" element={<RequireAuth><ProfilePage /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Placeholder name="SettingsPage" /></RequireAuth>} />
      <Route path="/admin" element={<RequireAuth><Placeholder name="AdminPage" /></RequireAuth>} />
      <Route path="*" element={<div style={{ padding: 24 }}>404</div>} />
    </Routes>
  )
}
