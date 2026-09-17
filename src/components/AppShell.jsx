import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import NotificationBell from './NotificationBell'
import './AppShell.css'

const NAV_ITEMS = [
  { to: '/', label: 'Gruppi', icon: 'chat', end: true },
  { to: '/friends', label: 'Amici', icon: 'friends' },
]

function NavIcon({ name }) {
  switch (name) {
    case 'chat':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <path
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M4 5.5h16v10H9l-4 3.5v-3.5H4v-10Z"
          />
        </svg>
      )
    case 'friends':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
          <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7" />
          <path
            stroke="currentColor"
            strokeWidth="1.7"
            strokeLinecap="round"
            d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5M15.5 8.5a2.5 2.5 0 1 0 0-5M17 14.2c2 .3 3.5 2 3.5 4.3"
          />
        </svg>
      )
    default:
      return null
  }
}

export default function AppShell() {
  const { profile, user } = useAuth()
  const displayName = profile?.first_name || profile?.username || user?.email || 'Tu'

  return (
    <div className="app-shell">
      <main className="app-content">
        <Outlet />
      </main>

      <nav className="app-tabbar glass-strong">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `app-tab${isActive ? ' is-active' : ''}`}
          >
            <NavIcon name={item.icon} />
            <span>{item.label}</span>
          </NavLink>
        ))}

        <div className="app-tab-bell">
          <NotificationBell />
        </div>

        <NavLink
          to="/profile"
          className={({ isActive }) => `app-tab app-tab-avatar${isActive ? ' is-active' : ''}`}
          aria-label="Profilo"
        >
          <span className="app-tab-avatar-circle">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" />
            ) : (
              <span className="app-tab-avatar-fallback">{displayName.slice(0, 1).toUpperCase()}</span>
            )}
          </span>
        </NavLink>
      </nav>
    </div>
  )
}
