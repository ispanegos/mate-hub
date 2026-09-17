import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function MediaBubble({ media }) {
  const [signedUrl, setSignedUrl] = useState(null)

  useEffect(() => {
    let active = true
    supabase.storage
      .from('chat-media')
      .createSignedUrl(media.url, 3600)
      .then(({ data }) => {
        if (active && data) setSignedUrl(data.signedUrl)
      })
    return () => {
      active = false
    }
  }, [media.url])

  if (!signedUrl) return <div className="media-bubble-loading">Caricamento…</div>
  if (media.type === 'image')
    return <img className="media-bubble-image" src={signedUrl} alt="" draggable={false} />

  if (media.type === 'video') return <video className="media-bubble-video" src={signedUrl} controls />
  if (media.type === 'audio') return <audio className="media-bubble-audio" src={signedUrl} controls />
  return null
}
