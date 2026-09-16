import { useEffect, useState } from 'react'
import { useAuth } from '../context/useAuth'
import { supabase } from '../lib/supabase'
import './NicknameBlock.css'

export default function NicknameBlock({ targetUserId, canPropose }) {
  const { user } = useAuth()
  const [loading, setLoading] = useState(true)
  const [nicknames, setNicknames] = useState([])
  const [draft, setDraft] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    const { data: nickRows } = await supabase
      .from('nicknames')
      .select('*')
      .eq('given_to', targetUserId)
      .order('created_at', { ascending: true })

    const ids = (nickRows || []).map((n) => n.id)
    let likeRows = []
    if (ids.length > 0) {
      const { data } = await supabase.from('nickname_likes').select('*').in('nickname_id', ids)
      likeRows = data || []
    }

    const merged = (nickRows || []).map((n) => {
      const likes = likeRows.filter((l) => l.nickname_id === n.id)
      return {
        ...n,
        likeCount: likes.length,
        likedByMe: likes.some((l) => l.liked_by === user.id),
      }
    })
    merged.sort((a, b) => b.likeCount - a.likeCount || new Date(a.created_at) - new Date(b.created_at))
    setNicknames(merged)
    setLoading(false)
  }

  useEffect(() => {
    if (!targetUserId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id change
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetUserId])

  const propose = async (event) => {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setSubmitting(true)
    setError(null)
    const { error: err } = await supabase
      .from('nicknames')
      .insert({ given_by: user.id, given_to: targetUserId, nickname_text: text })
    if (err) {
      setError(err.code === '23505' ? 'Hai già proposto questo nickname' : err.message)
    } else {
      setDraft('')
      await load()
    }
    setSubmitting(false)
  }

  const toggleLike = async (nickname) => {
    if (nickname.likedByMe) {
      await supabase.from('nickname_likes').delete().eq('nickname_id', nickname.id).eq('liked_by', user.id)
    } else {
      await supabase.from('nickname_likes').insert({ nickname_id: nickname.id, liked_by: user.id })
    }
    load()
  }

  const removeProposal = async (nicknameId) => {
    await supabase.from('nicknames').delete().eq('id', nicknameId)
    load()
  }

  if (loading) return null

  const top = nicknames[0]
  const isOwn = targetUserId === user.id

  return (
    <div className="nickname-block">
      <div className="profile-readonly-row">
        <span className="profile-readonly-label">Nickname</span>
        <span className={`profile-readonly-value${!top ? ' profile-readonly-empty' : ''}`}>
          {top ? `“${top.nickname_text}”` : `Nessuno ancora — te lo danno ${isOwn ? 'i tuoi' : 'i suoi'} amici`}
        </span>
      </div>

      {nicknames.length > 0 && (
        <div className="nickname-list">
          {nicknames.map((n) => (
            <div key={n.id} className="nickname-chip">
              <span className="nickname-chip-text">{n.nickname_text}</span>
              <button
                type="button"
                className={`nickname-like-btn${n.likedByMe ? ' is-active' : ''}`}
                onClick={() => toggleLike(n)}
                disabled={isOwn}
              >
                ♥ {n.likeCount}
              </button>
              {n.given_by === user.id && (
                <button
                  type="button"
                  className="nickname-remove-btn"
                  aria-label="Ritira proposta"
                  onClick={() => removeProposal(n.id)}
                >
                  ×
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canPropose && (
        <form className="nickname-propose-form" onSubmit={propose}>
          {error && <div className="alert-error">{error}</div>}
          <div className="nickname-propose-row">
            <input
              type="text"
              className="input"
              placeholder="Proponi un nickname…"
              maxLength={40}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary" disabled={submitting || !draft.trim()}>
              Proponi
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
