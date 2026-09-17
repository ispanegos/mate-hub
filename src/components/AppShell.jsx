import { useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Avatar from './Avatar'
import OnboardingTour from './OnboardingTour'
import './AppShell.css'

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 5.5 8 12l7 6.5"
      />
    </svg>
  )
}

export default function AppShell() {
  const { profile, user } = useAuth()
  const displayName = profile?.first_name || profile?.username || user?.email || 'Tu'
  const location = useLocation()
  const navigate = useNavigate()
  const isHome = location.pathname === '/'
  const isOnline = useOnlineStatus()
  const [onboardingOpen, setOnboardingOpen] = useState(false)
  const [headerTitle, setHeaderTitle] = useState(null)

  return (
    <div className="app-shell">
      <header className="app-header glass-strong">
        <div className="app-header-left">
          {!isHome && (
            <button
              type="button"
              className="app-header-back"
              onClick={() => navigate(-1)}
              aria-label="Indietro"
            >
              <BackIcon />
            </button>
          )}
          <NavLink to="/" className="app-header-title" end>
            {headerTitle || 'Mate HUB'}
          </NavLink>
        </div>
        <div className="app-header-actions">
          <ThemeToggle />
          <NotificationBell />
          <NavLink to="/profile" className="app-header-avatar" aria-label="Profilo">
            <Avatar url={profile?.avatar_url} label={displayName} size={34} />
          </NavLink>
        </div>
      </header>

      {!isOnline && <div className="app-offline-banner">Sei offline — alcune azioni non funzioneranno.</div>}

      <main className="app-content">
        <Outlet context={{ reopenOnboarding: () => setOnboardingOpen(true), setHeaderTitle }} />
      </main>

      <OnboardingTour forceOpen={onboardingOpen} onClose={() => setOnboardingOpen(false)} />
    </div>
  )
}
