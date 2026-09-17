import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useFriends } from '../hooks/useFriends'
import { supabase } from '../lib/supabase'
import { notifyUsers } from '../lib/notifications'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import './NewConversationPage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

export default function NewConversationPage() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const { friends, loading } = useFriends()

  const [selected, setSelected] = useState(() => new Set())
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Scegli un nome per il gruppo')
      return
    }
    if (selected.size === 0) {
      setError('Seleziona almeno un amico')
      return
    }
    setError(null)
    setCreating(true)
    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({ type: 'group', name: name.trim(), created_by: user.id })
        .select()
        .single()
      if (convErr) throw convErr

      // riga del creatore prima e separata: le policy degli invitati verificano
      // che il creatore sia già membro accettato, quindi questa riga deve
      // essere committata prima dell'insert successivo (non in batch).
      const { error: selfErr } = await supabase
        .from('conversation_members')
        .insert({ conversation_id: conv.id, user_id: user.id, status: 'accepted', invited_by: user.id })
      if (selfErr) throw selfErr

      const inviteRows = Array.from(selected).map((id) => ({
        conversation_id: conv.id,
        user_id: id,
        status: 'invited',
        invited_by: user.id,
      }))
      const { error: memErr } = await supabase.from('conversation_members').insert(inviteRows)
      if (memErr) throw memErr

      const myName = profile?.first_name || profile?.username || 'Qualcuno'
      notifyUsers({
        userIds: Array.from(selected),
        actorId: user.id,
        type: 'conversation_invite',
        title: 'Nuovo invito a un gruppo',
        body: `${myName} ti ha invitato in "${name.trim()}"`,
        link: '/',
        conversationId: conv.id,
      })

      navigate(`/chat/${conv.id}`, { replace: true })
    } catch (err) {
      setError(err.message || 'Creazione non riuscita')
    } finally {
      setCreating(false)
    }
  }

  const showFriendPicker = name.trim().length > 0

  return (
    <div className="new-conv-page">
      <div className="new-conv-card glass-strong">
        <h1 className="new-conv-title">Nuovo gruppo</h1>

        {error && <div className="alert-error">{error}</div>}

        <div className="field">
          <label htmlFor="group-name">Nome del gruppo</label>
          <input
            id="group-name"
            type="text"
            className="input"
            placeholder="Es. Weekend in montagna"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {showFriendPicker && !loading && friends.length === 0 && (
          <EmptyState
            title="Nessun amico da invitare"
            description="Aggiungi prima qualche amico dalla sezione Amici."
          />
        )}

        {showFriendPicker && friends.length > 0 && (
          <div className="new-conv-friends">
            {friends.map(({ row, profile }) => {
              const isSelected = selected.has(profile?.id)
              return (
                <button
                  key={row.id}
                  type="button"
                  className={`new-conv-friend glass${isSelected ? ' is-selected' : ''}`}
                  onClick={() => toggle(profile?.id)}
                >
                  <Avatar url={profile?.avatar_url} label={displayNameOf(profile)} size={40} />
                  <span className="new-conv-friend-name">{displayNameOf(profile)}</span>
                  <span className="new-conv-friend-check" aria-hidden="true">
                    {isSelected ? '✓' : ''}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        {showFriendPicker && (
          <button
            type="button"
            className="btn btn-primary btn-block"
            disabled={creating || selected.size === 0}
            onClick={handleCreate}
          >
            {creating ? 'Creazione…' : 'Crea e invita'}
          </button>
        )}
      </div>
    </div>
  )
}
