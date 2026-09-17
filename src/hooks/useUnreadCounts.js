import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

export function useUnreadCounts() {
  const { user } = useAuth()
  const [counts, setCounts] = useState({})

  const load = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.rpc('get_unread_counts')
    setCounts(Object.fromEntries((data || []).map((r) => [r.conversation_id, Number(r.unread_count)])))
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    load()
  }, [load])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`unread-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, load])

  return { counts, refresh: load }
}
