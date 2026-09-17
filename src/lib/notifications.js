import { supabase } from './supabase'

export async function notifyUsers({ userIds, actorId, type, title, body, link, conversationId }) {
  let recipients = Array.from(new Set(userIds)).filter((id) => id && id !== actorId)
  if (recipients.length === 0) return

  if (conversationId) {
    const { data: muted } = await supabase
      .from('conversation_members')
      .select('user_id')
      .eq('conversation_id', conversationId)
      .eq('muted', true)
      .in('user_id', recipients)
    const mutedIds = new Set((muted || []).map((m) => m.user_id))
    recipients = recipients.filter((id) => !mutedIds.has(id))
    if (recipients.length === 0) return
  }

  const rows = recipients.map((userId) => ({
    user_id: userId,
    actor_id: actorId || null,
    type,
    title,
    body: body || null,
    link: link || null,
    conversation_id: conversationId || null,
  }))

  const { error } = await supabase.from('notifications').insert(rows)
  if (error) console.error('notifyUsers failed', error)
}
