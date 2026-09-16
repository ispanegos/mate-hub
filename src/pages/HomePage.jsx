import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useConversations, conversationTitle } from '../hooks/useConversations'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import './HomePage.css'

export default function HomePage() {
  const navigate = useNavigate()
  const { items, loading, refresh } = useConversations()
  const [busyId, setBusyId] = useState(null)
  const [query, setQuery] = useState('')

  const active = items.filter((r) => r.status === 'accepted')
  const invites = items.filter((r) => r.status === 'invited')

  const q = query.trim().toLowerCase()
  const matches = (r) => conversationTitle(r.conversation, r.otherProfile).toLowerCase().includes(q)
  const filteredActive = q ? active.filter(matches) : active
  const filteredInvites = q ? invites.filter(matches) : invites

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

  if (!loading && active.length === 0 && invites.length === 0) {
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

      {filteredInvites.length > 0 && (
        <section className="home-section">
          <h3 className="home-section-title">Inviti</h3>
          <div className="conversation-list">
            {filteredInvites.map((r) => (
              <div key={r.conversation_id} className="conversation-row glass">
                <Avatar
                  url={r.otherProfile?.avatar_url}
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
                <Avatar
                  url={r.otherProfile?.avatar_url}
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

      {q && filteredActive.length === 0 && filteredInvites.length === 0 && (
        <p className="home-empty-hint">Nessun risultato per "{query.trim()}"</p>
      )}
    </div>
  )
}
