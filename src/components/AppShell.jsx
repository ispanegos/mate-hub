import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import NotificationBell from './NotificationBell'
import ThemeToggle from './ThemeToggle'
import Avatar from './Avatar'
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
            Mate HUB
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

      <main className="app-content">
        <Outlet />
      </main>
    </div>
  )
}
