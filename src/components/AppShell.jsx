import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import NotificationBell from './NotificationBell'
import Avatar from './Avatar'
import './AppShell.css'

export default function AppShell() {
  const { profile, user } = useAuth()
  const displayName = profile?.first_name || profile?.username || user?.email || 'Tu'

  return (
    <div className="app-shell">
      <header className="app-header glass-strong">
        <NavLink to="/" className="app-header-title" end>
          Mate HUB
        </NavLink>
        <div className="app-header-actions">
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
