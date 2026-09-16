import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'

export function useConversations() {
  const { user } = useAuth()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: memberRows, error } = await supabase
      .from('conversation_members')
      .select('*, conversation:conversations(*)')
      .eq('user_id', user.id)
    if (error) {
      setLoading(false)
      throw error
    }

    const directIds = memberRows
      .filter((r) => r.conversation?.type === 'direct')
      .map((r) => r.conversation_id)

    let otherByConv = {}
    if (directIds.length) {
      const { data: others } = await supabase
        .from('conversation_members')
        .select('*')
        .in('conversation_id', directIds)
        .neq('user_id', user.id)

      if (others?.length) {
        const otherUserIds = Array.from(new Set(others.map((o) => o.user_id)))
        const { data: profs } = await supabase.from('profiles').select('*').in('id', otherUserIds)
        const profById = Object.fromEntries((profs || []).map((p) => [p.id, p]))
        otherByConv = Object.fromEntries(others.map((o) => [o.conversation_id, profById[o.user_id]]))
      }
    }

    const sorted = memberRows
      .map((r) => ({ ...r, otherProfile: otherByConv[r.conversation_id] }))
      .sort((a, b) => new Date(b.conversation?.created_at) - new Date(a.conversation?.created_at))

    setItems(sorted)
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    load()
  }, [load])

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel(`conv-members-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members', filter: `user_id=eq.${user.id}` },
        () => load(),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [user, load])

  return { items, loading, refresh: load }
}

export function conversationTitle(conversation, otherProfile) {
  if (conversation?.type === 'direct') {
    if (!otherProfile) return 'Chat'
    const full = [otherProfile.first_name, otherProfile.last_name].filter(Boolean).join(' ')
    return full || otherProfile.username
  }
  return conversation?.name || 'Gruppo senza nome'
}
