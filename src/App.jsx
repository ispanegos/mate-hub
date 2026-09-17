import { Suspense, lazy } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from './components/AppShell'
import ProtectedRoute from './components/ProtectedRoute'
import PublicOnlyRoute from './components/PublicOnlyRoute'
import HomePage from './pages/HomePage'

const LoginPage = lazy(() => import('./pages/auth/LoginPage'))
const SignupPage = lazy(() => import('./pages/auth/SignupPage'))
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'))
const ResetPasswordPage = lazy(() => import('./pages/auth/ResetPasswordPage'))
const FriendsPage = lazy(() => import('./pages/FriendsPage'))
const ProfilePage = lazy(() => import('./pages/ProfilePage'))
const UserProfilePage = lazy(() => import('./pages/UserProfilePage'))
const NewConversationPage = lazy(() => import('./pages/NewConversationPage'))
const ChatRoomPage = lazy(() => import('./pages/chat/ChatRoomPage'))
const RateEventPage = lazy(() => import('./pages/events/RateEventPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))

function RouteFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '40vh',
        color: 'var(--ink-soft)',
        fontSize: 14,
      }}
    >
      Caricamento…
    </div>
  )
}

function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/friends" element={<FriendsPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/u/:userId" element={<UserProfilePage />} />
            <Route path="/new-conversation" element={<NewConversationPage />} />
            <Route path="/chat/:id" element={<ChatRoomPage />} />
            <Route path="/events/:eventId/rate" element={<RateEventPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

export default App
