import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import { useFriends } from '../hooks/useFriends'
import Avatar from '../components/Avatar'
import EmptyState from '../components/EmptyState'
import './FriendsPage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

export default function FriendsPage() {
  const { user } = useAuth()
  const { friends, incoming, outgoing, loading, sendRequest, respond } = useFriends()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const [pendingIds, setPendingIds] = useState(() => new Set())

  const knownIds = new Set([
    user?.id,
    ...friends.map((f) => f.profile?.id),
    ...incoming.map((f) => f.profile?.id),
    ...outgoing.map((f) => f.profile?.id),
  ])

  const runSearch = async (event) => {
    event.preventDefault()
    const q = query.trim()
    if (!q) {
      setResults([])
      return
    }
    setSearching(true)
    setSearchError(null)
    try {
      const [byUsername, byFirstName, byLastName] = await Promise.all([
        supabase.from('profiles').select('*').ilike('username', `%${q}%`).neq('id', user.id).limit(15),
        supabase.from('profiles').select('*').ilike('first_name', `%${q}%`).neq('id', user.id).limit(15),
        supabase.from('profiles').select('*').ilike('last_name', `%${q}%`).neq('id', user.id).limit(15),
      ])
      if (byUsername.error) throw byUsername.error
      if (byFirstName.error) throw byFirstName.error
      if (byLastName.error) throw byLastName.error

      const seen = new Set()
      let combined = [...(byUsername.data || []), ...(byFirstName.data || []), ...(byLastName.data || [])].filter(
        (p) => {
          if (seen.has(p.id)) return false
          seen.add(p.id)
          return true
        },
      )

      if (q.includes('@')) {
        const { data: byEmail } = await supabase.rpc('find_profile_by_email', { p_email: q })
        if (byEmail && byEmail.id !== user.id && !combined.some((p) => p.id === byEmail.id)) {
          combined = [...combined, byEmail]
        }
      }

      setResults(combined.filter((p) => !knownIds.has(p.id)))
    } catch (err) {
      setSearchError(err.message)
    } finally {
      setSearching(false)
    }
  }

  const handleSend = async (targetId) => {
    setPendingIds((prev) => new Set(prev).add(targetId))
    try {
      await sendRequest(targetId)
      setResults((prev) => prev.filter((p) => p.id !== targetId))
    } finally {
      setPendingIds((prev) => {
        const next = new Set(prev)
        next.delete(targetId)
        return next
      })
    }
  }

  return (
    <div className="friends-page">
      <form className="friends-search glass" onSubmit={runSearch}>
        <input
          type="text"
          className="input"
          placeholder="Cerca per nome, username o email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button type="submit" className="btn btn-primary" disabled={searching}>
          {searching ? '…' : 'Cerca'}
        </button>
      </form>

      {searchError && <div className="alert-error">{searchError}</div>}

      {results.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Risultati</h3>
          <div className="friends-list">
            {results.map((p) => (
              <div key={p.id} className="friend-row glass">
                <Avatar url={p.avatar_url} label={displayNameOf(p)} size={40} />
                <div className="friend-row-info">
                  <span className="friend-row-name">{displayNameOf(p)}</span>
                  <span className="friend-row-username">@{p.username}</span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary friend-row-action"
                  onClick={() => handleSend(p.id)}
                  disabled={pendingIds.has(p.id)}
                >
                  Aggiungi
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {incoming.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Richieste ricevute</h3>
          <div className="friends-list">
            {incoming.map(({ row, profile }) => (
              <div key={row.id} className="friend-row glass">
                <Avatar url={profile?.avatar_url} label={displayNameOf(profile)} size={40} />
                <div className="friend-row-info">
                  <span className="friend-row-name">{displayNameOf(profile)}</span>
                  <span className="friend-row-username">@{profile?.username}</span>
                </div>
                <div className="friend-row-actions">
                  <button type="button" className="btn btn-primary" onClick={() => respond(row.id, true)}>
                    Accetta
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={() => respond(row.id, false)}>
                    Rifiuta
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="friends-section">
          <h3 className="friends-section-title">Richieste inviate</h3>
          <div className="friends-list">
            {outgoing.map(({ row, profile }) => (
              <div key={row.id} className="friend-row glass">
                <Avatar url={profile?.avatar_url} label={displayNameOf(profile)} size={40} />
                <div className="friend-row-info">
                  <span className="friend-row-name">{displayNameOf(profile)}</span>
                  <span className="friend-row-username">@{profile?.username}</span>
                </div>
                <span className="friend-row-hint">In attesa…</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="friends-section">
        <h3 className="friends-section-title">I tuoi amici</h3>
        {!loading && friends.length === 0 && (
          <EmptyState
            title="Nessun amico ancora"
            description="Cerca qualcuno per username e mandagli una richiesta."
          />
        )}
        {friends.length > 0 && (
          <div className="friends-list">
            {friends.map(({ row, profile }) => (
              <Link key={row.id} to={`/u/${profile?.id}`} className="friend-row friend-row-link glass">
                <Avatar url={profile?.avatar_url} label={displayNameOf(profile)} size={40} />
                <div className="friend-row-info">
                  <span className="friend-row-name">{displayNameOf(profile)}</span>
                  <span className="friend-row-username">@{profile?.username}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
