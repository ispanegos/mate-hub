import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STAT_DEFS, buildStarsProfile, formatStatValue } from '../lib/stars'
import { BADGE_DEFS } from '../lib/badges'
import { useUserBadges } from '../hooks/useUserBadges'
import RadarChart from './RadarChart'
import './StarsCard.css'
import './RadarChart.css'

export default function StarsCard({ userId }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [showInfo, setShowInfo] = useState(false)
  const badges = useUserBadges(userId)

  useEffect(() => {
    if (!userId) return
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id change
    setLoading(true)
    supabase
      .rpc('get_user_stats', { p_user_id: userId })
      .then(({ data, error }) => {
        if (!active) return
        if (!error) setProfile(buildStarsProfile(data))
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [userId])

  if (loading) return <p className="profile-hint">Caricamento pagella…</p>
  if (!profile) return null

  return (
    <div className="stars-card glass">
      <p className="stars-card-title">Pagella</p>

      {badges.length > 0 && (
        <div className="stars-badges">
          {badges.map((key) => {
            const def = BADGE_DEFS[key]
            if (!def) return null
            return (
              <span key={key} className="stars-badge" title={def.description}>
                {def.emoji} {def.label}
              </span>
            )
          })}
        </div>
      )}

      <div className="stars-overall">
        <span className="stars-overall-value">
          {profile.overall === null ? 'N/V' : profile.overall.toFixed(1)}
        </span>
        <span className="stars-overall-label">OVERALL</span>
      </div>

      <RadarChart perStat={profile.perStat} />

      <button
        type="button"
        className="stars-info-btn"
        onClick={() => setShowInfo(true)}
        aria-label="Cosa sono le statistiche della pagella"
      >
        ⓘ Cosa sono le statistiche?
      </button>

      <div className="stars-rows">
        {profile.perStat.map((s) => (
          <div key={s.key} className="stars-row">
            <span className="stars-row-label">
              {s.emoji} {s.label}
            </span>
            <span className={`stars-row-value${s.value === null ? ' is-nv' : ''}`}>
              {formatStatValue(s.value)}
            </span>
          </div>
        ))}
      </div>

      <p className="stars-rated-count">{profile.ratedCount}/6 statistiche valutate</p>

      {showInfo && (
        <>
          <div className="stars-info-backdrop" onClick={() => setShowInfo(false)} />
          <div className="stars-info-panel glass-strong">
            <div className="stars-info-head">
              <span>Le statistiche della pagella</span>
              <button type="button" className="stars-info-close" onClick={() => setShowInfo(false)}>
                ✕
              </button>
            </div>
            <div className="stars-info-list">
              {STAT_DEFS.map((s) => (
                <div key={s.key} className="stars-info-item">
                  <span className="stars-info-item-title">
                    {s.emoji} {s.label}
                  </span>
                  <span className="stars-info-item-desc">{s.description}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
