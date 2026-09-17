import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import Avatar from '../../components/Avatar'
import RatingSlider from '../../components/RatingSlider'
import { STAT_DEFS, pickQuestion } from '../../lib/stars'
import { notifyUsers } from '../../lib/notifications'
import './RateEventPage.css'

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

function voteKey(userId, statKey) {
  return `${userId}::${statKey}`
}

export default function RateEventPage() {
  const { eventId } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [event, setEvent] = useState(null)
  const [participants, setParticipants] = useState([])
  const [questionByStat, setQuestionByStat] = useState({})
  const [votes, setVotes] = useState({})
  const [stepIndex, setStepIndex] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [alreadyVoted, setAlreadyVoted] = useState(false)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)

      const { data: ev, error: evErr } = await supabase.from('events').select('*').eq('id', eventId).single()
      if (evErr || !ev) {
        if (active) {
          setError('Evento non trovato')
          setLoading(false)
        }
        return
      }

      const { data: partRows } = await supabase
        .from('event_participants')
        .select('user_id')
        .eq('event_id', eventId)
      const otherIds = (partRows || []).map((p) => p.user_id).filter((uid) => uid !== user.id)

      let profiles = []
      if (otherIds.length > 0) {
        const { data: profRows } = await supabase.from('profiles').select('*').in('id', otherIds)
        profiles = profRows || []
      }

      const { data: questions } = await supabase
        .from('rating_questions')
        .select('*')
        .eq('is_active', true)

      const { data: recentVotes } = await supabase
        .from('event_ratings')
        .select('stat_key, question_id, created_at')
        .eq('voter_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      const { data: ownVotesForEvent } = await supabase
        .from('event_ratings')
        .select('id')
        .eq('event_id', eventId)
        .eq('voter_user_id', user.id)
        .limit(1)

      if (!active) return

      if (ownVotesForEvent && ownVotesForEvent.length > 0) {
        setEvent(ev)
        setAlreadyVoted(true)
        setLoading(false)
        return
      }

      const picks = {}
      STAT_DEFS.forEach((def) => {
        const pool = (questions || []).filter((q) => q.stat_key === def.key)
        const recentIds = (recentVotes || [])
          .filter((r) => r.stat_key === def.key)
          .slice(0, 3)
          .map((r) => r.question_id)
        picks[def.key] = pickQuestion(pool, recentIds)
      })

      setEvent(ev)
      setParticipants(profiles)
      setQuestionByStat(picks)
      setLoading(false)
    }
    load()
    return () => {
      active = false
    }
  }, [eventId, user.id])

  const currentStat = STAT_DEFS[stepIndex]
  const currentQuestion = currentStat ? questionByStat[currentStat.key] : null

  const setVote = useCallback(
    (targetUserId, statKey, score) => {
      setVotes((prev) => ({ ...prev, [voteKey(targetUserId, statKey)]: score }))
    },
    [],
  )

  const isLastStep = stepIndex === STAT_DEFS.length - 1

  const submit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      const rows = []
      STAT_DEFS.forEach((def) => {
        participants.forEach((p) => {
          const score = votes[voteKey(p.id, def.key)]
          if (score !== undefined && score !== null) {
            rows.push({
              event_id: eventId,
              voter_user_id: user.id,
              rated_user_id: p.id,
              stat_key: def.key,
              question_id: questionByStat[def.key]?.id || null,
              score,
            })
          }
        })
      })

      if (rows.length > 0) {
        const { error: insErr } = await supabase.from('event_ratings').insert(rows)
        if (insErr) throw insErr

        const ratedUserIds = Array.from(new Set(rows.map((r) => r.rated_user_id)))
        notifyUsers({
          userIds: ratedUserIds,
          actorId: user.id,
          type: 'stars_vote',
          title: 'Nuova valutazione per la tua pagella',
          body: `Hai ricevuto una valutazione per "${event?.name}"`,
          link: `/profile`,
        })
      }
      setDone(true)
    } catch (err) {
      setError(err.message || 'Invio valutazioni non riuscito')
    } finally {
      setSubmitting(false)
    }
  }

  const votedCount = useMemo(
    () => Object.values(votes).filter((v) => v !== null && v !== undefined).length,
    [votes],
  )

  if (loading) return <p className="profile-hint">Caricamento…</p>
  if (error && !event) return <p className="alert-error">{error}</p>

  if (done) {
    return (
      <div className="rate-event-page">
        <div className="rate-event-done glass-strong">
          <span className="rate-event-done-emoji">⭐</span>
          <h2>Valutazioni inviate</h2>
          <p className="profile-hint">Grazie! I voti contribuiscono alla pagella di {participants.length} persone.</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/chat/${event.conversation_id}`)}
          >
            Torna alla chat
          </button>
        </div>
      </div>
    )
  }

  if (alreadyVoted) {
    return (
      <div className="rate-event-page">
        <div className="rate-event-done glass-strong">
          <span className="rate-event-done-emoji">⭐</span>
          <h2>Hai già valutato questo evento</h2>
          <p className="profile-hint">I voti sono definitivi e non si possono modificare.</p>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => navigate(`/chat/${event.conversation_id}`)}
          >
            Torna alla chat
          </button>
        </div>
      </div>
    )
  }

  if (participants.length === 0) {
    return (
      <div className="rate-event-page">
        <div className="rate-event-done glass-strong">
          <p className="profile-hint">Nessun altro partecipante da valutare per questo evento.</p>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => navigate(`/chat/${event.conversation_id}`)}
          >
            Torna alla chat
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="rate-event-page">
      <div className="rate-event-card glass-strong">
        <div className="rate-event-progress">
          <span>{stepIndex + 1}/{STAT_DEFS.length}</span>
          <div className="rate-event-progress-bar">
            <div
              className="rate-event-progress-fill"
              style={{ width: `${((stepIndex + 1) / STAT_DEFS.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="rate-event-stat-title">
          <span className="rate-event-stat-emoji">{currentStat.emoji}</span>
          <span className="rate-event-stat-label">{currentStat.label.toUpperCase()}</span>
        </div>
        <p className="rate-event-question">{currentQuestion?.text}</p>

        <div className="rate-event-participants">
          {participants.map((p) => (
            <div key={p.id} className="rate-event-participant-row">
              <div className="rate-event-participant-head">
                <Avatar url={p.avatar_url} label={displayNameOf(p)} size={30} />
                <span>{displayNameOf(p)}</span>
              </div>
              <RatingSlider
                value={votes[voteKey(p.id, currentStat.key)] ?? null}
                onChange={(v) => setVote(p.id, currentStat.key, v)}
              />
            </div>
          ))}
        </div>

        {error && <div className="alert-error">{error}</div>}

        <div className="rate-event-nav">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={stepIndex === 0}
            onClick={() => setStepIndex((i) => Math.max(0, i - 1))}
          >
            ← Indietro
          </button>
          {isLastStep ? (
            <button type="button" className="btn btn-primary" onClick={submit} disabled={submitting}>
              {submitting ? 'Invio…' : 'Invia valutazioni'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setStepIndex((i) => Math.min(STAT_DEFS.length - 1, i + 1))}
            >
              Avanti →
            </button>
          )}
        </div>
        <p className="rate-event-hint">{votedCount} valutazioni impostate finora — puoi lasciare N/V.</p>
      </div>
    </div>
  )
}
