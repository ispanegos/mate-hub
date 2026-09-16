import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Avatar from '../components/Avatar'
import './ProfilePage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id change
    setLoading(true)
    setError(null)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data, error: err }) => {
        if (!active) return
        if (err) setError(err.message)
        else setProfile(data)
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  if (loading) return <p className="profile-hint">Caricamento…</p>
  if (error || !profile) return <p className="alert-error">Profilo non trovato</p>

  return (
    <div className="profile-page">
      <div className="profile-card glass-strong">
        <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)} style={{ alignSelf: 'flex-start' }}>
          ← Indietro
        </button>

        <div className="profile-avatar-section">
          <Avatar url={profile.avatar_url} label={displayNameOf(profile)} size={96} />
          <h2>{displayNameOf(profile)}</h2>
          <p className="profile-username">@{profile.username}</p>
        </div>

        <div className="profile-readonly-row">
          <span className="profile-readonly-label">Nickname</span>
          <span className="profile-readonly-value profile-readonly-empty">
            Nessuno ancora — te lo danno i suoi amici
          </span>
        </div>

        <div className="profile-readonly-row">
          <span className="profile-readonly-label">Ranking</span>
          <span className="profile-ranking-badge">
            <span className="profile-ranking-value">–</span>
            <span className="profile-ranking-max">/10</span>
          </span>
        </div>
      </div>
    </div>
  )
}
