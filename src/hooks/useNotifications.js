import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

const PAGE_SIZE = 30

export function useNotifications() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    if (!error) setItems(data || [])
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    load()
  }, [load])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.new.read) return
          setItems((prev) => [payload.new, ...prev].slice(0, PAGE_SIZE))
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          // segnata come letta altrove (es. azione completata): sparisce anche da qui
          setItems((prev) =>
            payload.new.read
              ? prev.filter((n) => n.id !== payload.new.id)
              : prev.map((n) => (n.id === payload.new.id ? payload.new : n)),
          )
        },
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  const markRead = useCallback(async (id) => {
    setItems((prev) => prev.filter((n) => n.id !== id))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const markAllRead = useCallback(async () => {
    if (!user) return
    setItems([])
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
  }, [user])

  return { items, loading, unreadCount: items.length, markRead, markAllRead, refresh: load }
}
