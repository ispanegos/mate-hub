import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import { notifyUsers } from '../lib/notifications'
import { useConversations, conversationTitle } from '../hooks/useConversations'
import { useFriends } from '../hooks/useFriends'
import ConversationAvatar from '../components/ConversationAvatar'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import './HomePage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

const FILTERS = [
  { key: 'all', label: 'Tutti' },
  { key: 'group', label: 'Gruppi' },
  { key: 'direct', label: 'Chat singole' },
]

export default function HomePage() {
  const navigate = useNavigate()
  const { user, profile } = useAuth()
  const { items, loading, refresh } = useConversations()
  const { friends } = useFriends()
  const [busyId, setBusyId] = useState(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [startingWith, setStartingWith] = useState(null)

  const active = items.filter((r) => r.status === 'accepted')
  const invites = items.filter((r) => r.status === 'invited')

  const q = query.trim().toLowerCase()
  const matches = (r) => conversationTitle(r.conversation, r.otherProfile).toLowerCase().includes(q)
  const matchesFilter = (r) => filter === 'all' || r.conversation?.type === filter
  const filteredActive = active.filter(matchesFilter).filter((r) => !q || matches(r))
  const filteredInvites = invites.filter(matchesFilter).filter((r) => !q || matches(r))

  const directUserIds = new Set(
    items
      .filter((r) => r.conversation?.type === 'direct')
      .map((r) => r.otherProfile?.id)
      .filter(Boolean),
  )

  const friendsWithoutChat =
    filter === 'group'
      ? []
      : friends
          .filter(({ profile: p }) => p && !directUserIds.has(p.id))
          .filter(({ profile: p }) => !q || displayNameOf(p).toLowerCase().includes(q))

  const respondInvite = async (conversationId, accept) => {
    setBusyId(conversationId)
    try {
      const { error } = await supabase
        .from('conversation_members')
        .update({ status: accept ? 'accepted' : 'declined' })
        .eq('conversation_id', conversationId)
      if (error) throw error
      await refresh()
    } finally {
      setBusyId(null)
    }
  }

  const startDirectChat = async (friendId) => {
    setStartingWith(friendId)
    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({ type: 'direct', name: null, created_by: user.id })
        .select()
        .single()
      if (convErr) throw convErr

      const { error: selfErr } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: conv.id, user_id: user.id, status: 'accepted', invited_by: user.id })
      if (selfErr) throw selfErr

      const { error: memErr } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: conv.id, user_id: friendId, status: 'invited', invited_by: user.id })
      if (memErr) throw memErr

      const myName = profile?.first_name || profile?.username || 'Qualcuno'
      notifyUsers({
        userIds: [friendId],
        actorId: user.id,
        type: 'conversation_invite',
        title: 'Nuova chat',
        body: `${myName} ti ha aperto una chat`,
        link: '/',
        conversationId: conv.id,
      })

      navigate(`/chat/${conv.id}`)
    } catch {
      setStartingWith(null)
    }
  }

  const nothingToShow =
    !loading && active.length === 0 && invites.length === 0 && friends.length === 0 && filter === 'all' && !q

  if (nothingToShow) {
    return (
      <EmptyState
        title="Nessuna conversazione ancora"
        description="Le tue chat con amici e gruppi appariranno qui."
        action={
          <Link to="/new-conversation" className="btn btn-primary" style={{ marginTop: 8 }}>
            Nuovo gruppo
          </Link>
        }
      />
    )
  }

  return (
    <div className="home-page">
      <div className="home-header">
        <input
          type="text"
          className="input home-search-input"
          placeholder="Cerca una conversazione…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Link to="/new-conversation" className="btn btn-primary home-new-btn">
          Nuovo gruppo
        </Link>
      </div>

      <div className="home-filter-chips">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`home-filter-chip${filter === f.key ? ' is-active' : ''}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {filteredInvites.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Inviti</h3>
          <div className="conversation-list">
            {filteredInvites.map((r) => (
              <div key={r.conversation_id} className="conversation-row glass">
                <ConversationAvatar
                  conversation={r.conversation}
                  otherProfile={r.otherProfile}
                  label={conversationTitle(r.conversation, r.otherProfile)}
                  size={44}
                />
                <div className="conversation-row-info">
                  <span className="conversation-row-name">
                    {conversationTitle(r.conversation, r.otherProfile)}
                  </span>
                  <span className="conversation-row-hint">Ti hanno invitato</span>
                </div>
                <div className="conversation-row-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={busyId === r.conversation_id}
                    onClick={() => respondInvite(r.conversation_id, true)}
                  >
                    Accetta
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    disabled={busyId === r.conversation_id}
                    onClick={() => respondInvite(r.conversation_id, false)}
                  >
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {filteredActive.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Chat</h3>
          <div className="conversation-list">
            {filteredActive.map((r) => (
              <button
                key={r.conversation_id}
                type="button"
                className="conversation-row conversation-row-btn glass"
                onClick={() => navigate(`/chat/${r.conversation_id}`)}
              >
                <ConversationAvatar
                  conversation={r.conversation}
                  otherProfile={r.otherProfile}
                  label={conversationTitle(r.conversation, r.otherProfile)}
                  size={44}
                />
                <div className="conversation-row-info">
                  <span className="conversation-row-name">
                    {conversationTitle(r.conversation, r.otherProfile)}
                  </span>
                  <span className="conversation-row-hint">
                    {r.conversation?.type === 'direct' ? 'Chat 1 a 1' : 'Gruppo'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {filter !== 'group' && friendsWithoutChat.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Amici</h3>
          <div className="conversation-list">
            {friendsWithoutChat.map(({ profile: p }) => (
              <button
                key={p.id}
                type="button"
                className="conversation-row conversation-row-btn glass"
                disabled={startingWith === p.id}
                onClick={() => startDirectChat(p.id)}
              >
                <Avatar url={p.avatar_url} label={displayNameOf(p)} size={44} />
                <div className="conversation-row-info">
                  <span className="conversation-row-name">{displayNameOf(p)}</span>
                  <span className="conversation-row-hint">
                    {startingWith === p.id ? 'Apertura chat…' : 'Inizia una chat'}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </section>
      )}

      {q &&
        filteredActive.length === 0 &&
        filteredInvites.length === 0 &&
        friendsWithoutChat.length === 0 && (
          <p className="home-empty-hint">Nessun risultato per "{query.trim()}"</p>
        )}
    </div>
  )
}
