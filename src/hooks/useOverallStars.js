import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { buildStarsProfile } from '../lib/stars'

export function useOverallStars(userIds) {
  const idsKey = userIds.filter(Boolean).join(',')
  const [scores, setScores] = useState({})

  useEffect(() => {
    const ids = idsKey ? idsKey.split(',') : []
    if (ids.length === 0) return
    let active = true
    Promise.all(
      ids.map((id) =>
        supabase
          .rpc('get_user_stats', { p_user_id: id })
          .then(({ data, error }) => [id, error ? null : buildStarsProfile(data).overall]),
      ),
    ).then((entries) => {
      if (active) setScores(Object.fromEntries(entries))
    })
    return () => {
      active = false
    }
  }, [idsKey])

  return scores
}
