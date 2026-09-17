const PREFIX = 'mate-hub-badges-seen-'

export function badgeIdentity(b) {
  return `${b.badge_key}:${b.conversation_id || 'global'}`
}

export function loadSeenBadgeIds(userId) {
  try {
    const raw = localStorage.getItem(PREFIX + userId)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveSeenBadgeIds(userId, ids) {
  try {
    localStorage.setItem(PREFIX + userId, JSON.stringify(ids))
  } catch {
    // storage non disponibile: niente di grave, si riprova al prossimo caricamento
  }
}
