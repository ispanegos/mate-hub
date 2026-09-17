import Avatar from './Avatar'
import { useGroupAvatarUrl } from '../hooks/useGroupAvatarUrl'

export default function ConversationAvatar({ conversation, otherProfile, label, size }) {
  const groupAvatarUrl = useGroupAvatarUrl(conversation)
  const isGroup = conversation?.type === 'group'
  const url = isGroup ? groupAvatarUrl : otherProfile?.avatar_url

  return <Avatar url={url} label={label} size={size} />
}
