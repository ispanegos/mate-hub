import { useRef, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import './ProfilePage.css'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024

function LogoutIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 20H5.5A1.5 1.5 0 0 1 4 18.5v-13A1.5 1.5 0 0 1 5.5 4H9M16 16.5 20.5 12 16 7.5M20.5 12H9"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.8l.9-1.5h5.6L14.7 7h1.8A1.5 1.5 0 0 1 18 8.5v8A1.5 1.5 0 0 1 16.5 18h-11A1.5 1.5 0 0 1 4 16.5v-8Z"
      />
      <circle cx="11" cy="12.2" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export default function ProfilePage() {
  const { user, profile, signOut, updateProfile } = useAuth()
  const fileInputRef = useRef(null)

  const [firstName, setFirstName] = useState(profile?.first_name || '')
  const [lastName, setLastName] = useState(profile?.last_name || '')
  const [avatarPreview, setAvatarPreview] = useState(profile?.avatar_url || null)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(false)

  const displayName = profile?.username || user?.email || 'Tu'
  const dirty = firstName !== (profile?.first_name || '') || lastName !== (profile?.last_name || '')

  const handleAvatarClick = () => fileInputRef.current?.click()

  const handleAvatarChange = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !user) return

    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine valido')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Immagine troppo grande (max 5MB)')
      return
    }

    const localUrl = URL.createObjectURL(file)
    setAvatarPreview(localUrl)
    setUploading(true)

    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(path)
      const avatarUrl = `${publicData.publicUrl}?t=${Date.now()}`

      await updateProfile({ avatar_url: avatarUrl })
      setAvatarPreview(avatarUrl)
    } catch (err) {
      setError(err.message || 'Caricamento immagine non riuscito')
      setAvatarPreview(profile?.avatar_url || null)
    } finally {
      setUploading(false)
    }
  }

  const handleSave = async (event) => {
    event.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)
    try {
      await updateProfile({
        first_name: firstName.trim() || null,
        last_name: lastName.trim() || null,
      })
      setSuccess(true)
    } catch (err) {
      setError(err.message || 'Salvataggio non riuscito')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-card glass-strong">
        <div className="profile-avatar-section">
          <button
            type="button"
            className="profile-avatar"
            onClick={handleAvatarClick}
            aria-label="Cambia immagine profilo"
          >
            <span className="profile-avatar-clip">
              {avatarPreview ? (
                <img src={avatarPreview} alt="" />
              ) : (
                <span className="profile-avatar-initial">{displayName.slice(0, 1).toUpperCase()}</span>
              )}
            </span>
            <span className="profile-avatar-edit">
              <CameraIcon />
            </span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={handleAvatarChange}
          />
          <p className="profile-username">@{profile?.username}</p>
          {uploading && <p className="profile-hint">Caricamento immagine…</p>}
        </div>

        <form className="form-stack" onSubmit={handleSave}>
          {error && <div className="alert-error">{error}</div>}
          {success && <div className="alert-success">Profilo aggiornato</div>}

          <div className="field">
            <label htmlFor="first-name">Nome</label>
            <input
              id="first-name"
              type="text"
              className="input"
              placeholder="Il tuo nome"
              value={firstName}
              onChange={(e) => {
                setFirstName(e.target.value)
                setSuccess(false)
              }}
            />
          </div>

          <div className="field">
            <label htmlFor="last-name">Cognome</label>
            <input
              id="last-name"
              type="text"
              className="input"
              placeholder="Il tuo cognome"
              value={lastName}
              onChange={(e) => {
                setLastName(e.target.value)
                setSuccess(false)
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block" disabled={!dirty || saving}>
            {saving ? 'Salvataggio…' : 'Salva modifiche'}
          </button>
        </form>

        <div className="profile-readonly-row">
          <span className="profile-readonly-label">Nickname</span>
          <span className="profile-readonly-value profile-readonly-empty">
            Nessuno ancora — te lo danno i tuoi amici
          </span>
        </div>

        <div className="profile-readonly-row">
          <span className="profile-readonly-label">Ranking</span>
          <span className="profile-ranking-badge">
            <span className="profile-ranking-value">–</span>
            <span className="profile-ranking-max">/10</span>
          </span>
        </div>

        <button type="button" className="btn btn-secondary btn-block profile-logout" onClick={signOut}>
          <LogoutIcon />
          Esci
        </button>
      </div>
    </div>
  )
}
