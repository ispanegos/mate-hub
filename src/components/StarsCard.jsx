import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildStarsProfile, formatStatValue } from '../lib/stars'
import RadarChart from './RadarChart'
import './StarsCard.css'
import './RadarChart.css'

export default function StarsCard({ userId }) {
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)

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

  if (loading) return <p className="profile-hint">Caricamento STARS…</p>
  if (!profile) return null

  return (
    <div className="stars-card glass">
      <div className="stars-overall">
        <span className="stars-overall-star">⭐</span>
        <span className="stars-overall-value">
          {profile.overall === null ? 'N/V' : profile.overall.toFixed(1)}
        </span>
        <span className="stars-overall-label">OVERALL</span>
      </div>

      <RadarChart perStat={profile.perStat} />

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
    </div>
  )
}
