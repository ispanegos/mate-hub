import { supabase } from './supabase'

export async function blockUser(blockerId, blockedId) {
  const { error: blockErr } = await supabase
    .from('blocked_users')
    .insert({ blocker_id: blockerId, blocked_id: blockedId })
  if (blockErr) throw blockErr

  await supabase
    .from('friends')
    .update({ status: 'declined' })
    .or(
      `and(user_id.eq.${blockerId},friend_id.eq.${blockedId}),and(user_id.eq.${blockedId},friend_id.eq.${blockerId})`,
    )
}

export async function unblockUser(blockerId, blockedId) {
  const { error } = await supabase
    .from('blocked_users')
    .delete()
    .eq('blocker_id', blockerId)
    .eq('blocked_id', blockedId)
  if (error) throw error
}
