import { supabase } from './supabase'

// Esporta i dati dell'utente cosi' come sono visibili nell'app (le stesse
// regole RLS si applicano qui: dati di gruppi lasciati in precedenza
// potrebbero non essere piu' accessibili, come nell'app stessa).
export async function exportMyData(userId) {
  const [
    profile,
    friends,
    memberships,
    messages,
    media,
    events,
    eventParticipants,
    starsGiven,
    starsReceived,
    expenses,
    expenseSplits,
    notifications,
    pushSubscriptions,
    blockedUsers,
    proposals,
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', userId).single(),
    supabase.from('friends').select('*').or(`user_id.eq.${userId},friend_id.eq.${userId}`),
    supabase.from('conversation_members').select('*').eq('user_id', userId),
    supabase.from('messages').select('*').eq('sender_id', userId),
    supabase.from('media').select('*').eq('uploaded_by', userId),
    supabase.from('events').select('*').eq('created_by', userId),
    supabase.from('event_participants').select('*').eq('user_id', userId),
    supabase.from('event_ratings').select('*').eq('voter_user_id', userId),
    supabase.from('event_ratings').select('*').eq('rated_user_id', userId),
    supabase.from('expenses').select('*').or(`created_by.eq.${userId},paid_by.eq.${userId}`),
    supabase.from('expense_splits').select('*').eq('user_id', userId),
    supabase.from('notifications').select('*').eq('user_id', userId),
    supabase.from('push_subscriptions').select('*').eq('user_id', userId),
    supabase.from('blocked_users').select('*').eq('blocker_id', userId),
    supabase.from('conversation_proposals').select('*').eq('requested_by', userId),
  ])

  const payload = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    friends: friends.data,
    group_memberships: memberships.data,
    messages_sent: messages.data,
    media_uploaded: media.data,
    events_created: events.data,
    event_participations: eventParticipants.data,
    pagella_voti_dati: starsGiven.data,
    pagella_voti_ricevuti: starsReceived.data,
    expenses: expenses.data,
    expense_splits: expenseSplits.data,
    notifications: notifications.data,
    push_subscriptions: pushSubscriptions.data,
    blocked_users: blockedUsers.data,
    group_proposals_created: proposals.data,
  }

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `mate-hub-dati-${new Date().toISOString().slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}
