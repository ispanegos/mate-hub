import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/useAuth'
import { notifyUsers } from '../lib/notifications'

export function useFriends() {
  const { user, profile } = useAuth()
  const [rows, setRows] = useState([])
  const [profilesById, setProfilesById] = useState({})
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const { data: friendRows, error } = await supabase
      .from('friends')
      .select('*')
      .or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    if (error) {
      setLoading(false)
      throw error
    }

    const otherIds = Array.from(
      new Set(friendRows.map((r) => (r.user_id === user.id ? r.friend_id : r.user_id))),
    )
    let profiles = {}
    if (otherIds.length) {
      const { data: profs, error: profErr } = await supabase
        .from('profiles')
        .select('*')
        .in('id', otherIds)
      if (profErr) throw profErr
      profiles = Object.fromEntries(profs.map((p) => [p.id, p]))
    }
    setRows(friendRows)
    setProfilesById(profiles)
    setLoading(false)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount
    load()
  }, [load])

  const withProfile = (r) => ({
    row: r,
    profile: profilesById[r.user_id === user.id ? r.friend_id : r.user_id],
  })

  const friends = rows.filter((r) => r.status === 'accepted').map(withProfile)
  const incoming = rows.filter((r) => r.status === 'pending' && r.friend_id === user?.id).map(withProfile)
  const outgoing = rows.filter((r) => r.status === 'pending' && r.user_id === user?.id).map(withProfile)

  const myName = profile?.first_name || profile?.username || 'Qualcuno'

  const sendRequest = async (targetUserId) => {
    const reverse = rows.find(
      (r) => r.user_id === targetUserId && r.friend_id === user.id && r.status === 'pending',
    )
    if (reverse) {
      const { error } = await supabase.from('friends').update({ status: 'accepted' }).eq('id', reverse.id)
      if (error) throw error
      notifyUsers({
        userIds: [targetUserId],
        actorId: user.id,
        type: 'friend_accept',
        title: 'Richiesta accettata',
        body: `${myName} ha accettato la tua richiesta di amicizia`,
        link: '/friends',
      })
    } else {
      const { error } = await supabase
        .from('friends')
        .insert({ user_id: user.id, friend_id: targetUserId, status: 'pending' })
      if (error) throw error
      notifyUsers({
        userIds: [targetUserId],
        actorId: user.id,
        type: 'friend_request',
        title: 'Nuova richiesta di amicizia',
        body: `${myName} vuole essere tuo amico`,
        link: '/friends',
      })
    }
    await load()
  }

  const respond = async (rowId, accept) => {
    const row = rows.find((r) => r.id === rowId)
    const { error } = await supabase
      .from('friends')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('id', rowId)
    if (error) throw error
    if (row) {
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('actor_id', row.user_id)
        .eq('type', 'friend_request')
    }
    if (accept && row) {
      notifyUsers({
        userIds: [row.user_id],
        actorId: user.id,
        type: 'friend_accept',
        title: 'Richiesta accettata',
        body: `${myName} ha accettato la tua richiesta di amicizia`,
        link: '/friends',
      })
    }
    await load()
  }

  return { friends, incoming, outgoing, loading, sendRequest, respond, refresh: load }
}
