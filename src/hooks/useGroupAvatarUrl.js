import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

function extractChatMediaPath(avatarUrl) {
  const marker = '/chat-media/'
  const idx = avatarUrl.indexOf(marker)
  return (idx === -1 ? avatarUrl : avatarUrl.slice(idx + marker.length)).split('?')[0]
}

export function useGroupAvatarUrl(conversation) {
  const isGroup = conversation?.type === 'group'
  const avatarUrl = conversation?.avatar_url
  const [signedUrl, setSignedUrl] = useState(null)

  useEffect(() => {
    if (!isGroup || !avatarUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset quando il gruppo non ha (più) un avatar
      setSignedUrl(null)
      return
    }
    const path = extractChatMediaPath(avatarUrl)
    let active = true
    supabase.storage
      .from('chat-media')
      .createSignedUrl(path, 3600)
      .then(({ data }) => {
        if (active && data) setSignedUrl(data.signedUrl)
      })
    return () => {
      active = false
    }
  }, [isGroup, avatarUrl])

  return signedUrl
}
