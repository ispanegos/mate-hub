import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../hooks/useNotifications'
import './NotificationBell.css'

const TYPE_ICON = {
  message: '💬',
  media: '🖼️',
  event_created: '📅',
  event_deleted: '🗑️',
  expense_new: '💸',
  friend_request: '🧑‍🤝‍🧑',
  friend_accept: '✅',
  stars_vote: '⭐',
  conversation_invite: '✉️',
}

function timeAgo(dateString) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'ora'
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}g`
  return new Date(dateString).toLocaleDateString('it-IT')
}

export default function NotificationBell() {
  const navigate = useNavigate()
  const { items, unreadCount, markRead, markAllRead } = useNotifications()
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClickOutside = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [open])

  const handleItemClick = (n) => {
    if (!n.read) markRead(n.id)
    setOpen(false)
    if (n.link) navigate(n.link)
  }

  return (
    <div className="notification-bell" ref={panelRef}>
      <button
        type="button"
        className={`notification-bell-btn${open ? ' is-active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifiche"
      >
        🔔
        {unreadCount > 0 && (
          <span className="notification-bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="notification-panel glass-strong">
          <div className="notification-panel-head">
            <span>Notifiche</span>
            {unreadCount > 0 && (
              <button type="button" className="notification-panel-mark-all" onClick={markAllRead}>
                Segna tutte come lette
              </button>
            )}
          </div>
          <div className="notification-panel-list">
            {items.length === 0 && <p className="notification-panel-empty">Nessuna notifica.</p>}
            {items.map((n) => (
              <button
                key={n.id}
                type="button"
                className={`notification-item${n.read ? '' : ' is-unread'}`}
                onClick={() => handleItemClick(n)}
              >
                <span className="notification-item-icon">{TYPE_ICON[n.type] || '🔔'}</span>
                <span className="notification-item-body">
                  <span className="notification-item-title">{n.title}</span>
                  {n.body && <span className="notification-item-text">{n.body}</span>}
                </span>
                <span className="notification-item-time">{timeAgo(n.created_at)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
