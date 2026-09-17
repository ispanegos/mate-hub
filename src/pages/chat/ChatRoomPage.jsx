import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useOutletContext, useParams } from 'react-router-dom'
import { useAuth } from '../../context/useAuth'
import { supabase } from '../../lib/supabase'
import { useConversations, conversationTitle } from '../../hooks/useConversations'
import { useFriends } from '../../hooks/useFriends'
import { useGroupAvatarUrl } from '../../hooks/useGroupAvatarUrl'
import { useOnlineStatus } from '../../hooks/useOnlineStatus'
import { notifyUsers } from '../../lib/notifications'
import { compressImage } from '../../lib/imageCompress'
import Avatar from '../../components/Avatar'
import MediaBubble from './MediaBubble'
import './ChatRoomPage.css'

const MAX_AVATAR_BYTES = 5 * 1024 * 1024
const LONG_PRESS_MS = 450
const CAPSULE_MIN_DATE = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

const MEMBER_COLORS = [
  '#E4572E',
  '#2E86AB',
  '#57A773',
  '#8E44AD',
  '#D64550',
  '#C98A1A',
  '#3C6E71',
  '#B5446E',
]

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function mediaLabel(type) {
  if (type === 'image') return '📷 Foto'
  if (type === 'video') return '🎥 Video'
  if (type === 'audio') return '🎤 Audio'
  return 'Messaggio'
}

function splitEvenly(amount, n) {
  const cents = Math.round(amount * 100)
  const base = Math.floor(cents / n)
  const remainder = cents - base * n
  return Array.from({ length: n }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100)
}

function formatEuro(value) {
  return `€${Number(value).toFixed(2)}`
}

// saldo netto per persona a partire dalle sole quote non ancora saldate,
// poi minimizza il numero di transazioni necessarie (stile Splitwise)
function simplifyDebts(expensesById, allSplits) {
  const net = {}
  allSplits.forEach((s) => {
    if (s.paid) return
    const exp = expensesById[s.expense_id]
    if (!exp) return
    net[exp.paid_by] = (net[exp.paid_by] || 0) + Number(s.share)
    net[s.user_id] = (net[s.user_id] || 0) - Number(s.share)
  })

  const creditors = Object.entries(net)
    .filter(([, v]) => v > 0.004)
    .map(([id, amt]) => ({ id, amt }))
    .sort((a, b) => b.amt - a.amt)
  const debtors = Object.entries(net)
    .filter(([, v]) => v < -0.004)
    .map(([id, amt]) => ({ id, amt: -amt }))
    .sort((a, b) => b.amt - a.amt)

  const txns = []
  let i = 0
  let j = 0
  while (i < debtors.length && j < creditors.length) {
    const pay = Math.min(debtors[i].amt, creditors[j].amt)
    if (pay > 0.004) txns.push({ from: debtors[i].id, to: creditors[j].id, amount: Math.round(pay * 100) / 100 })
    debtors[i].amt -= pay
    creditors[j].amt -= pay
    if (debtors[i].amt <= 0.004) i += 1
    if (creditors[j].amt <= 0.004) j += 1
  }
  return txns
}

function displayNameOf(profile) {
  if (!profile) return 'Utente'
  const full = [profile.first_name, profile.last_name].filter(Boolean).join(' ')
  return full || profile.username
}

function ProposalAvatarThumb({ path }) {
  const url = useGroupAvatarUrl({ type: 'group', avatar_url: path })
  return <Avatar url={url} label="?" size={28} />
}

function ImageIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="8.5" cy="9.5" r="1.5" stroke="currentColor" strokeWidth="1.6" />
      <path stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" d="m5 17 4.5-5 3 3 2.5-3 4 5" />
    </svg>
  )
}

function MicIcon({ active }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <rect x="9" y="3.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
      />
      {active && <circle cx="19" cy="5" r="3" fill="var(--danger)" />}
    </svg>
  )
}

function SendIcon() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" aria-hidden="true">
      <path stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" d="M4 12 20 4l-6.5 16-3-7-6.5-1Z" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 8.5A1.5 1.5 0 0 1 5.5 7h1.8l.9-1.5h5.6L14.7 7h1.8A1.5 1.5 0 0 1 18 8.5v8A1.5 1.5 0 0 1 16.5 18h-11A1.5 1.5 0 0 1 4 16.5v-8Z"
      />
      <circle cx="11" cy="12.2" r="3" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  )
}

export default function ChatRoomPage() {
  const { id } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const isOnline = useOnlineStatus()
  const { setHeaderTitle } = useOutletContext() || {}
  const { friends } = useFriends()
  const [showInviteFriends, setShowInviteFriends] = useState(false)
  const [invitingId, setInvitingId] = useState(null)

  const [conversation, setConversation] = useState(null)
  const [myStatus, setMyStatus] = useState(null)
  const [members, setMembers] = useState([])
  const [messages, setMessages] = useState([])
  const [mediaByMsg, setMediaByMsg] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [tab, setTab] = useState('chat')
  const [showInfo, setShowInfo] = useState(false)
  const [banRequests, setBanRequests] = useState([])
  const [banVotes, setBanVotes] = useState([])

  const [proposals, setProposals] = useState([])
  const [proposalOptions, setProposalOptions] = useState([])
  const [proposalVotes, setProposalVotes] = useState([])
  const [nameProposalDraft, setNameProposalDraft] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const avatarInputRef = useRef(null)

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [recording, setRecording] = useState(false)
  const [mentionQuery, setMentionQuery] = useState(null)
  const [typingUsers, setTypingUsers] = useState({})
  const typingChannelRef = useRef(null)
  const typingTimeoutsRef = useRef({})
  const lastTypingSentRef = useRef(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const fileInputRef = useRef(null)
  const scrollRef = useRef(null)
  const composerInputRef = useRef(null)

  const [colorPickerFor, setColorPickerFor] = useState(null)

  const [reactionsByMessage, setReactionsByMessage] = useState({})
  const [actionMenuFor, setActionMenuFor] = useState(null)
  const [customEmojiOpen, setCustomEmojiOpen] = useState(false)
  const [customEmojiValue, setCustomEmojiValue] = useState('')
  const customEmojiInputRef = useRef(null)
  const [replyTo, setReplyTo] = useState(null)
  const [editingMessage, setEditingMessage] = useState(null)
  const [trashedMessages, setTrashedMessages] = useState([])
  const [polls, setPolls] = useState([])
  const [pollOptions, setPollOptions] = useState([])
  const [pollVotes, setPollVotes] = useState([])
  const [showPollForm, setShowPollForm] = useState(false)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptionInputs, setPollOptionInputs] = useState(['', ''])
  const [pins, setPins] = useState([])
  const [capsules, setCapsules] = useState([])
  const [showCapsuleForm, setShowCapsuleForm] = useState(false)
  const [capsuleContent, setCapsuleContent] = useState('')
  const [capsuleDate, setCapsuleDate] = useState('')
  const [mood, setMood] = useState(null)
  const [chatSearchOpen, setChatSearchOpen] = useState(false)
  const [chatSearchQuery, setChatSearchQuery] = useState('')
  const [forwardSheetFor, setForwardSheetFor] = useState(null)
  const [forwarding, setForwarding] = useState(false)
  const [forwardDone, setForwardDone] = useState(false)
  const longPressTimer = useRef(null)
  const longPressFired = useRef(false)
  const messageIdsRef = useRef(new Set())

  const { items: allConversations } = useConversations()

  const [expenses, setExpenses] = useState([])
  const [expenseSplits, setExpenseSplits] = useState({})
  const [showExpenseForm, setShowExpenseForm] = useState(false)
  const [expenseDesc, setExpenseDesc] = useState('')
  const [expenseAmount, setExpenseAmount] = useState('')
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [expensePaidBy, setExpensePaidBy] = useState('')
  const [savingExpense, setSavingExpense] = useState(false)
  const [expenseView, setExpenseView] = useState('open')
  const [expandedExpenseIds, setExpandedExpenseIds] = useState(() => new Set())

  const [events, setEvents] = useState([])
  const [eventParticipantsMap, setEventParticipantsMap] = useState({})
  const [showEventForm, setShowEventForm] = useState(false)
  const [eventName, setEventName] = useState('')
  const [eventStart, setEventStart] = useState('')
  const [eventEnd, setEventEnd] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [eventParticipantIds, setEventParticipantIds] = useState(() => new Set())
  const [savingEvent, setSavingEvent] = useState(false)
  const [expandedEventIds, setExpandedEventIds] = useState(() => new Set())

  const [folders, setFolders] = useState([])
  const [mediaFolderMap, setMediaFolderMap] = useState({})
  const [allMedia, setAllMedia] = useState([])
  const [activeFolderId, setActiveFolderId] = useState(null)
  const [newFolderName, setNewFolderName] = useState('')
  const [viewerMedia, setViewerMedia] = useState(null)
  const [moveMenuFor, setMoveMenuFor] = useState(null)
  const [moveNewFolderName, setMoveNewFolderName] = useState('')

  useEffect(() => {
    if (!viewerMedia) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setViewerMedia(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [viewerMedia])

  const isMember = myStatus === 'accepted'
  const isGroup = conversation?.type === 'group'
  const groupAvatarSignedUrl = useGroupAvatarUrl(conversation)

  const otherProfile = useMemo(() => {
    if (conversation?.type !== 'direct') return null
    return members.find((m) => m.user_id !== user.id)?.profile
  }, [conversation, members, user.id])

  const title = useMemo(() => {
    if (!conversation) return 'Chat'
    if (conversation.type === 'direct') return otherProfile ? displayNameOf(otherProfile) : 'Chat'
    return conversation.name || 'Gruppo senza nome'
  }, [conversation, otherProfile])

  useEffect(() => {
    if (!setHeaderTitle) return
    setHeaderTitle(conversation ? title : null)
    return () => setHeaderTitle(null)
  }, [setHeaderTitle, conversation, title])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset del picker quando cambia messaggio/si chiude
    setCustomEmojiOpen(false)
    setCustomEmojiValue('')
  }, [actionMenuFor])

  const membersById = useMemo(() => {
    // ogni membro ha di default un colore diverso (deterministico, uguale per tutti i client),
    // sovrascrivibile a mano dal pannello info
    const sortedIds = [...members].map((m) => m.user_id).sort()
    return Object.fromEntries(
      members.map((m) => {
        const defaultColor = MEMBER_COLORS[sortedIds.indexOf(m.user_id) % MEMBER_COLORS.length]
        return [m.user_id, { ...m, effectiveColor: m.color || defaultColor }]
      }),
    )
  }, [members])

  const otherMemberIds = useMemo(
    () => members.filter((m) => m.status === 'accepted' && m.user_id !== user.id).map((m) => m.user_id),
    [members, user.id],
  )

  const messagesById = useMemo(() => Object.fromEntries(messages.map((m) => [m.id, m])), [messages])

  const chatSearchQueryTrimmed = chatSearchQuery.trim().toLowerCase()
  const visibleChatMessages = chatSearchQueryTrimmed
    ? messages.filter((m) => m.type === 'text' && m.content?.toLowerCase().includes(chatSearchQueryTrimmed))
    : messages

  useEffect(() => {
    messageIdsRef.current = new Set(messages.map((m) => m.id))
  }, [messages])

  const forwardTargets = allConversations.filter((c) => c.status === 'accepted' && c.conversation_id !== id)

  const loadMembers = useCallback(async () => {
    const { data: memberRows, error: memErr } = await supabase
      .from('conversation_members')
      .select('*')
      .eq('conversation_id', id)
    if (memErr) throw memErr

    const mine = memberRows.find((m) => m.user_id === user.id)
    setMyStatus(mine?.status || null)

    const ids = memberRows.map((m) => m.user_id)
    const { data: profs } = await supabase.from('profiles').select('*').in('id', ids)
    const profById = Object.fromEntries((profs || []).map((p) => [p.id, p]))
    setMembers(memberRows.map((m) => ({ ...m, profile: profById[m.user_id] })))

    return mine
  }, [id, user.id])

  const loadCore = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()
      if (convErr) throw convErr
      setConversation(conv)

      const mine = await loadMembers()

      if (mine?.status === 'accepted') {
        const { data: msgs, error: msgErr } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', id)
          .is('deleted_at', null)
          .order('created_at', { ascending: true })
        if (msgErr) throw msgErr
        setMessages(msgs || [])

        const { data: mediaRows } = await supabase.from('media').select('*').eq('conversation_id', id)
        setMediaByMsg(Object.fromEntries((mediaRows || []).map((m) => [m.message_id, m])))

        if (msgs?.length) {
          const { data: reactionRows } = await supabase
            .from('message_reactions')
            .select('*')
            .in('message_id', msgs.map((m) => m.id))
          const map = {}
          ;(reactionRows || []).forEach((r) => {
            map[r.message_id] = map[r.message_id] || []
            map[r.message_id].push(r)
          })
          setReactionsByMessage(map)
        }
      }
    } catch (err) {
      setError(err.message || 'Errore nel caricamento')
    } finally {
      setLoading(false)
    }
  }, [id, loadMembers])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/id change
    loadCore()
  }, [loadCore])

  // segna come letta la chat quando la si apre o arrivano nuovi messaggi mentre e' aperta
  useEffect(() => {
    if (!isMember || tab !== 'chat') return
    supabase
      .from('conversation_members')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', id)
      .eq('user_id', user.id)
      .then(() => {})
  }, [id, user.id, isMember, tab, messages.length])

  const toggleMute = async () => {
    const nextMuted = !membersById[user.id]?.muted
    const { error: err } = await supabase
      .from('conversation_members')
      .update({ muted: nextMuted })
      .eq('conversation_id', id)
      .eq('user_id', user.id)
    if (err) {
      setError(err.message)
      return
    }
    setMembers((prev) => prev.map((m) => (m.user_id === user.id ? { ...m, muted: nextMuted } : m)))
  }

  // realtime: membri (stato inviti/ban) sempre attivo per chi ha gia' aperto la stanza
  useEffect(() => {
    const channel = supabase
      .channel(`chat-members-${id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'conversation_members', filter: `conversation_id=eq.${id}` },
        () => {
          loadMembers()
        },
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, loadMembers])

  // realtime: info conversazione (nome/immagine) + eliminazione gruppo votata
  useEffect(() => {
    const channel = supabase
      .channel(`chat-conv-${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        (payload) => {
          setConversation(payload.new)
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'conversations', filter: `id=eq.${id}` },
        () => {
          navigate('/', { replace: true })
        },
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, navigate])

  // "sta scrivendo…" via broadcast realtime (nessuna scrittura su DB)
  useEffect(() => {
    const channel = supabase.channel(`chat-typing-${id}`, { config: { broadcast: { self: false } } })
    channel
      .on('broadcast', { event: 'typing' }, ({ payload }) => {
        if (!payload?.userId || payload.userId === user.id) return
        setTypingUsers((prev) => ({ ...prev, [payload.userId]: payload.name }))
        clearTimeout(typingTimeoutsRef.current[payload.userId])
        typingTimeoutsRef.current[payload.userId] = setTimeout(() => {
          setTypingUsers((prev) => {
            if (!(payload.userId in prev)) return prev
            const next = { ...prev }
            delete next[payload.userId]
            return next
          })
        }, 4000)
      })
      .subscribe()
    typingChannelRef.current = channel
    return () => {
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout)
      typingTimeoutsRef.current = {}
      supabase.removeChannel(channel)
    }
  }, [id, user.id])

  const broadcastTyping = () => {
    const now = Date.now()
    if (now - lastTypingSentRef.current < 2500) return
    lastTypingSentRef.current = now
    typingChannelRef.current?.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: user.id, name: displayNameOf(membersById[user.id]?.profile) },
    })
  }

  // realtime messages + media
  useEffect(() => {
    if (!isMember) return
    const channel = supabase
      .channel(`chat-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) =>
          setMessages((prev) => (prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new])),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          if (payload.new.deleted_at) {
            setMessages((prev) => prev.filter((m) => m.id !== payload.new.id))
            return
          }
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) {
              return prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            }
            return [...prev, payload.new].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'media', filter: `conversation_id=eq.${id}` },
        (payload) => setMediaByMsg((prev) => ({ ...prev, [payload.new.message_id]: payload.new })),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const mid = payload.old.id
          setMessages((prev) => prev.filter((m) => m.id !== mid))
          setMediaByMsg((prev) => {
            if (!prev[mid]) return prev
            const next = { ...prev }
            delete next[mid]
            return next
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'media', filter: `conversation_id=eq.${id}` },
        (payload) => {
          const mediaId = payload.old.id
          setAllMedia((prev) => prev.filter((m) => m.id !== mediaId))
          setMediaFolderMap((prev) => {
            if (!prev[mediaId]) return prev
            const next = { ...prev }
            delete next[mediaId]
            return next
          })
        },
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, isMember])

  // realtime reazioni (nessun filtro server-side possibile su piu' colonne:
  // scartiamo lato client gli eventi che non riguardano questa conversazione)
  useEffect(() => {
    if (!isMember) return
    const channel = supabase
      .channel(`chat-reactions-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'message_reactions' }, (payload) => {
        if (!messageIdsRef.current.has(payload.new.message_id)) return
        setReactionsByMessage((prev) => {
          const list = prev[payload.new.message_id] || []
          if (list.some((r) => r.id === payload.new.id)) return prev
          return { ...prev, [payload.new.message_id]: [...list, payload.new] }
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'message_reactions' }, (payload) => {
        const mid = payload.old.message_id
        if (!mid || !messageIdsRef.current.has(mid)) return
        setReactionsByMessage((prev) => {
          if (!prev[mid]) return prev
          return { ...prev, [mid]: prev[mid].filter((r) => r.id !== payload.old.id) }
        })
      })
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, isMember])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [messages])

  const respondInvite = async (accept) => {
    const { error: err } = await supabase
      .from('conversation_members')
      .update({ status: accept ? 'accepted' : 'declined' })
      .eq('conversation_id', id)
      .eq('user_id', user.id)
    if (err) {
      setError(err.message)
      return
    }
    if (!accept) {
      navigate('/', { replace: true })
      return
    }
    loadCore()
  }

  const sendText = async (event) => {
    event.preventDefault()
    const value = text.trim()
    if (!value) return
    setSending(true)

    if (editingMessage) {
      const { error: err } = await supabase
        .from('messages')
        .update({ content: value, edited_at: new Date().toISOString() })
        .eq('id', editingMessage.id)
      setSending(false)
      setText('')
      setEditingMessage(null)
      if (err) setError(err.message)
      return
    }

    setText('')
    const replyId = replyTo?.id ?? null
    setReplyTo(null)
    const { error: err } = await supabase
      .from('messages')
      .insert({ conversation_id: id, sender_id: user.id, type: 'text', content: value, reply_to_id: replyId })
    setSending(false)
    if (err) {
      setError(err.message)
      return
    }

    const senderName = displayNameOf(membersById[user.id]?.profile)
    const mentionedIds = extractMentionedUserIds(value)
    const mentionRecipients = otherMemberIds.filter((uid) => mentionedIds.includes(uid))
    const regularRecipients = otherMemberIds.filter((uid) => !mentionedIds.includes(uid))

    if (mentionRecipients.length > 0) {
      notifyUsers({
        userIds: mentionRecipients,
        actorId: user.id,
        type: 'mention',
        title: `${senderName} ti ha menzionato`,
        body: value,
        link: `/chat/${id}`,
        conversationId: id,
      })
    }
    if (regularRecipients.length > 0 && !isGroup) {
      notifyUsers({
        userIds: regularRecipients,
        actorId: user.id,
        type: 'message',
        title: senderName,
        body: value,
        link: `/chat/${id}`,
        conversationId: id,
      })
    }
  }

  const sendMedia = async (blob, type, ext) => {
    setSending(true)
    setError(null)
    const replyId = replyTo?.id ?? null
    setReplyTo(null)
    try {
      const path = `${id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, blob, { contentType: blob.type })
      if (upErr) throw upErr

      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({ conversation_id: id, sender_id: user.id, type, content: null, reply_to_id: replyId })
        .select()
        .single()
      if (msgErr) throw msgErr

      const { error: mediaErr } = await supabase
        .from('media')
        .insert({ message_id: msg.id, conversation_id: id, url: path, type, uploaded_by: user.id })
      if (mediaErr) throw mediaErr
      // niente append ottimistico qui: la sottoscrizione realtime sui messaggi
      // (sotto) aggiunge questo stesso insert una volta arrivato l'evento,
      // stesso pattern del messaggio di testo
      const mediaLabel = type === 'image' ? 'una foto' : type === 'video' ? 'un video' : 'un audio'
      if (!isGroup) {
        notifyUsers({
          userIds: otherMemberIds,
          actorId: user.id,
          type: 'media',
          title: displayNameOf(membersById[user.id]?.profile),
          body: `Ha inviato ${mediaLabel}`,
          link: `/chat/${id}`,
          conversationId: id,
        })
      }
    } catch (err) {
      setError(err.message || 'Invio non riuscito')
    } finally {
      setSending(false)
    }
  }

  const handleFilePick = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    const uploadFile = type === 'image' ? await compressImage(file) : file
    const ext = uploadFile.name.split('.').pop() || (type === 'video' ? 'mp4' : 'jpg')
    await sendMedia(uploadFile, type, ext)
  }

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop()
      setRecording(false)
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await sendMedia(blob, 'audio', 'webm')
      }
      recorder.start()
      mediaRecorderRef.current = recorder
      setRecording(true)
    } catch {
      setError('Permesso microfono negato')
    }
  }

  // --- pressione prolungata: reazioni / rispondi / inoltra ---
  const startLongPress = (messageId) => {
    longPressFired.current = false
    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true
      setActionMenuFor(messageId)
    }, LONG_PRESS_MS)
  }

  const cancelLongPress = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }

  const toggleReaction = async (messageId, emoji) => {
    const existing = (reactionsByMessage[messageId] || []).find(
      (r) => r.user_id === user.id && r.emoji === emoji,
    )
    setActionMenuFor(null)
    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
      setReactionsByMessage((prev) => ({
        ...prev,
        [messageId]: (prev[messageId] || []).filter((r) => r.id !== existing.id),
      }))
    } else {
      const { error: err } = await supabase
        .from('message_reactions')
        .insert({ message_id: messageId, user_id: user.id, emoji })
      if (err) setError(err.message)
    }
  }

  const startReply = (messageId) => {
    setReplyTo(messagesById[messageId] || null)
    setActionMenuFor(null)
    composerInputRef.current?.focus()
  }

  const startEdit = (messageId) => {
    const m = messagesById[messageId]
    if (!m) return
    setEditingMessage(m)
    setReplyTo(null)
    setText(m.content || '')
    setActionMenuFor(null)
    composerInputRef.current?.focus()
  }

  const cancelEdit = () => {
    setEditingMessage(null)
    setText('')
  }

  const forwardMessage = async (messageId, targetConvId) => {
    const original = messagesById[messageId]
    if (!original) return
    setForwarding(true)
    setError(null)
    try {
      if (original.type === 'text') {
        const { error: err } = await supabase
          .from('messages')
          .insert({ conversation_id: targetConvId, sender_id: user.id, type: 'text', content: original.content })
        if (err) throw err
      } else {
        const media = mediaByMsg[messageId]
        if (!media) throw new Error('Media non trovato')
        const ext = media.url.split('.').pop()
        const newPath = `${targetConvId}/${crypto.randomUUID()}.${ext}`
        const { error: copyErr } = await supabase.storage.from('chat-media').copy(media.url, newPath)
        if (copyErr) throw copyErr

        const { data: msg, error: msgErr } = await supabase
          .from('messages')
          .insert({ conversation_id: targetConvId, sender_id: user.id, type: original.type, content: null })
          .select()
          .single()
        if (msgErr) throw msgErr

        const { error: mediaErr } = await supabase
          .from('media')
          .insert({ message_id: msg.id, conversation_id: targetConvId, url: newPath, type: original.type, uploaded_by: user.id })
        if (mediaErr) throw mediaErr
      }
      setForwardDone(true)
      setTimeout(() => {
        setForwardSheetFor(null)
        setForwardDone(false)
      }, 1200)
    } catch (err) {
      setError(err.message || 'Inoltro non riuscito')
    } finally {
      setForwarding(false)
    }
  }

  // --- menzioni ---
  const handleTextChange = (event) => {
    const value = event.target.value
    const cursor = event.target.selectionStart
    setText(value)
    if (value.trim()) broadcastTyping()
    const before = value.slice(0, cursor)
    const match = before.match(/(?:^|\s)@([a-zA-Z0-9_.]*)$/)
    setMentionQuery(match ? match[1] : null)
  }

  const selectMention = (username) => {
    const input = composerInputRef.current
    const cursor = input?.selectionStart ?? text.length
    const before = text.slice(0, cursor)
    const after = text.slice(cursor)
    const newBefore = before.replace(/@([a-zA-Z0-9_.]*)$/, `@${username} `)
    const newText = newBefore + after
    setText(newText)
    setMentionQuery(null)
    requestAnimationFrame(() => {
      input?.focus()
      input?.setSelectionRange(newBefore.length, newBefore.length)
    })
  }

  // --- proposte di gruppo (rename / foto / eliminazione), decise a maggioranza ---
  const loadProposals = useCallback(async () => {
    const { data: props } = await supabase
      .from('conversation_proposals')
      .select('*')
      .eq('conversation_id', id)
      .eq('status', 'open')
    setProposals(props || [])
    if (props?.length) {
      const proposalIds = props.map((p) => p.id)
      const { data: opts } = await supabase
        .from('conversation_proposal_options')
        .select('*')
        .in('proposal_id', proposalIds)
      setProposalOptions(opts || [])
      const { data: votes } = await supabase
        .from('conversation_proposal_votes')
        .select('*')
        .in('proposal_id', proposalIds)
      setProposalVotes(votes || [])
    } else {
      setProposalOptions([])
      setProposalVotes([])
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when panel opens
    if (showInfo && isMember) loadProposals()
  }, [showInfo, isMember, loadProposals])

  const openProposalOfType = (type) => proposals.find((p) => p.type === type)

  const PROPOSAL_COOLDOWN_MS = 30 * 60 * 1000

  const checkProposalCooldown = async (type) => {
    const { data } = await supabase
      .from('conversation_proposals')
      .select('resolved_at')
      .eq('conversation_id', id)
      .eq('type', type)
      .not('resolved_at', 'is', null)
      .order('resolved_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (!data?.resolved_at) return true
    const elapsed = Date.now() - new Date(data.resolved_at).getTime()
    if (elapsed < PROPOSAL_COOLDOWN_MS) {
      const minutesLeft = Math.ceil((PROPOSAL_COOLDOWN_MS - elapsed) / 60000)
      setError(`Questo tipo di proposta è stata decisa da poco. Aspetta ancora ${minutesLeft} minuti prima di riproporla.`)
      return false
    }
    return true
  }

  const createProposal = async (type, newLabel, newValue) => {
    if (!(await checkProposalCooldown(type))) return
    const defaults = {
      rename: {
        label: `Mantieni "${conversation.name || 'Gruppo senza nome'}"`,
        value: conversation.name || null,
      },
      avatar: { label: 'Mantieni la foto attuale', value: conversation.avatar_url || null },
      delete: { label: 'Mantieni il gruppo', value: null },
    }
    const def = defaults[type]

    const { data: prop, error: propErr } = await supabase
      .from('conversation_proposals')
      .insert({ conversation_id: id, type, requested_by: user.id })
      .select()
      .single()
    if (propErr) {
      setError(propErr.message)
      return
    }

    const { data: opts, error: optErr } = await supabase
      .from('conversation_proposal_options')
      .insert([
        { proposal_id: prop.id, label: def.label, value: def.value, is_default: true, proposed_by: user.id },
        { proposal_id: prop.id, label: newLabel, value: newValue, is_default: false, proposed_by: user.id },
      ])
      .select()
    if (optErr) {
      setError(optErr.message)
      return
    }

    const myOption = opts.find((o) => !o.is_default)
    await supabase
      .from('conversation_proposal_votes')
      .upsert(
        { proposal_id: prop.id, option_id: myOption.id, voter_id: user.id },
        { onConflict: 'proposal_id,voter_id' },
      )

    notifyUsers({
      userIds: otherMemberIds,
      actorId: user.id,
      type: 'group_proposal',
      title: 'Nuova proposta nel gruppo',
      body: `${displayNameOf(membersById[user.id]?.profile)} ha proposto: ${newLabel}`,
      link: `/chat/${id}`,
      conversationId: id,
    })

    loadProposals()
  }

  const addProposalOption = async (proposalId, label, value) => {
    const { data: opt, error: optErr } = await supabase
      .from('conversation_proposal_options')
      .insert({ proposal_id: proposalId, label, value, is_default: false, proposed_by: user.id })
      .select()
      .single()
    if (optErr) {
      setError(optErr.message)
      return
    }
    await supabase
      .from('conversation_proposal_votes')
      .upsert(
        { proposal_id: proposalId, option_id: opt.id, voter_id: user.id },
        { onConflict: 'proposal_id,voter_id' },
      )
    loadProposals()
  }

  const castProposalVote = async (proposalId, optionId) => {
    const { error: voteErr } = await supabase
      .from('conversation_proposal_votes')
      .upsert({ proposal_id: proposalId, option_id: optionId, voter_id: user.id }, { onConflict: 'proposal_id,voter_id' })
    if (voteErr) {
      setError(voteErr.message)
      loadProposals()
      return
    }

    const { data: conv } = await supabase.from('conversations').select('*').eq('id', id).maybeSingle()
    if (!conv) {
      navigate('/', { replace: true })
      return
    }
    setConversation(conv)
    loadProposals()
  }

  const submitNameProposal = async (event) => {
    event.preventDefault()
    const value = nameProposalDraft.trim()
    if (!value) return
    setNameProposalDraft('')
    const open = openProposalOfType('rename')
    if (open) await addProposalOption(open.id, value, value)
    else await createProposal('rename', value, value)
  }

  const uploadAvatarProposal = async (event) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setError(null)

    if (!file.type.startsWith('image/')) {
      setError('Seleziona un file immagine valido')
      return
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError('Immagine troppo grande (max 5MB)')
      return
    }

    setUploadingAvatar(true)
    try {
      const compressed = await compressImage(file)
      const ext = compressed.name.split('.').pop() || 'jpg'
      const path = `${id}/_proposal_avatar_${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('chat-media')
        .upload(path, compressed, { contentType: compressed.type })
      if (upErr) throw upErr

      const open = openProposalOfType('avatar')
      if (open) await addProposalOption(open.id, 'Nuova foto proposta', path)
      else await createProposal('avatar', 'Nuova foto proposta', path)
    } catch (err) {
      setError(err.message || 'Caricamento immagine non riuscito')
    } finally {
      setUploadingAvatar(false)
    }
  }

  const proposeDeleteGroup = async () => {
    if (openProposalOfType('delete')) return
    await createProposal('delete', 'Elimina il gruppo', null)
  }

  const leaveGroup = async () => {
    if (!window.confirm('Uscire da questo gruppo?')) return
    await supabase.from('conversation_members').delete().eq('conversation_id', id).eq('user_id', user.id)
    navigate('/', { replace: true })
  }

  const invitableFriends = friends.filter(
    ({ profile: p }) => p && !members.some((m) => m.user_id === p.id),
  )

  const inviteFriend = async (friendId) => {
    setInvitingId(friendId)
    const { error: err } = await supabase
      .from('conversation_members')
      .insert({ conversation_id: id, user_id: friendId, status: 'invited', invited_by: user.id })
    if (err) {
      setError(err.message)
      setInvitingId(null)
      return
    }
    notifyUsers({
      userIds: [friendId],
      actorId: user.id,
      type: 'conversation_invite',
      title: 'Nuovo invito a un gruppo',
      body: `${displayNameOf(membersById[user.id]?.profile)} ti ha invitato in "${conversation?.name}"`,
      link: '/',
      conversationId: id,
    })
    await loadMembers()
    setInvitingId(null)
  }

  // --- membri / ban ---
  const loadBan = useCallback(async () => {
    const { data: reqs } = await supabase
      .from('conversation_ban_requests')
      .select('*')
      .eq('conversation_id', id)
      .eq('status', 'open')
    setBanRequests(reqs || [])
    if (reqs?.length) {
      const { data: votes } = await supabase
        .from('conversation_ban_votes')
        .select('*')
        .in('request_id', reqs.map((r) => r.id))
      setBanVotes(votes || [])
    } else {
      setBanVotes([])
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when panel opens
    if (showInfo && isMember) loadBan()
  }, [showInfo, isMember, loadBan])

  const requestBan = async (targetUserId) => {
    const { data: req, error: err } = await supabase
      .from('conversation_ban_requests')
      .insert({ conversation_id: id, target_user_id: targetUserId, requested_by: user.id })
      .select()
      .single()
    if (err) {
      setError(err.message)
      return
    }
    await supabase.from('conversation_ban_votes').insert({ request_id: req.id, voter_id: user.id, vote: true })
    loadBan()
  }

  const setMemberColor = async (targetUserId, color) => {
    const { error: err } = await supabase.rpc('set_member_color', {
      p_conversation_id: id,
      p_user_id: targetUserId,
      p_color: color,
    })
    setColorPickerFor(null)
    if (err) {
      setError(err.message)
      return
    }
    setMembers((prev) => prev.map((m) => (m.user_id === targetUserId ? { ...m, color } : m)))
  }

  const castVote = async (requestId, vote) => {
    const existing = banVotes.find((v) => v.request_id === requestId && v.voter_id === user.id)
    if (existing) {
      await supabase
        .from('conversation_ban_votes')
        .update({ vote })
        .eq('request_id', requestId)
        .eq('voter_id', user.id)
    } else {
      await supabase.from('conversation_ban_votes').insert({ request_id: requestId, voter_id: user.id, vote })
    }
    loadBan()
    loadCore()
  }

  // --- archivio ---
  const loadArchive = useCallback(async () => {
    const { data: folderRows } = await supabase
      .from('folders')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true })
    setFolders(folderRows || [])

    const { data: mediaRows } = await supabase
      .from('media')
      .select('*')
      .eq('conversation_id', id)
      .in('type', ['image', 'video'])
      .order('created_at', { ascending: false })
    setAllMedia(mediaRows || [])

    if (folderRows?.length) {
      const { data: mfRows } = await supabase
        .from('media_folders')
        .select('*')
        .in('folder_id', folderRows.map((f) => f.id))
      const map = {}
      ;(mfRows || []).forEach((mf) => {
        map[mf.media_id] = map[mf.media_id] || []
        map[mf.media_id].push(mf.folder_id)
      })
      setMediaFolderMap(map)
    } else {
      setMediaFolderMap({})
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when tab opens
    if (tab === 'archivio' && isMember) loadArchive()
  }, [tab, isMember, loadArchive])

  const createFolder = async (event) => {
    event.preventDefault()
    const value = newFolderName.trim()
    if (!value) return
    const { error: err } = await supabase
      .from('folders')
      .insert({ conversation_id: id, name: value, created_by: user.id })
    if (err) {
      setError(err.message)
      return
    }
    setNewFolderName('')
    loadArchive()
  }

  const moveToFolder = async (mediaId, folderId) => {
    await supabase.from('media_folders').delete().eq('media_id', mediaId)
    if (folderId) {
      await supabase.from('media_folders').insert({ media_id: mediaId, folder_id: folderId })
    }
    setMoveMenuFor(null)
    loadArchive()
  }

  const createFolderAndMove = async (mediaId) => {
    const value = moveNewFolderName.trim()
    if (!value) return
    const { data: folder, error: err } = await supabase
      .from('folders')
      .insert({ conversation_id: id, name: value, created_by: user.id })
      .select()
      .single()
    if (err) {
      setError(err.message)
      return
    }
    setMoveNewFolderName('')
    await supabase.from('media_folders').delete().eq('media_id', mediaId)
    await supabase.from('media_folders').insert({ media_id: mediaId, folder_id: folder.id })
    setMoveMenuFor(null)
    loadArchive()
  }

  const downloadMedia = async (media) => {
    const { data, error: err } = await supabase.storage.from('chat-media').createSignedUrl(media.url, 60)
    if (err || !data) {
      setError(err?.message || 'Download non riuscito')
      return
    }
    try {
      const res = await fetch(data.signedUrl)
      const blob = await res.blob()
      const ext = media.url.split('.').pop() || (media.type === 'video' ? 'mp4' : media.type === 'audio' ? 'm4a' : 'jpg')
      const filename = `mate-hub-${media.id}.${ext}`
      const file = new File([blob], filename, { type: blob.type })

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file] })
        return
      }

      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (err) {
      if (err?.name !== 'AbortError') setError('Download non riuscito')
    }
  }

  const deleteMedia = async (media) => {
    const { error: err } = await supabase.from('messages').delete().eq('id', media.message_id)
    if (err) {
      setError(err.message)
      return
    }
    await supabase.storage.from('chat-media').remove([media.url])
    setAllMedia((prev) => prev.filter((m) => m.id !== media.id))
    setMediaFolderMap((prev) => {
      if (!prev[media.id]) return prev
      const next = { ...prev }
      delete next[media.id]
      return next
    })
    setMessages((prev) => prev.filter((m) => m.id !== media.message_id))
    setMediaByMsg((prev) => {
      if (!prev[media.message_id]) return prev
      const next = { ...prev }
      delete next[media.message_id]
      return next
    })
    setViewerMedia((prev) => (prev?.id === media.id ? null : prev))
  }

  const deleteTextMessage = async (messageId) => {
    const { error: err } = await supabase
      .from('messages')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', messageId)
    if (err) {
      setError(err.message)
      return
    }
    setMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  const loadTrash = useCallback(async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .eq('sender_id', user.id)
      .eq('type', 'text')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    setTrashedMessages(data || [])
  }, [id, user.id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when panel opens
    if (showInfo && isMember) loadTrash()
  }, [showInfo, isMember, loadTrash])

  const restoreTextMessage = async (messageId) => {
    const { error: err } = await supabase.from('messages').update({ deleted_at: null }).eq('id', messageId)
    if (err) {
      setError(err.message)
      return
    }
    setTrashedMessages((prev) => prev.filter((m) => m.id !== messageId))
  }

  // --- sondaggi lampo (informali, non vincolanti come le proposte di gruppo) ---
  const loadPolls = useCallback(async () => {
    const { data: pollRows } = await supabase
      .from('group_polls')
      .select('*')
      .eq('conversation_id', id)
      .eq('status', 'open')
      .order('created_at', { ascending: false })
    setPolls(pollRows || [])
    if (pollRows?.length) {
      const pollIds = pollRows.map((p) => p.id)
      const { data: opts } = await supabase.from('group_poll_options').select('*').in('poll_id', pollIds)
      setPollOptions(opts || [])
      const { data: votes } = await supabase.from('group_poll_votes').select('*').in('poll_id', pollIds)
      setPollVotes(votes || [])
    } else {
      setPollOptions([])
      setPollVotes([])
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/quando si diventa membro
    if (isMember) loadPolls()
  }, [isMember, loadPolls])

  const removePollLocally = (pollId) => {
    setPolls((prev) => prev.filter((p) => p.id !== pollId))
    setPollOptions((prev) => prev.filter((o) => o.poll_id !== pollId))
    setPollVotes((prev) => prev.filter((v) => v.poll_id !== pollId))
  }

  // Aggiornamento incrementale invece di ricaricare sondaggi/opzioni/voti a ogni
  // evento: con più persone che votano nello stesso sondaggio un reload completo
  // a ogni voto sarebbe uno spreco. Nessun filtro conversation_id lato server su
  // opzioni/voti (le tabelle non hanno quella colonna): li accettiamo comunque,
  // sono innocui perché il render li filtra già per poll_id appartenente a questa
  // conversazione (la RLS garantisce comunque che arrivino solo eventi di poll
  // visibili a chi guarda).
  useEffect(() => {
    if (!isMember) return
    const channel = supabase
      .channel(`chat-polls-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_polls', filter: `conversation_id=eq.${id}` },
        (payload) => setPolls((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [payload.new, ...prev])),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_polls', filter: `conversation_id=eq.${id}` },
        (payload) => {
          if (payload.new.status !== 'open') removePollLocally(payload.new.id)
          else setPolls((prev) => prev.map((p) => (p.id === payload.new.id ? payload.new : p)))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_polls' },
        (payload) => removePollLocally(payload.old.id),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_poll_options' },
        (payload) =>
          setPollOptions((prev) => (prev.some((o) => o.id === payload.new.id) ? prev : [...prev, payload.new])),
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'group_poll_votes' },
        (payload) =>
          setPollVotes((prev) => [
            ...prev.filter((v) => !(v.poll_id === payload.new.poll_id && v.voter_id === payload.new.voter_id)),
            payload.new,
          ]),
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'group_poll_votes' },
        (payload) =>
          setPollVotes((prev) =>
            prev.map((v) =>
              v.poll_id === payload.new.poll_id && v.voter_id === payload.new.voter_id ? payload.new : v,
            ),
          ),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'group_poll_votes' },
        (payload) =>
          setPollVotes((prev) =>
            prev.filter((v) => !(v.poll_id === payload.old.poll_id && v.voter_id === payload.old.voter_id)),
          ),
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, isMember])

  const resetPollForm = () => {
    setPollQuestion('')
    setPollOptionInputs(['', ''])
    setShowPollForm(false)
  }

  const createPoll = async (event) => {
    event.preventDefault()
    const question = pollQuestion.trim()
    const options = pollOptionInputs.map((o) => o.trim()).filter(Boolean)
    if (!question || options.length < 2) return

    const { data: poll, error: pollErr } = await supabase
      .from('group_polls')
      .insert({ conversation_id: id, question, created_by: user.id })
      .select()
      .single()
    if (pollErr) {
      setError(pollErr.message)
      return
    }

    const { data: insertedOptions, error: optErr } = await supabase
      .from('group_poll_options')
      .insert(options.map((label) => ({ poll_id: poll.id, label })))
      .select()
    if (optErr) {
      setError(optErr.message)
      return
    }

    // aggiornamento ottimistico per chi ha appena creato il sondaggio: non
    // aspettiamo il giro di ritorno del canale realtime per vederlo comparire
    setPolls((prev) => (prev.some((p) => p.id === poll.id) ? prev : [poll, ...prev]))
    setPollOptions((prev) => [...prev, ...(insertedOptions || [])])

    notifyUsers({
      userIds: otherMemberIds,
      actorId: user.id,
      type: 'poll',
      title: 'Nuovo sondaggio',
      body: question,
      link: `/chat/${id}`,
      conversationId: id,
    })

    resetPollForm()
  }

  const votePoll = async (pollId, optionId) => {
    const vote = { poll_id: pollId, option_id: optionId, voter_id: user.id }
    setPollVotes((prev) => [...prev.filter((v) => !(v.poll_id === pollId && v.voter_id === user.id)), vote])
    await supabase.from('group_poll_votes').upsert(vote, { onConflict: 'poll_id,voter_id' })
  }

  const closePoll = async (pollId) => {
    removePollLocally(pollId)
    await supabase.from('group_polls').update({ status: 'closed' }).eq('id', pollId)
  }

  // --- bacheca: frasi pinnate e capsule del tempo ---
  const loadPins = useCallback(async () => {
    const { data: pinRows } = await supabase
      .from('message_pins')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
    setPins(pinRows || [])
  }, [id])

  const loadCapsules = useCallback(async () => {
    const { data: capsuleRows } = await supabase.rpc('get_time_capsules', { p_conversation_id: id })
    setCapsules(capsuleRows || [])
  }, [id])

  useEffect(() => {
    if (!isMember) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch on mount/quando si diventa membro; serve anche fuori dalla tab per sapere cosa e' gia' pinnato nel menu azioni
    loadPins()
    loadCapsules()
  }, [isMember, loadPins, loadCapsules])

  useEffect(() => {
    if (!isMember) return
    const channel = supabase
      .channel(`chat-bacheca-${id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'message_pins', filter: `conversation_id=eq.${id}` },
        (payload) => setPins((prev) => (prev.some((p) => p.id === payload.new.id) ? prev : [payload.new, ...prev])),
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'message_pins' },
        (payload) => setPins((prev) => prev.filter((p) => p.id !== payload.old.id)),
      )
      // le capsule sigillate sono visibili solo al loro autore lato RLS: l'evento
      // realtime arriva solo a chi le ha create, quindi un reload leggero qui basta
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'time_capsules', filter: `conversation_id=eq.${id}` }, () => loadCapsules())
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [id, isMember, loadCapsules])

  const togglePin = async (messageId) => {
    const existing = pins.find((p) => p.message_id === messageId)
    setActionMenuFor(null)
    if (existing) {
      if (existing.pinned_by !== user.id) return
      setPins((prev) => prev.filter((p) => p.id !== existing.id))
      await supabase.from('message_pins').delete().eq('id', existing.id)
    } else {
      const { data } = await supabase
        .from('message_pins')
        .insert({ conversation_id: id, message_id: messageId, pinned_by: user.id })
        .select()
        .single()
      if (data) setPins((prev) => (prev.some((p) => p.id === data.id) ? prev : [data, ...prev]))
    }
  }

  const unpin = async (pinId) => {
    setPins((prev) => prev.filter((p) => p.id !== pinId))
    await supabase.from('message_pins').delete().eq('id', pinId)
  }

  const resetCapsuleForm = () => {
    setCapsuleContent('')
    setCapsuleDate('')
    setShowCapsuleForm(false)
  }

  const createCapsule = async (event) => {
    event.preventDefault()
    const content = capsuleContent.trim()
    if (!content || !capsuleDate) return
    const opensAt = new Date(capsuleDate)
    if (Number.isNaN(opensAt.getTime()) || opensAt <= new Date()) return

    const { error: err } = await supabase
      .from('time_capsules')
      .insert({ conversation_id: id, created_by: user.id, content, opens_at: opensAt.toISOString() })
    if (err) {
      setError(err.message)
      return
    }
    resetCapsuleForm()
    loadCapsules()
  }

  // --- meteo del gruppo: indicatore scherzoso, solo per i gruppi ---
  const loadMood = useCallback(async () => {
    const { data } = await supabase.rpc('get_group_mood', { p_conversation_id: id })
    setMood(data?.[0] || null)
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch quando si apre il pannello info
    if (showInfo && isMember && isGroup) loadMood()
  }, [showInfo, isMember, isGroup, loadMood])

  const visibleMedia = activeFolderId
    ? allMedia.filter((m) => (mediaFolderMap[m.id] || []).includes(activeFolderId))
    : allMedia

  // --- split spese ---
  const loadExpenses = useCallback(async () => {
    const { data: expRows } = await supabase
      .from('expenses')
      .select('*')
      .eq('conversation_id', id)
      .order('expense_date', { ascending: false })
    setExpenses(expRows || [])

    if (expRows?.length) {
      const { data: splitRows } = await supabase
        .from('expense_splits')
        .select('*')
        .in('expense_id', expRows.map((e) => e.id))
      const map = {}
      ;(splitRows || []).forEach((s) => {
        map[s.expense_id] = map[s.expense_id] || []
        map[s.expense_id].push(s)
      })
      setExpenseSplits(map)
    } else {
      setExpenseSplits({})
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when tab opens
    if (tab === 'split' && isMember) loadExpenses()
  }, [tab, isMember, loadExpenses])

  const loadEvents = useCallback(async () => {
    const { data: eventRows } = await supabase
      .from('events')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: false })
    setEvents(eventRows || [])

    if (eventRows && eventRows.length > 0) {
      const { data: partRows } = await supabase
        .from('event_participants')
        .select('event_id, user_id')
        .in('event_id', eventRows.map((e) => e.id))
      const map = {}
      ;(partRows || []).forEach((p) => {
        map[p.event_id] = map[p.event_id] || []
        map[p.event_id].push(p.user_id)
      })
      setEventParticipantsMap(map)
    } else {
      setEventParticipantsMap({})
    }
  }, [id])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data fetch when tab opens
    if (tab === 'eventi' && isMember) loadEvents()
  }, [tab, isMember, loadEvents])

  const openEventForm = () => {
    setEventName('')
    setEventStart('')
    setEventEnd('')
    setEventLocation('')
    setEventParticipantIds(new Set(members.filter((m) => m.status === 'accepted').map((m) => m.user_id)))
    setShowEventForm(true)
  }

  const toggleEventParticipant = (userId) => {
    setEventParticipantIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) next.delete(userId)
      else next.add(userId)
      return next
    })
  }

  const createEvent = async (event) => {
    event.preventDefault()
    if (!eventName.trim() || eventParticipantIds.size === 0) return
    setSavingEvent(true)
    setError(null)
    try {
      const { data: created, error: evErr } = await supabase
        .from('events')
        .insert({
          conversation_id: id,
          name: eventName.trim(),
          start_date: eventStart || null,
          end_date: eventEnd || null,
          location: eventLocation.trim() || null,
          created_by: user.id,
        })
        .select()
        .single()
      if (evErr) throw evErr

      const { error: partErr } = await supabase
        .from('event_participants')
        .insert(Array.from(eventParticipantIds).map((uid) => ({ event_id: created.id, user_id: uid })))
      if (partErr) throw partErr

      notifyUsers({
        userIds: Array.from(eventParticipantIds),
        actorId: user.id,
        type: 'event_created',
        title: 'Nuovo evento',
        body: `${displayNameOf(membersById[user.id]?.profile)} ha creato "${created.name}"`,
        link: `/chat/${id}`,
        conversationId: id,
      })

      setShowEventForm(false)
      loadEvents()
    } catch (err) {
      setError(err.message || 'Creazione evento non riuscita')
    } finally {
      setSavingEvent(false)
    }
  }

  const toggleExpandedEvent = (eventId) => {
    setExpandedEventIds((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
    })
  }

  const deleteEvent = async (ev) => {
    const eventId = ev.id
    const participantIds = eventParticipantsMap[eventId] || []
    await supabase.from('event_participants').delete().eq('event_id', eventId)
    const { error: err } = await supabase.from('events').delete().eq('id', eventId)
    if (err) {
      setError(err.message)
      return
    }
    notifyUsers({
      userIds: participantIds,
      actorId: user.id,
      type: 'event_deleted',
      title: 'Evento eliminato',
      body: `"${ev.name}" è stato eliminato`,
      link: `/chat/${id}`,
      conversationId: id,
    })
    setEvents((prev) => prev.filter((e) => e.id !== eventId))
    setEventParticipantsMap((prev) => {
      if (!prev[eventId]) return prev
      const next = { ...prev }
      delete next[eventId]
      return next
    })
    setExpandedEventIds((prev) => {
      if (!prev.has(eventId)) return prev
      const next = new Set(prev)
      next.delete(eventId)
      return next
    })
  }

  const openExpenseForm = () => {
    setExpenseDesc('')
    setExpenseAmount('')
    setExpenseDate(new Date().toISOString().slice(0, 10))
    setExpensePaidBy(user.id)
    setShowExpenseForm(true)
  }

  const createExpense = async (event) => {
    event.preventDefault()
    const amount = parseFloat(expenseAmount.replace(',', '.'))
    if (!expenseDesc.trim() || !amount || amount <= 0) return
    setSavingExpense(true)
    setError(null)
    try {
      const { data: expense, error: expErr } = await supabase
        .from('expenses')
        .insert({
          conversation_id: id,
          description: expenseDesc.trim(),
          amount,
          expense_date: expenseDate,
          paid_by: expensePaidBy,
          created_by: user.id,
        })
        .select()
        .single()
      if (expErr) throw expErr

      const participants = members.filter((m) => m.status === 'accepted' && m.user_id !== expensePaidBy)
      if (participants.length > 0) {
        const shares = splitEvenly(amount, participants.length)
        const { error: splitErr } = await supabase.from('expense_splits').insert(
          participants.map((p, i) => ({ expense_id: expense.id, user_id: p.user_id, share: shares[i] })),
        )
        if (splitErr) throw splitErr

        notifyUsers({
          userIds: participants.map((p) => p.user_id),
          actorId: user.id,
          type: 'expense_new',
          title: 'Nuova spesa',
          body: `${displayNameOf(membersById[user.id]?.profile)} ha aggiunto "${expense.description}" (${amount.toFixed(2)}€)`,
          link: `/chat/${id}`,
          conversationId: id,
        })
      }

      setShowExpenseForm(false)
      loadExpenses()
    } catch (err) {
      setError(err.message || 'Creazione spesa non riuscita')
    } finally {
      setSavingExpense(false)
    }
  }

  const toggleSplitPaid = async (split) => {
    const { error: err } = await supabase
      .from('expense_splits')
      .update({ paid: !split.paid })
      .eq('id', split.id)
    if (err) {
      setError(err.message)
      return
    }
    setExpenseSplits((prev) => ({
      ...prev,
      [split.expense_id]: (prev[split.expense_id] || []).map((s) =>
        s.id === split.id ? { ...s, paid: !s.paid } : s,
      ),
    }))
  }

  const toggleExpanded = (expenseId) => {
    setExpandedExpenseIds((prev) => {
      const next = new Set(prev)
      if (next.has(expenseId)) next.delete(expenseId)
      else next.add(expenseId)
      return next
    })
  }

  const isExpenseSettled = (exp) => {
    const splits = expenseSplits[exp.id] || []
    return splits.length === 0 || splits.every((s) => s.paid)
  }

  const openExpenses = expenses.filter((e) => !isExpenseSettled(e))
  const archivedExpenses = expenses.filter((e) => isExpenseSettled(e))
  const visibleExpenses = expenseView === 'open' ? openExpenses : archivedExpenses

  const expensesById = Object.fromEntries(expenses.map((e) => [e.id, e]))
  const allOpenSplits = openExpenses.flatMap((e) => expenseSplits[e.id] || [])
  const settlementTxns = openExpenses.length > 1 ? simplifyDebts(expensesById, allOpenSplits) : []

  // salda dal riepilogo: marca come pagate le quote reali (non ancora saldate)
  // che il debitore deve per le spese effettivamente pagate dal creditore della riga
  const settleSummaryTxn = async (txn) => {
    const targets = openExpenses
      .filter((e) => e.paid_by === txn.to)
      .flatMap((e) => (expenseSplits[e.id] || []).filter((s) => s.user_id === txn.from && !s.paid))
    if (targets.length === 0) return

    const { data: updated, error: err } = await supabase
      .from('expense_splits')
      .update({ paid: true })
      .in('id', targets.map((s) => s.id))
      .select()
    if (err) {
      setError(err.message)
      return
    }
    setExpenseSplits((prev) => {
      const next = { ...prev }
      ;(updated || []).forEach((u) => {
        next[u.expense_id] = (next[u.expense_id] || []).map((s) => (s.id === u.id ? u : s))
      })
      return next
    })
  }

  const memberUsernames = new Set(members.map((m) => m.profile?.username).filter(Boolean))

  function extractMentionedUserIds(content) {
    if (!content) return []
    const usernames = Array.from(content.matchAll(/@([a-zA-Z0-9_.]+)/g)).map((m) => m[1])
    const ids = new Set()
    members.forEach((m) => {
      if (m.profile?.username && usernames.includes(m.profile.username)) ids.add(m.user_id)
    })
    return Array.from(ids)
  }

  const mentionMatches = mentionQuery === null
    ? []
    : members
        .filter((m) => m.user_id !== user.id && m.profile?.username?.toLowerCase().startsWith(mentionQuery.toLowerCase()))
        .slice(0, 5)

  function renderWithMentions(content) {
    if (!content) return content
    return content.split(/(@[a-zA-Z0-9_.]+)/g).map((part, i) =>
      part.startsWith('@') && memberUsernames.has(part.slice(1)) ? (
        <span key={i} className="chat-mention">
          {part}
        </span>
      ) : (
        <span key={i}>{part}</span>
      ),
    )
  }

  if (loading) {
    return <div className="chat-room-loading">Caricamento…</div>
  }

  if (error && !conversation) {
    return <div className="chat-room-loading alert-error">{error}</div>
  }

  const headerAvatarUrl = isGroup ? groupAvatarSignedUrl : otherProfile?.avatar_url

  return (
    <div className="chat-room">
      <header className="chat-room-header glass-strong">
        <button
          type="button"
          className="chat-title-btn"
          onClick={() => isMember && setShowInfo((v) => !v)}
          disabled={!isMember}
        >
          <Avatar url={headerAvatarUrl} label={title} size={30} />
          <span className="chat-room-title">{title}</span>
        </button>

        {isMember && tab === 'chat' && (
          <button
            type="button"
            className="chat-icon-btn"
            aria-label="Cerca nella chat"
            onClick={() => {
              setChatSearchOpen((v) => !v)
              setChatSearchQuery('')
            }}
          >
            🔍
          </button>
        )}

        {isMember && (
          <div className="chat-header-tabs">
            <button
              type="button"
              className={`chat-tab${tab === 'chat' ? ' is-active' : ''}`}
              onClick={() => setTab('chat')}
            >
              Chat
            </button>
            <button
              type="button"
              className={`chat-tab${tab === 'archivio' ? ' is-active' : ''}`}
              onClick={() => setTab('archivio')}
            >
              Archivio
            </button>
            <button
              type="button"
              className={`chat-tab${tab === 'split' ? ' is-active' : ''}`}
              onClick={() => setTab('split')}
            >
              Split
            </button>
            <button
              type="button"
              className={`chat-tab${tab === 'eventi' ? ' is-active' : ''}`}
              onClick={() => setTab('eventi')}
            >
              Eventi
            </button>
            <button
              type="button"
              className={`chat-tab${tab === 'bacheca' ? ' is-active' : ''}`}
              onClick={() => setTab('bacheca')}
            >
              Bacheca
            </button>
          </div>
        )}
      </header>

      {myStatus === 'invited' && (
        <div className="chat-invite-gate">
          <div className="chat-invite-card glass-strong">
            <p>Sei stato invitato a questa conversazione.</p>
            <div className="chat-invite-actions">
              <button type="button" className="btn btn-primary" onClick={() => respondInvite(true)}>
                Accetta
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => respondInvite(false)}>
                Rifiuta
              </button>
            </div>
          </div>
        </div>
      )}

      {isMember && showInfo && (
        <div className="chat-info-overlay" onClick={() => setShowInfo(false)}>
          <div className="chat-info-panel glass-strong" onClick={(e) => e.stopPropagation()}>
            <div className="chat-info-topbar">
              <span className="chat-info-topbar-label">Info conversazione</span>
              <button
                type="button"
                className="chat-info-close"
                onClick={() => setShowInfo(false)}
                aria-label="Chiudi"
              >
                ×
              </button>
            </div>
            <div className="chat-info-head">
              <button
                type="button"
                className="chat-info-avatar"
                onClick={() => isGroup && avatarInputRef.current?.click()}
                disabled={!isGroup}
              >
                <Avatar url={headerAvatarUrl} label={title} size={64} />
                {isGroup && (
                  <span className="chat-info-avatar-edit">
                    <CameraIcon />
                  </span>
                )}
              </button>
              {isGroup && (
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={uploadAvatarProposal}
                />
              )}

              <span className="chat-info-direct-name">{title}</span>
              {uploadingAvatar && <p className="profile-hint">Caricamento immagine…</p>}
            </div>

            {isGroup && mood && (
              <div className="chat-mood-pill">
                {mood.mood_emoji} Umore del gruppo: {mood.mood_label}
              </div>
            )}

            {isGroup && (
              <div className="chat-proposal-section">
                <p className="chat-info-members-title">Proposte di gruppo</p>
                <p className="chat-proposal-hint">
                  Rinominare, cambiare foto o eliminare il gruppo richiede il voto della maggioranza dei membri.
                </p>

                {proposals.map((p) => {
                  const options = proposalOptions.filter((o) => o.proposal_id === p.id)
                  const myVote = proposalVotes.find((v) => v.proposal_id === p.id && v.voter_id === user.id)
                  const titleByType = {
                    rename: 'Proposta: cambio nome',
                    avatar: 'Proposta: cambio foto',
                    delete: 'Proposta: eliminazione gruppo',
                  }
                  return (
                    <div key={p.id} className="chat-proposal-card">
                      <p className="chat-proposal-title">{titleByType[p.type]}</p>
                      {options.map((o) => {
                        const count = proposalVotes.filter(
                          (v) => v.proposal_id === p.id && v.option_id === o.id,
                        ).length
                        const isMine = myVote?.option_id === o.id
                        return (
                          <div key={o.id} className="chat-proposal-option">
                            {p.type === 'avatar' && <ProposalAvatarThumb path={o.value} />}
                            <span className="chat-proposal-option-label">{o.label}</span>
                            <span className="chat-proposal-option-count">{count}</span>
                            <button
                              type="button"
                              className={`chat-vote-btn${isMine ? ' is-active' : ''}`}
                              onClick={() => castProposalVote(p.id, o.id)}
                            >
                              {isMine ? 'Votato ✓' : 'Vota'}
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )
                })}

                <form className="chat-info-name-form" onSubmit={submitNameProposal}>
                  <input
                    type="text"
                    className="input"
                    value={nameProposalDraft}
                    onChange={(e) => setNameProposalDraft(e.target.value)}
                    placeholder="Proponi un nuovo nome…"
                  />
                  <button type="submit" className="btn btn-secondary" disabled={!nameProposalDraft.trim()}>
                    Proponi
                  </button>
                </form>

                <div className="chat-proposal-actions">
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => avatarInputRef.current?.click()}
                  >
                    Proponi nuova foto
                  </button>
                  {!openProposalOfType('delete') && (
                    <button type="button" className="chat-ban-btn" onClick={proposeDeleteGroup}>
                      Proponi eliminazione gruppo
                    </button>
                  )}
                </div>
              </div>
            )}

            <button type="button" className="btn btn-ghost btn-block" onClick={toggleMute}>
              {membersById[user.id]?.muted ? '🔔 Riattiva notifiche' : '🔕 Silenzia notifiche'}
            </button>

            {trashedMessages.length > 0 && (
              <div className="chat-trash-section">
                <p className="chat-info-members-title">🗑 Cestino (si svuota a fine giornata)</p>
                {trashedMessages.map((m) => (
                  <div key={m.id} className="chat-trash-row">
                    <span className="chat-trash-content">{m.content}</span>
                    <button type="button" className="chat-vote-btn" onClick={() => restoreTextMessage(m.id)}>
                      Ripristina
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isGroup && (
              <button type="button" className="btn btn-ghost btn-block chat-leave-btn" onClick={leaveGroup}>
                Esci dal gruppo
              </button>
            )}

            <div className="chat-info-members-head">
              <p className="chat-info-members-title">Membri · {members.length}</p>
              {isGroup && (
                <button
                  type="button"
                  className="chat-invite-friends-btn"
                  onClick={() => setShowInviteFriends((v) => !v)}
                >
                  + Invita amici
                </button>
              )}
            </div>

            {showInviteFriends && (
              <div className="chat-invite-friends-list">
                {invitableFriends.length === 0 && (
                  <p className="chat-empty-hint">
                    Nessun amico da invitare: o sono già dentro, o devi farne altri.
                  </p>
                )}
                {invitableFriends.map(({ profile: p }) => (
                  <button
                    key={p.id}
                    type="button"
                    className="chat-invite-friend-row"
                    disabled={invitingId === p.id}
                    onClick={() => inviteFriend(p.id)}
                  >
                    <Avatar url={p.avatar_url} label={displayNameOf(p)} size={30} />
                    <span>{displayNameOf(p)}</span>
                    <span className="chat-invite-friend-action">
                      {invitingId === p.id ? '…' : 'Invita'}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {members.map((m) => (
              <div key={m.user_id} className="chat-member-block">
                <div className="chat-member-row">
                  <Avatar
                    url={m.profile?.avatar_url}
                    label={displayNameOf(m.profile)}
                    color={membersById[m.user_id]?.effectiveColor}
                    size={32}
                  />
                  <span className="chat-member-name">{displayNameOf(m.profile)}</span>
                  <span className="chat-member-status">{m.status}</span>
                  <button
                    type="button"
                    className="chat-member-color-dot"
                    style={{ background: membersById[m.user_id]?.effectiveColor }}
                    aria-label="Scegli colore"
                    onClick={() => setColorPickerFor((v) => (v === m.user_id ? null : m.user_id))}
                  />
                  {isGroup && m.user_id !== user.id && m.status === 'accepted' && (
                    <button type="button" className="chat-ban-btn" onClick={() => requestBan(m.user_id)}>
                      Richiedi ban
                    </button>
                  )}
                </div>
                {colorPickerFor === m.user_id && (
                  <div className="chat-color-palette">
                    {MEMBER_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        className="chat-color-swatch"
                        style={{ background: c }}
                        aria-label={c}
                        onClick={() => setMemberColor(m.user_id, c)}
                      />
                    ))}
                    <button
                      type="button"
                      className="chat-color-swatch chat-color-swatch-reset"
                      aria-label="Rimuovi colore"
                      onClick={() => setMemberColor(m.user_id, null)}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            ))}

            {isGroup && banRequests.length > 0 && (
              <div className="chat-ban-list">
                <p className="chat-ban-list-title">Richieste di ban in corso</p>
                {banRequests.map((r) => {
                  const targetProfile = members.find((m) => m.user_id === r.target_user_id)?.profile
                  const votesFor = banVotes.filter((v) => v.request_id === r.id && v.vote).length
                  const votesAgainst = banVotes.filter((v) => v.request_id === r.id && !v.vote).length
                  const myVote = banVotes.find((v) => v.request_id === r.id && v.voter_id === user.id)
                  const canVote = r.target_user_id !== user.id
                  return (
                    <div key={r.id} className="chat-ban-row">
                      <span>{displayNameOf(targetProfile)}</span>
                      <span className="chat-ban-counts">
                        👍 {votesFor} · 👎 {votesAgainst}
                      </span>
                      {canVote && (
                        <div className="chat-ban-vote-actions">
                          <button
                            type="button"
                            className={`chat-vote-btn${myVote?.vote === true ? ' is-active' : ''}`}
                            onClick={() => castVote(r.id, true)}
                          >
                            Favore
                          </button>
                          <button
                            type="button"
                            className={`chat-vote-btn${myVote?.vote === false ? ' is-active' : ''}`}
                            onClick={() => castVote(r.id, false)}
                          >
                            Contro
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {isMember && error && <div className="alert-error chat-inline-error">{error}</div>}

      {isMember && tab === 'chat' && (
        <>
          {chatSearchOpen && (
            <div className="chat-search-bar glass">
              <input
                type="text"
                className="input"
                placeholder="Cerca nei messaggi…"
                value={chatSearchQuery}
                onChange={(e) => setChatSearchQuery(e.target.value)}
                autoFocus
              />
              {chatSearchQuery.trim() && (
                <span className="chat-search-count">{visibleChatMessages.length}</span>
              )}
            </div>
          )}

          {polls.length > 0 && (
            <div className="chat-polls">
              {polls.map((poll) => {
                const options = pollOptions.filter((o) => o.poll_id === poll.id)
                const totalVotes = pollVotes.filter((v) => v.poll_id === poll.id).length
                const myVote = pollVotes.find((v) => v.poll_id === poll.id && v.voter_id === user.id)
                return (
                  <div key={poll.id} className="chat-poll-card glass">
                    <div className="chat-poll-head">
                      <span className="chat-poll-question">📊 {poll.question}</span>
                      {poll.created_by === user.id && (
                        <button type="button" className="chat-poll-close" onClick={() => closePoll(poll.id)}>
                          Chiudi
                        </button>
                      )}
                    </div>
                    {options.map((o) => {
                      const count = pollVotes.filter((v) => v.poll_id === poll.id && v.option_id === o.id).length
                      const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0
                      const isMine = myVote?.option_id === o.id
                      return (
                        <button
                          key={o.id}
                          type="button"
                          className={`chat-poll-option${isMine ? ' is-mine' : ''}`}
                          onClick={() => votePoll(poll.id, o.id)}
                        >
                          <span className="chat-poll-option-bar" style={{ width: `${pct}%` }} />
                          <span className="chat-poll-option-label">{o.label}</span>
                          <span className="chat-poll-option-count">
                            {count} {totalVotes > 0 ? `(${pct}%)` : ''}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          <div className="chat-messages" ref={scrollRef}>
            {visibleChatMessages.map((m) => {
              if (m.type === 'system') {
                return (
                  <div key={m.id} className="chat-system-message">
                    {m.content}
                  </div>
                )
              }
              const mine = m.sender_id === user.id
              const media = mediaByMsg[m.id]
              const member = membersById[m.sender_id]
              const profile = member?.profile
              const color = member?.effectiveColor
              const name = mine ? 'Tu' : displayNameOf(profile)
              const time = new Date(m.created_at).toLocaleTimeString('it-IT', {
                hour: '2-digit',
                minute: '2-digit',
              })
              const reactions = reactionsByMessage[m.id] || []
              const reactionGroups = {}
              reactions.forEach((r) => {
                reactionGroups[r.emoji] = reactionGroups[r.emoji] || []
                reactionGroups[r.emoji].push(r)
              })
              const repliedTo = m.reply_to_id ? messagesById[m.reply_to_id] : null
              const repliedMember = repliedTo ? membersById[repliedTo.sender_id] : null
              return (
                <div key={m.id} className={`chat-bubble-row${mine ? ' is-mine' : ''}`}>
                  <div className="chat-bubble-avatar">
                    <Avatar url={profile?.avatar_url} label={name} color={color} size={40} />
                  </div>
                  <div className="chat-bubble-col">
                    <div
                      className={`chat-bubble glass${mine ? ' is-mine' : ''}`}
                      onPointerDown={() => startLongPress(m.id)}
                      onPointerUp={cancelLongPress}
                      onPointerLeave={cancelLongPress}
                      onPointerCancel={cancelLongPress}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        setActionMenuFor(m.id)
                      }}
                      onClick={(e) => {
                        if (longPressFired.current) e.preventDefault()
                      }}
                    >
                      <div className="chat-bubble-meta">
                        <span className="chat-bubble-name" style={color ? { color } : undefined}>
                          {name}
                        </span>
                        <span className="chat-bubble-time">{time}</span>
                      </div>
                      {repliedTo && (
                        <div className="chat-reply-quote">
                          <span className="chat-reply-quote-name">{displayNameOf(repliedMember?.profile)}</span>
                          <span className="chat-reply-quote-snippet">
                            {repliedTo.type === 'text' ? repliedTo.content : mediaLabel(repliedTo.type)}
                          </span>
                        </div>
                      )}
                      {m.type === 'text' && (
                        <span className="chat-bubble-content">
                          {renderWithMentions(m.content)}
                          {m.edited_at && <span className="chat-bubble-edited"> (modificato)</span>}
                        </span>
                      )}
                      {m.type !== 'text' && media && (media.type === 'image' || media.type === 'video') && (
                        <div
                          className="chat-media-open"
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            setViewerMedia(media)
                          }}
                          onKeyDown={(e) => e.key === 'Enter' && setViewerMedia(media)}
                        >
                          <MediaBubble media={media} />
                        </div>
                      )}
                      {m.type !== 'text' && media && media.type === 'audio' && <MediaBubble media={media} />}
                      {m.type !== 'text' && !media && <span className="media-bubble-loading">…</span>}
                    </div>
                    {reactions.length > 0 && (
                      <div className={`chat-reaction-row${mine ? ' is-mine' : ''}`}>
                        {Object.entries(reactionGroups).map(([emoji, list]) => (
                          <button
                            key={emoji}
                            type="button"
                            className={`chat-reaction-pill${list.some((r) => r.user_id === user.id) ? ' is-mine' : ''}`}
                            onClick={() => toggleReaction(m.id, emoji)}
                          >
                            {emoji} {list.length}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
            {messages.length === 0 && !chatSearchQueryTrimmed && (
              <p className="chat-empty-hint">Nessun messaggio ancora. Scrivi il primo!</p>
            )}
            {chatSearchQueryTrimmed && visibleChatMessages.length === 0 && (
              <p className="chat-empty-hint">Nessun risultato per "{chatSearchQuery.trim()}"</p>
            )}
          </div>

          {actionMenuFor && (
            <div className="chat-action-overlay" onClick={() => setActionMenuFor(null)}>
              <div className="chat-action-sheet glass-strong" onClick={(e) => e.stopPropagation()}>
                <div className="chat-action-emojis">
                  {QUICK_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="chat-action-emoji"
                      onClick={() => toggleReaction(actionMenuFor, emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                  <button
                    type="button"
                    className="chat-action-emoji chat-action-emoji-more"
                    aria-label="Altre emoji"
                    onClick={() => {
                      setCustomEmojiOpen(true)
                      requestAnimationFrame(() => customEmojiInputRef.current?.focus())
                    }}
                  >
                    +
                  </button>
                </div>
                {customEmojiOpen && (
                  <form
                    className="chat-custom-emoji-form"
                    onSubmit={(e) => {
                      e.preventDefault()
                      const value = customEmojiValue.trim()
                      if (value) toggleReaction(actionMenuFor, value)
                    }}
                  >
                    <input
                      ref={customEmojiInputRef}
                      type="text"
                      className="input chat-custom-emoji-input"
                      placeholder="Apri la tastiera emoji del telefono…"
                      value={customEmojiValue}
                      onChange={(e) => setCustomEmojiValue(e.target.value)}
                    />
                    <button type="submit" className="btn btn-secondary" disabled={!customEmojiValue.trim()}>
                      Usa
                    </button>
                  </form>
                )}
                <button type="button" className="chat-action-item" onClick={() => startReply(actionMenuFor)}>
                  ↩ Rispondi
                </button>
                <button
                  type="button"
                  className="chat-action-item"
                  onClick={() => {
                    setForwardSheetFor(actionMenuFor)
                    setActionMenuFor(null)
                  }}
                >
                  ➦ Inoltra
                </button>
                {(() => {
                  const existingPin = pins.find((p) => p.message_id === actionMenuFor)
                  if (existingPin && existingPin.pinned_by !== user.id) return null
                  return (
                    <button type="button" className="chat-action-item" onClick={() => togglePin(actionMenuFor)}>
                      {existingPin ? '📌 Rimuovi dalla bacheca' : '📌 Pin nella bacheca'}
                    </button>
                  )
                })()}
                {messagesById[actionMenuFor]?.sender_id === user.id &&
                  messagesById[actionMenuFor]?.type === 'text' && (
                    <button type="button" className="chat-action-item" onClick={() => startEdit(actionMenuFor)}>
                      ✎ Modifica
                    </button>
                  )}
                {messagesById[actionMenuFor]?.sender_id === user.id && (
                  <button
                    type="button"
                    className="chat-action-item chat-action-item-danger"
                    onClick={() => {
                      const targetId = actionMenuFor
                      const media = mediaByMsg[targetId]
                      setActionMenuFor(null)
                      if (!window.confirm('Eliminare definitivamente questo messaggio?')) return
                      if (media) deleteMedia(media)
                      else deleteTextMessage(targetId)
                    }}
                  >
                    🗑 Elimina
                  </button>
                )}
              </div>
            </div>
          )}

          {forwardSheetFor && (
            <div className="chat-action-overlay" onClick={() => setForwardSheetFor(null)}>
              <div className="chat-action-sheet glass-strong" onClick={(e) => e.stopPropagation()}>
                <p className="chat-info-topbar-label">Inoltra a…</p>
                {forwardDone && <div className="alert-success">Inoltrato ✓</div>}
                {!forwardDone && forwardTargets.length === 0 && (
                  <p className="chat-empty-hint">Nessun'altra conversazione disponibile.</p>
                )}
                {!forwardDone &&
                  forwardTargets.map((c) => (
                    <button
                      key={c.conversation_id}
                      type="button"
                      className="chat-forward-target"
                      disabled={forwarding}
                      onClick={() => forwardMessage(forwardSheetFor, c.conversation_id)}
                    >
                      <Avatar
                        url={c.otherProfile?.avatar_url}
                        label={conversationTitle(c.conversation, c.otherProfile)}
                        size={32}
                      />
                      <span>{conversationTitle(c.conversation, c.otherProfile)}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}

          {showPollForm && (
            <div className="chat-action-overlay" onClick={resetPollForm}>
              <div className="chat-action-sheet glass-strong" onClick={(e) => e.stopPropagation()}>
                <p className="chat-info-topbar-label">Nuovo sondaggio</p>
                <form className="chat-poll-form" onSubmit={createPoll}>
                  <input
                    type="text"
                    className="input"
                    placeholder="Domanda…"
                    value={pollQuestion}
                    onChange={(e) => setPollQuestion(e.target.value)}
                    autoFocus
                  />
                  {pollOptionInputs.map((value, i) => (
                    <input
                      key={i}
                      type="text"
                      className="input"
                      placeholder={`Opzione ${i + 1}`}
                      value={value}
                      onChange={(e) => {
                        const next = [...pollOptionInputs]
                        next[i] = e.target.value
                        setPollOptionInputs(next)
                      }}
                    />
                  ))}
                  {pollOptionInputs.length < 6 && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setPollOptionInputs((prev) => [...prev, ''])}
                    >
                      + Aggiungi opzione
                    </button>
                  )}
                  <div className="expense-form-actions">
                    <button type="button" className="btn btn-ghost" onClick={resetPollForm}>
                      Annulla
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={!pollQuestion.trim() || pollOptionInputs.filter((o) => o.trim()).length < 2}
                    >
                      Crea sondaggio
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {Object.keys(typingUsers).length > 0 && (
            <p className="chat-typing-hint">
              {Object.values(typingUsers).join(', ')}{' '}
              {Object.keys(typingUsers).length === 1 ? 'sta scrivendo…' : 'stanno scrivendo…'}
            </p>
          )}

          {editingMessage && (
            <div className="chat-reply-bar glass">
              <div className="chat-reply-bar-info">
                <span className="chat-reply-bar-name">Modifica messaggio</span>
                <span className="chat-reply-bar-snippet">{editingMessage.content}</span>
              </div>
              <button type="button" className="chat-reply-bar-close" onClick={cancelEdit}>
                ×
              </button>
            </div>
          )}

          {replyTo && !editingMessage && (
            <div className="chat-reply-bar glass">
              <div className="chat-reply-bar-info">
                <span className="chat-reply-bar-name">
                  {replyTo.sender_id === user.id ? 'Tu' : displayNameOf(membersById[replyTo.sender_id]?.profile)}
                </span>
                <span className="chat-reply-bar-snippet">
                  {replyTo.type === 'text' ? replyTo.content : mediaLabel(replyTo.type)}
                </span>
              </div>
              <button type="button" className="chat-reply-bar-close" onClick={() => setReplyTo(null)}>
                ×
              </button>
            </div>
          )}

          {mentionQuery !== null && mentionMatches.length > 0 && (
            <div className="chat-mention-list glass-strong">
              {mentionMatches.map((m) => (
                <button
                  key={m.user_id}
                  type="button"
                  className="chat-mention-item"
                  onClick={() => selectMention(m.profile.username)}
                >
                  <Avatar url={m.profile?.avatar_url} label={displayNameOf(m.profile)} size={26} />
                  <span>{displayNameOf(m.profile)}</span>
                  <span className="chat-mention-username">@{m.profile.username}</span>
                </button>
              ))}
            </div>
          )}

          <form className="chat-composer glass-strong" onSubmit={sendText}>
            <input ref={fileInputRef} type="file" accept="image/*,video/*" hidden onChange={handleFilePick} />
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Allega immagine o video"
              disabled={!isOnline}
            >
              <ImageIcon />
            </button>
            <button
              type="button"
              className={`chat-icon-btn${recording ? ' is-recording' : ''}`}
              onClick={toggleRecording}
              aria-label="Registra audio"
              disabled={!isOnline}
            >
              <MicIcon active={recording} />
            </button>
            <button
              type="button"
              className="chat-icon-btn"
              onClick={() => setShowPollForm(true)}
              aria-label="Crea sondaggio"
              disabled={!isOnline}
            >
              📊
            </button>
            <input
              ref={composerInputRef}
              type="text"
              className="chat-composer-input"
              placeholder={isOnline ? 'Scrivi un messaggio…' : 'Sei offline…'}
              value={text}
              onChange={handleTextChange}
              disabled={!isOnline}
            />
            <button
              type="submit"
              className="chat-icon-btn chat-send-btn"
              disabled={sending || !text.trim() || !isOnline}
            >
              <SendIcon />
            </button>
          </form>
        </>
      )}

      {isMember && tab === 'archivio' && (
        <div className="chat-archive">
          <div className="chat-folder-chips">
            <button
              type="button"
              className={`chat-folder-chip${!activeFolderId ? ' is-active' : ''}`}
              onClick={() => setActiveFolderId(null)}
            >
              Tutti
            </button>
            {folders.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`chat-folder-chip${activeFolderId === f.id ? ' is-active' : ''}`}
                onClick={() => setActiveFolderId(f.id)}
              >
                {f.name}
              </button>
            ))}
          </div>

          <form className="chat-new-folder" onSubmit={createFolder}>
            <input
              type="text"
              className="input"
              placeholder="Nuova cartella…"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary">
              Crea
            </button>
          </form>

          <div className="chat-media-grid">
            {visibleMedia.map((m) => (
              <div key={m.id} className="chat-media-tile">
                <div
                  className="chat-media-open chat-media-thumb"
                  role="button"
                  tabIndex={0}
                  onClick={() => setViewerMedia(m)}
                  onKeyDown={(e) => e.key === 'Enter' && setViewerMedia(m)}
                >
                  <MediaBubble media={m} />
                </div>
                <div className="chat-media-actions">
                  <button
                    type="button"
                    className="chat-media-action-icon"
                    aria-label="Download"
                    title="Download"
                    onClick={() => downloadMedia(m)}
                  >
                    ⬇️
                  </button>

                  <div className="chat-media-move">
                    <button
                      type="button"
                      className="chat-media-action-move"
                      onClick={() => setMoveMenuFor(moveMenuFor === m.id ? null : m.id)}
                    >
                      SPOSTA
                    </button>
                    {moveMenuFor === m.id && (
                      <>
                        <div className="chat-media-move-backdrop" onClick={() => setMoveMenuFor(null)} />
                        <div className="chat-media-move-menu glass-strong">
                          <button
                            type="button"
                            className="chat-media-move-option"
                            onClick={() => moveToFolder(m.id, null)}
                          >
                            Nessuna cartella
                          </button>
                          {folders.map((f) => (
                            <button
                              key={f.id}
                              type="button"
                              className="chat-media-move-option"
                              onClick={() => moveToFolder(m.id, f.id)}
                            >
                              📁 {f.name}
                            </button>
                          ))}
                          <div className="chat-media-move-create">
                            <input
                              type="text"
                              className="input"
                              placeholder="Crea cartella…"
                              value={moveNewFolderName}
                              onChange={(e) => setMoveNewFolderName(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-secondary"
                              disabled={!moveNewFolderName.trim()}
                              onClick={() => createFolderAndMove(m.id)}
                            >
                              + Crea cartella
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  <button
                    type="button"
                    className="chat-media-action-icon chat-media-action-danger"
                    aria-label="Elimina"
                    title="Elimina"
                    onClick={() => {
                      if (window.confirm('Eliminare definitivamente questo media?')) deleteMedia(m)
                    }}
                  >
                    🗑
                  </button>
                </div>
              </div>
            ))}
            {visibleMedia.length === 0 && <p className="chat-empty-hint">Nessun media qui.</p>}
          </div>
        </div>
      )}

      {isMember && tab === 'split' && (
        <div className="chat-split">
          {!showExpenseForm && (
            <button type="button" className="btn btn-primary" onClick={openExpenseForm}>
              + Nuova spesa
            </button>
          )}

          {showExpenseForm && (
            <form className="expense-form glass" onSubmit={createExpense}>
              <div className="field">
                <label htmlFor="expense-desc">Nome</label>
                <input
                  id="expense-desc"
                  type="text"
                  className="input"
                  placeholder="Es. Cena pizza"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="expense-amount">Importo (€)</label>
                <input
                  id="expense-amount"
                  type="text"
                  inputMode="decimal"
                  className="input"
                  placeholder="0.00"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="expense-date">Data</label>
                <input
                  id="expense-date"
                  type="date"
                  className="input"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="expense-paid-by">Pagato da</label>
                <select
                  id="expense-paid-by"
                  className="input"
                  value={expensePaidBy}
                  onChange={(e) => setExpensePaidBy(e.target.value)}
                >
                  {members
                    .filter((m) => m.status === 'accepted')
                    .map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.user_id === user.id ? 'Tu' : displayNameOf(m.profile)}
                      </option>
                    ))}
                </select>
              </div>
              <p className="expense-form-hint">
                Verrà divisa automaticamente tra gli altri {Math.max(members.filter((m) => m.status === 'accepted').length - 1, 0)} partecipanti.
              </p>
              <div className="expense-form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowExpenseForm(false)}>
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingExpense || !expenseDesc.trim() || !expenseAmount}
                >
                  {savingExpense ? 'Salvataggio…' : 'Crea spesa'}
                </button>
              </div>
            </form>
          )}

          <div className="chat-folder-chips">
            <button
              type="button"
              className={`chat-folder-chip${expenseView === 'open' ? ' is-active' : ''}`}
              onClick={() => setExpenseView('open')}
            >
              Aperti ({openExpenses.length})
            </button>
            <button
              type="button"
              className={`chat-folder-chip${expenseView === 'archived' ? ' is-active' : ''}`}
              onClick={() => setExpenseView('archived')}
            >
              Archiviati ({archivedExpenses.length})
            </button>
          </div>

          {expenseView === 'open' && openExpenses.length > 1 && (
            <div className="expense-summary-card glass-strong">
              <p className="expense-summary-title">Riepilogo</p>
              <p className="expense-summary-desc">
                Include: {openExpenses.map((e) => e.description).join(', ')}
              </p>
              <div className="expense-summary-txns">
                {settlementTxns.map((t, i) => (
                  <button
                    key={i}
                    type="button"
                    className="expense-summary-txn"
                    onClick={() => settleSummaryTxn(t)}
                  >
                    <span className="expense-split-check">✓</span>
                    <span className="expense-summary-names">
                      {t.from === user.id ? 'Tu' : displayNameOf(membersById[t.from]?.profile)}
                      {' → '}
                      {t.to === user.id ? 'Tu' : displayNameOf(membersById[t.to]?.profile)}
                    </span>
                    <span className="expense-summary-amount">{formatEuro(t.amount)}</span>
                  </button>
                ))}
                {settlementTxns.length === 0 && <p className="chat-empty-hint">Tutti in pari.</p>}
              </div>
            </div>
          )}

          <div className="expense-list">
            {visibleExpenses.map((exp) => {
              const splits = expenseSplits[exp.id] || []
              const payerProfile = membersById[exp.paid_by]?.profile
              const isCreator = exp.created_by === user.id
              const expanded = expandedExpenseIds.has(exp.id)
              const settled = isExpenseSettled(exp)
              return (
                <div key={exp.id} className={`expense-card glass${settled ? ' is-settled' : ''}`}>
                  <button
                    type="button"
                    className="expense-card-head"
                    onClick={() => toggleExpanded(exp.id)}
                    aria-expanded={expanded}
                  >
                    <span className={`expense-card-chevron${expanded ? ' is-open' : ''}`}>▸</span>
                    <span className="expense-card-desc">{exp.description}</span>
                    {settled && <span className="expense-card-settled-badge">Saldato</span>}
                    <span className="expense-card-amount">{formatEuro(exp.amount)}</span>
                  </button>
                  {expanded && (
                    <>
                      <div className="expense-card-meta">
                        <span>{new Date(exp.expense_date).toLocaleDateString('it-IT')}</span>
                        <span>Pagato da {exp.paid_by === user.id ? 'te' : displayNameOf(payerProfile)}</span>
                      </div>
                      {splits.length > 0 && (
                        <div className="expense-split-list">
                          {splits.map((s) => {
                            const p = membersById[s.user_id]?.profile
                            return (
                              <button
                                key={s.id}
                                type="button"
                                className={`expense-split-row${s.paid ? ' is-paid' : ''}`}
                                disabled={!isCreator}
                                onClick={() => toggleSplitPaid(s)}
                              >
                                <span className="expense-split-check">{s.paid ? '✓' : ''}</span>
                                <span className="expense-split-name">
                                  {s.user_id === user.id ? 'Tu' : displayNameOf(p)}
                                </span>
                                <span className="expense-split-share">{formatEuro(s.share)}</span>
                              </button>
                            )
                          })}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {visibleExpenses.length === 0 && !showExpenseForm && (
              <p className="chat-empty-hint">
                {expenseView === 'open' ? 'Nessuna spesa aperta.' : 'Nessuna spesa archiviata.'}
              </p>
            )}
          </div>
        </div>
      )}

      {isMember && tab === 'eventi' && (
        <div className="chat-split">
          {!showEventForm && (
            <button type="button" className="btn btn-primary" onClick={openEventForm}>
              + Nuovo evento
            </button>
          )}

          {showEventForm && (
            <form className="expense-form glass" onSubmit={createEvent}>
              <div className="field">
                <label htmlFor="event-name">Nome</label>
                <input
                  id="event-name"
                  type="text"
                  className="input"
                  placeholder="Es. Weekend al mare"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="event-start">Inizio (opzionale)</label>
                <input
                  id="event-start"
                  type="date"
                  className="input"
                  value={eventStart}
                  onChange={(e) => setEventStart(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="event-end">Fine (opzionale)</label>
                <input
                  id="event-end"
                  type="date"
                  className="input"
                  value={eventEnd}
                  onChange={(e) => setEventEnd(e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="event-location">Luogo (opzionale)</label>
                <input
                  id="event-location"
                  type="text"
                  className="input"
                  placeholder="Es. Rimini"
                  value={eventLocation}
                  onChange={(e) => setEventLocation(e.target.value)}
                />
              </div>
              <div className="field">
                <label>Partecipanti</label>
                <div className="event-participant-picker">
                  {members
                    .filter((m) => m.status === 'accepted')
                    .map((m) => (
                      <button
                        key={m.user_id}
                        type="button"
                        className={`event-participant-chip${eventParticipantIds.has(m.user_id) ? ' is-selected' : ''}`}
                        onClick={() => toggleEventParticipant(m.user_id)}
                      >
                        <Avatar url={m.profile?.avatar_url} label={displayNameOf(m.profile)} size={22} />
                        {m.user_id === user.id ? 'Tu' : displayNameOf(m.profile)}
                      </button>
                    ))}
                </div>
              </div>
              <div className="expense-form-actions">
                <button type="button" className="btn btn-ghost" onClick={() => setShowEventForm(false)}>
                  Annulla
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={savingEvent || !eventName.trim() || eventParticipantIds.size === 0}
                >
                  {savingEvent ? 'Creazione…' : 'Crea evento'}
                </button>
              </div>
            </form>
          )}

          <div className="expense-list">
            {events.map((ev) => {
              const participantIds = eventParticipantsMap[ev.id] || []
              const expanded = expandedEventIds.has(ev.id)
              const iAmParticipant = participantIds.includes(user.id)
              return (
                <div key={ev.id} className="expense-card glass">
                  <button
                    type="button"
                    className="expense-card-head"
                    onClick={() => toggleExpandedEvent(ev.id)}
                    aria-expanded={expanded}
                  >
                    <span className={`expense-card-chevron${expanded ? ' is-open' : ''}`}>▸</span>
                    <span className="expense-card-desc">{ev.name}</span>
                    <span className="expense-card-amount">{participantIds.length}👤</span>
                  </button>
                  {expanded && (
                    <>
                      <div className="expense-card-meta">
                        {ev.start_date && (
                          <span>
                            {new Date(ev.start_date).toLocaleDateString('it-IT')}
                            {ev.end_date ? ` → ${new Date(ev.end_date).toLocaleDateString('it-IT')}` : ''}
                          </span>
                        )}
                        {ev.location && <span>📍 {ev.location}</span>}
                      </div>
                      <div className="expense-split-list">
                        {participantIds.map((uid) => (
                          <div key={uid} className="event-participant-row">
                            <Avatar
                              url={membersById[uid]?.profile?.avatar_url}
                              label={displayNameOf(membersById[uid]?.profile)}
                              size={26}
                            />
                            <span className="expense-split-name">
                              {uid === user.id ? 'Tu' : displayNameOf(membersById[uid]?.profile)}
                            </span>
                          </div>
                        ))}
                      </div>
                      {iAmParticipant && (
                        <button
                          type="button"
                          className="btn btn-primary btn-block"
                          onClick={() => navigate(`/events/${ev.id}/rate`)}
                        >
                          ⭐ Valuta partecipanti
                        </button>
                      )}
                      {ev.created_by === user.id && (
                        <button
                          type="button"
                          className="event-card-delete"
                          onClick={() => {
                            if (window.confirm('Eliminare definitivamente questo evento?')) deleteEvent(ev)
                          }}
                        >
                          🗑 Elimina evento
                        </button>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            {events.length === 0 && !showEventForm && (
              <p className="chat-empty-hint">Nessun evento ancora.</p>
            )}
          </div>
        </div>
      )}

      {isMember && tab === 'bacheca' && (
        <div className="chat-split">
          <div className="chat-bacheca-section">
            <p className="chat-info-members-title">📌 Frasi leggendarie</p>
            {pins.length === 0 && (
              <p className="chat-empty-hint">Nessuna frase pinnata ancora. Tienine d'occhio una buona in chat.</p>
            )}
            {pins.map((p) => {
              const msg = messagesById[p.message_id]
              const sender = membersById[msg?.sender_id]?.profile
              return (
                <div key={p.id} className="chat-pin-card">
                  <p className="chat-pin-content">
                    {msg ? (msg.type === 'text' ? msg.content : mediaLabel(msg.type)) : 'Messaggio non più disponibile'}
                  </p>
                  <div className="chat-pin-meta">
                    <span>{sender ? displayNameOf(sender) : 'Qualcuno'}</span>
                    {p.pinned_by === user.id && (
                      <button type="button" className="chat-pin-remove" onClick={() => unpin(p.id)}>
                        Rimuovi
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          <div className="chat-bacheca-section">
            <p className="chat-info-members-title">⏳ Capsule del tempo</p>
            <p className="chat-proposal-hint">
              Scrivi un messaggio sigillato: nessuno può leggerlo, nemmeno tu, finché non arriva la data che scegli.
            </p>
            {capsules.length === 0 && !showCapsuleForm && <p className="chat-empty-hint">Nessuna capsula ancora.</p>}
            {capsules.map((c) => (
              <div key={c.id} className={`chat-capsule-card${c.is_open ? ' is-open' : ''}`}>
                {c.is_open ? (
                  <>
                    <p className="chat-capsule-content">{c.content}</p>
                    <span className="chat-capsule-meta">
                      Aperta il {new Date(c.opens_at).toLocaleDateString('it-IT')}
                    </span>
                  </>
                ) : (
                  <span className="chat-capsule-meta">
                    🔒 Sigillata, si apre il {new Date(c.opens_at).toLocaleDateString('it-IT')}
                  </span>
                )}
              </div>
            ))}

            {!showCapsuleForm && (
              <button type="button" className="btn btn-ghost" onClick={() => setShowCapsuleForm(true)}>
                + Nuova capsula
              </button>
            )}

            {showCapsuleForm && (
              <form className="chat-capsule-form" onSubmit={createCapsule}>
                <textarea
                  className="input"
                  rows={3}
                  placeholder="Cosa vuoi dire al gruppo del futuro?"
                  value={capsuleContent}
                  onChange={(e) => setCapsuleContent(e.target.value)}
                />
                <input
                  type="date"
                  className="input"
                  value={capsuleDate}
                  min={CAPSULE_MIN_DATE}
                  onChange={(e) => setCapsuleDate(e.target.value)}
                />
                <div className="chat-proposal-actions">
                  <button type="submit" className="btn btn-primary" disabled={!capsuleContent.trim() || !capsuleDate}>
                    Sigilla
                  </button>
                  <button type="button" className="btn btn-ghost" onClick={resetCapsuleForm}>
                    Annulla
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {viewerMedia && (
        <div className="chat-media-viewer-overlay" role="presentation" onClick={() => setViewerMedia(null)}>
          <button type="button" className="chat-media-viewer-close" onClick={() => setViewerMedia(null)}>
            ✕
          </button>
          <div className="chat-media-viewer-content" onClick={(e) => e.stopPropagation()}>
            <MediaBubble media={viewerMedia} />
          </div>
        </div>
      )}
    </div>
  )
}
