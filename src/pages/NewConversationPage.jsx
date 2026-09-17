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

  const [mode, setMode] = useState(null) // null | 'direct' | 'group'
  const [selected, setSelected] = useState(() => new Set())
  const [name, setName] = useState('')
  const [error, setError] = useState(null)
  const [creating, setCreating] = useState(false)

  const reset = () => {
    setMode(null)
    setSelected(new Set())
    setName('')
    setError(null)
  }

  const toggle = (id) => {
    setSelected((prev) => {
      if (mode === 'direct') return new Set([id])
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCreate = async () => {
    if (selected.size === 0) {
      setError('Seleziona almeno un amico')
      return
    }
    if (mode === 'group' && !name.trim()) {
      setError('Scegli un nome per il gruppo')
      return
    }
    setError(null)
    setCreating(true)
    try {
      const isDirect = mode === 'direct'
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({
          type: isDirect ? 'direct' : 'group',
          name: isDirect ? null : name.trim(),
          created_by: user.id,
        })
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
        title: isDirect ? 'Nuova chat' : 'Nuovo invito a un gruppo',
        body: isDirect ? `${myName} ti ha aperto una chat` : `${myName} ti ha invitato in "${name.trim()}"`,
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

  const showFriendPicker = mode === 'direct' || (mode === 'group' && name.trim().length > 0)

  return (
    <div className="new-conv-page">
      <div className="new-conv-card glass-strong">
        <h1 className="new-conv-title">Nuova conversazione</h1>

        {error && <div className="alert-error">{error}</div>}

        {mode === null && (
          <div className="new-conv-mode-choice">
            <button type="button" className="new-conv-mode-btn glass" onClick={() => setMode('direct')}>
              <span className="new-conv-mode-emoji">💬</span>
              <span>Chat 1 a 1</span>
            </button>
            <button type="button" className="new-conv-mode-btn glass" onClick={() => setMode('group')}>
              <span className="new-conv-mode-emoji">👥</span>
              <span>Gruppo</span>
            </button>
          </div>
        )}

        {mode !== null && (
          <button type="button" className="btn btn-ghost new-conv-back" onClick={reset}>
            ← Indietro
          </button>
        )}

        {mode === 'group' && (
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
        )}

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
