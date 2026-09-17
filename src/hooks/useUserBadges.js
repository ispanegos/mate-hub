import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function useUserBadges(userId) {
  const [badges, setBadges] = useState([])

  useEffect(() => {
    if (!userId) return
    let active = true
    supabase
      .rpc('get_user_badges', { p_user_id: userId })
      .then(({ data }) => {
        if (active) setBadges(data || [])
      })
    return () => {
      active = false
    }
  }, [userId])

  return badges
}
