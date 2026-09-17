import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import { blockUser, unblockUser } from '../lib/blocking'
import { friendlyError } from '../lib/friendlyError'
import Avatar from '../components/Avatar'
import StarsCard from '../components/StarsCard'
import NicknameBlock from '../components/NicknameBlock'
import './ProfilePage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

export default function UserProfilePage() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [isFriend, setIsFriend] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)
  const [blocking, setBlocking] = useState(false)
  const [blockError, setBlockError] = useState(null)
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

    supabase
      .from('friends')
      .select('status')
      .or(`and(user_id.eq.${user.id},friend_id.eq.${userId}),and(user_id.eq.${userId},friend_id.eq.${user.id})`)
      .eq('status', 'accepted')
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsFriend(!!data)
      })

    supabase
      .from('blocked_users')
      .select('blocked_id')
      .eq('blocker_id', user.id)
      .eq('blocked_id', userId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setIsBlocked(!!data)
      })

    return () => {
      active = false
    }
  }, [userId, user.id])

  const toggleBlock = async () => {
    setBlocking(true)
    setBlockError(null)
    try {
      if (isBlocked) {
        await unblockUser(user.id, userId)
        setIsBlocked(false)
      } else {
        if (!window.confirm('Bloccare questo utente? Non potrà più mandarti richieste di amicizia o inviti.')) {
          return
        }
        await blockUser(user.id, userId)
        setIsBlocked(true)
        setIsFriend(false)
      }
    } catch (err) {
      setBlockError(friendlyError(err))
    } finally {
      setBlocking(false)
    }
  }

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

        <NicknameBlock targetUserId={profile.id} canPropose={isFriend} />

        {blockError && <div className="alert-error">{blockError}</div>}
        <button
          type="button"
          className={`btn btn-block ${isBlocked ? 'btn-secondary' : 'btn-ghost'}`}
          disabled={blocking}
          onClick={toggleBlock}
        >
          {blocking ? 'Attendere…' : isBlocked ? 'Sblocca utente' : 'Blocca utente'}
        </button>
      </div>

      <StarsCard userId={profile.id} />
    </div>
  )
}
