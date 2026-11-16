import { notificationTarget } from '../utils/notificationTarget'
import { useCallback, useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { HiFlag } from 'react-icons/hi'
import { AppShell, BlockUserButton, Dialog, Icon, InlineNotice, LoadingRegion, Message, OfferCard, ReportUserDialog, SkeletonBlock, StatePanel, useToast } from '../components'
import { InboxListSkeleton } from '../components/operational/OperationalStates'
import { NavigationBackButton } from '../components/navigation'
import { useAuth } from '../hooks/useAuth'
import { useBargain } from '../hooks/useBargain'
import { useApiResource } from '../hooks/useApiResource'
import { useInfiniteApiResource } from '../hooks/useInfiniteApiResource'
import { useMessaging } from '../hooks/useMessaging'
import { apiPost, apiPut } from '../lib/api'
import { useImagePreviewStore } from '../stores/imagePreviewStore'
import type { ChatConversation, ChatMessage, ChatReactionName, Listing, Notification, User } from '../types/api'
import { getErrorMessage } from '../utils/errorMessage'
import { formatDateTime, formatMoney, getListingImage, initials } from '../utils/format'
import { navigateTo, withBasePath, registerNavigationScrollRegion, setNextNavigationContext, captureNavigationTrigger } from '../utils/navigation'

type InboxChatMessage = ChatMessage & {
  clientMessageId?: string
  deliveryStatus?: 'failed' | 'sending' | 'sent'
  liveReactionVersion?: number
}

type DraftAttachment = {
  file: File
  id: string
  type: 'image' | 'video'
  url: string
}

const CHAT_ATTACHMENT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'])
const CHAT_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024
const CHAT_ATTACHMENT_MAX_FILES = 8

type PaginatedMessages = {
  contactVisible?: boolean
  messages: InboxChatMessage[]
  page: number
  pages: number
  participant?: User | string | null
  total: number
}

type InboxSection = 'inbox' | 'system'

function senderIdValue(sender: User | string | null | undefined): string {
  if (!sender) return ''
  return typeof sender === 'string' ? sender : sender._id
}

function userIdValue(user: User | string | null | undefined): string {
  if (!user) return ''
  return typeof user === 'string' ? user : user._id
}

function isUserProfile(user: User | string | null | undefined): user is User {
  return Boolean(user) && typeof user === 'object'
}

function displayUser(user: User | string | null | undefined) {
  if (!user) return 'Foose member'
  if (typeof user === 'string') return 'Foose member'
  return user.name || user.username || 'Foose member'
}

function displayUsername(user: User | string | null | undefined) {
  if (!user || typeof user === 'string' || !user.username) return ''
  return `@${user.username}`
}

function userPhoto(user: User | string | null | undefined) {
  return user && typeof user === 'object' ? user.profilePhoto : undefined
}

function listingTitle(listing: Listing | string | undefined) {
  if (!listing) return ''
  return typeof listing === 'string' ? '' : listing.title
}

function listingImage(listing: Listing | string | undefined) {
  if (!listing || typeof listing === 'string') return undefined
  return getListingImage(listing)
}

function listingPrice(listing: Listing | string | undefined) {
  if (!listing || typeof listing === 'string') return ''
  return formatMoney(listing.price, listing.currency)
}

function attachmentLabel(count = 0) {
  if (!count) return ''
  return `${count} attachment${count === 1 ? '' : 's'}`
}

function draftAttachmentType(file: File): DraftAttachment['type'] {
  return file.type.startsWith('video/') ? 'video' : 'image'
}

function draftAttachmentId(file: File, index: number) {
  return `${file.name}-${file.lastModified}-${file.size}-${Date.now()}-${index}`
}

function conversationPreview(message: ChatConversation['latestMessage']) {
  const text = message.content?.trim() || attachmentLabel(message.attachments?.length || 0) || 'Message'
  return text.length > 46 ? `${text.slice(0, 43).trimEnd()}...` : text
}

function conversationUnreadTotal(conversation: ChatConversation) {
  return (conversation.unreadCount || 0) + (conversation.unreadReactionCount || 0)
}

function conversationTimestamp(value?: string) {
  if (!value) return ''

  const date = new Date(value)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()

  return new Intl.DateTimeFormat('en-GH', sameDay
    ? { hour: '2-digit', minute: '2-digit' }
    : { day: '2-digit', month: 'short' }).format(date)
}

function inboxParams() {
  const params = new URLSearchParams(window.location.search)
  return {
    conversationId: params.get('conversationId') || '',
    listingId: params.get('listingId') || '',
    receiverId: params.get('receiverId') || '',
    section: (params.get('view') === 'system' ? 'system' : 'inbox') as InboxSection,
  }
}

function conversationIdFor(userA?: string, userB?: string) {
  if (!userA || !userB || userA === userB) return ''
  return `${[userA, userB].sort().join('_')}_general`
}

function messageIdentity(message: InboxChatMessage) {
  return message._id || message.clientMessageId || ''
}

function mergeMessageList(current: InboxChatMessage[], incoming: InboxChatMessage) {
  const incomingId = messageIdentity(incoming)
  const incomingClientId = incoming.clientMessageId
  const index = current.findIndex((message) => {
    if (incomingClientId && message.clientMessageId === incomingClientId) return true
    return incomingId && messageIdentity(message) === incomingId
  })

  if (index === -1) return [...current, incoming]

  const next = [...current]
  next[index] = {
    ...next[index],
    ...incoming,
    deliveryStatus: incoming.deliveryStatus || 'sent',
  }
  return next
}

function mergeMessagePage(current: InboxChatMessage[], pageMessages: InboxChatMessage[]) {
  return pageMessages.reduce((nextMessages, message) => {
    const currentMessage = nextMessages.find((item) => messageIdentity(item) === messageIdentity(message))
    const incoming = currentMessage?.liveReactionVersion
      ? {
          ...message,
          liveReactionVersion: currentMessage.liveReactionVersion,
          reactions: currentMessage.reactions,
        }
      : message
    return mergeMessageList(nextMessages, incoming)
  }, current)
}

function tempMessageId() {
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function resizeMessageInput(input: HTMLTextAreaElement) {
  input.style.height = '48px'
  const contentHeight = input.scrollHeight
  input.style.height = `${Math.min(contentHeight, 144)}px`
  input.classList.toggle('is-overflowing', contentHeight > 144)
}

function ListingContextBand({ listing, onDismiss }: { listing?: Listing | string; onDismiss?: () => void }) {
  const title = listingTitle(listing)
  if (!title) return null

  return (
    <div className="relative mx-3 mb-2 grid grid-cols-[52px_minmax(0,1fr)] items-center gap-3 rounded-xl border border-foose-border bg-foose-surface-low p-2 pr-10 text-sm">
      {listingImage(listing) ? <img alt="" className="size-12 rounded-lg object-cover" src={listingImage(listing)} /> : <span className="size-12 rounded-lg bg-foose-surface-mid" />}
      <div className="min-w-0">
        <span className="block text-xs font-bold uppercase tracking-wider text-foose-faint">Question about</span>
        <strong className="block truncate text-foose-text">{title}</strong>
        {listingPrice(listing) && <small className="font-bold text-accent">{listingPrice(listing)}</small>}
      </div>
      {onDismiss && (
        <button
          aria-label="Remove item from this message"
          className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border border-foose-border bg-foose-surface text-foose-muted transition hover:border-accent hover:text-accent"
          onClick={onDismiss}
          type="button"
        >
          x
        </button>
      )}
    </div>
  )
}

function ReplyContextBand({ message, onDismiss }: { message: InboxChatMessage; onDismiss: () => void }) {
  const text = message.content?.trim() || attachmentLabel(message.attachments?.length || 0) || listingTitle(message.listingId) || 'Message'
  return (
    <div className="relative mx-3 mb-2 rounded-xl border-l-4 border-accent bg-accent-light p-3 pr-10 text-sm">
      <span className="block text-xs font-bold uppercase tracking-wider text-accent">Replying to</span>
      <p className="line-clamp-2 text-foose-text">{text}</p>
      <button
        aria-label="Cancel reply"
        className="absolute right-2 top-2 inline-flex size-7 items-center justify-center rounded-full border border-foose-border bg-foose-surface text-foose-muted transition hover:border-accent hover:text-accent"
        onClick={onDismiss}
        type="button"
      >
        x
      </button>
    </div>
  )
}

export function InboxPage() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const systemListRef = useRef<HTMLElement>(null)
  const pendingReads = useRef(new Set<string>())
  useEffect(() => registerNavigationScrollRegion('system-notifications', () => systemListRef.current), [])
  const {
    conversations: conversationItems,
    joinConversation,
    markConversationRead,
    markConversationReactionsRead,
    markNotificationRead,
    messageConfirmedEvent,
    messageEvent,
    messageReactionEvents,
    messagesReadEvent,
    notificationError,
    notificationLoading,
    notifications,
    sendMessage: sendSocketMessage,
  } = useMessaging()
  const params = inboxParams()
  const messagePath = useCallback(
    (page: number) => (params.conversationId ? `/chat/${encodeURIComponent(params.conversationId)}?page=${page}&limit=30` : null),
    [params.conversationId],
  )
  const extractMessages = useCallback((data: PaginatedMessages) => data.messages || [], [])
  const {
    data: messageData,
    error: messagesError,
    initialLoading: messagesInitialLoading,
    items: messageItems,
    loadMoreError: messagesLoadMoreError,
    loading: messagesLoading,
    loadingMore: messagesLoadingMore,
    refetch: refetchMessages,
    retryLoadMore: retryMessagesLoadMore,
    sentinelRef: messagesSentinelRef,
  } = useInfiniteApiResource(messagePath, extractMessages, [params.conversationId])
  const listingContext = useApiResource<{ listing: Listing }>(params.listingId ? `/listings/${encodeURIComponent(params.listingId)}` : null, Boolean(params.listingId))
  const [sendError, setSendError] = useState('')
  const [sendErrorTitle, setSendErrorTitle] = useState('Message not sent')
  const [sending, setSending] = useState(false)
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null)
  const [liveMessages, setLiveMessages] = useState<InboxChatMessage[]>([])
  const [olderMessagesEnabled, setOlderMessagesEnabled] = useState(false)
  const [selectedAttachments, setSelectedAttachments] = useState<DraftAttachment[]>([])
  const [dismissedListingId, setDismissedListingId] = useState('')
  const [replyTarget, setReplyTarget] = useState<InboxChatMessage | null>(null)
  const [newReactionMessageId, setNewReactionMessageId] = useState('')
  const [pendingReactionMessageId, setPendingReactionMessageId] = useState('')
  const [accountActionsOpen, setAccountActionsOpen] = useState(false)
  const selectedAttachmentsRef = useRef<DraftAttachment[]>([])
  const messageInputRef = useRef<HTMLTextAreaElement | null>(null)
  const messagesRef = useRef<HTMLDivElement | null>(null)
  const accountActionsRef = useRef<HTMLDivElement | null>(null)
  const lastConversationRef = useRef('')
  const lastNewestMessageRef = useRef('')
  const initialReactionCheckRef = useRef('')
  const reactionReadOnExitRef = useRef('')
  const processedReactionEventsRef = useRef(new WeakSet<object>())
  const openPreview = useImagePreviewStore((store) => store.openPreview)
  const myId = user?._id || ''
  const orderedConversations = [...conversationItems].sort((first, second) => {
    const firstDate = Date.parse(first.latestMessage.createdAt || '') || 0
    const secondDate = Date.parse(second.latestMessage.createdAt || '') || 0
    return secondDate - firstDate
  })
  const activeConversation = orderedConversations.find((conversation) => conversation.conversationId === params.conversationId)
  const canCompose = Boolean(params.conversationId || params.receiverId)
  const compactThreadOpen = params.section === 'inbox' && canCompose
  const unreadConversationCount = orderedConversations.reduce((total, conversation) => total + conversationUnreadTotal(conversation), 0)
  const notificationItems = notifications
  const productMessages = liveMessages
  const orderedMessages = [...productMessages].sort((first, second) => {
    const firstDate = Date.parse(first.createdAt || '') || 0
    const secondDate = Date.parse(second.createdAt || '') || 0
    return firstDate - secondDate
  })
  const newestMessageId = orderedMessages.at(-1)?._id || ''
  const bargaining = useBargain(orderedMessages)
  const activeComposerListing = params.listingId && dismissedListingId !== params.listingId ? listingContext.data?.listing : undefined
  const productChat = Boolean(activeComposerListing || orderedMessages.some((message) => Boolean(message.listingId)))
  const activeContact = productMessages
    .flatMap((message) => [message.senderId, message.receiverId])
    .find((participant) => typeof participant === 'object' && participant._id !== myId) as User | undefined
  const activeParticipant = activeConversation?.participant || messageData?.participant || activeContact
  const activeParticipantProfile = isUserProfile(activeParticipant) ? activeParticipant : undefined
  const hasActiveThreadTarget = Boolean(params.conversationId || params.receiverId)
  const activeThreadTitle = activeParticipantProfile ? displayUser(activeParticipantProfile) : hasActiveThreadTarget ? 'Starting chat' : 'Select a conversation'
  const activeThreadSubtitle = activeParticipantProfile
    ? displayUsername(activeParticipantProfile) || 'Username unavailable'
    : canCompose
      ? 'Loading seller profile...'
      : 'Open a thread or message a seller from a listing.'
  const contactPhone = productChat ? activeContact?.phone : ''

  const scrollToLatestMessage = useCallback(() => {
    const node = messagesRef.current
    if (!node) return

    node.scrollTop = node.scrollHeight
    window.requestAnimationFrame(() => {
      node.scrollTo({ top: node.scrollHeight })
      window.requestAnimationFrame(() => {
        node.scrollTo({ top: node.scrollHeight })
      })
    })
  }, [])

  useEffect(() => {
    const handleResize = () => {
      if (messageInputRef.current) resizeMessageInput(messageInputRef.current)
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  function prepareConversationOpen() {
    setOlderMessagesEnabled(false)
    lastConversationRef.current = ''
    lastNewestMessageRef.current = ''
    window.setTimeout(scrollToLatestMessage, 0)
  }

  useEffect(() => {
    if (!accountActionsOpen) return undefined

    function closeOnOutsideClick(event: MouseEvent) {
      if (accountActionsRef.current?.contains(event.target as Node)) return
      setAccountActionsOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setAccountActionsOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [accountActionsOpen])

  useEffect(() => {
    setOlderMessagesEnabled(false)
    setNewReactionMessageId('')
    setPendingReactionMessageId('')
    setAccountActionsOpen(false)
    initialReactionCheckRef.current = ''
    setReplyTarget(null)
    setLiveMessages([])
  }, [params.conversationId])

  useEffect(() => {
    setLiveMessages((current) => mergeMessagePage(current, messageItems))
  }, [messageItems])

  useEffect(() => {
    if (!params.conversationId) return
    joinConversation(params.conversationId)
  }, [joinConversation, params.conversationId])

  useEffect(() => {
    if (!messageEvent || messageEvent.conversationId !== params.conversationId) return

    const incoming = senderIdValue(messageEvent.message.senderId) !== myId && senderIdValue(messageEvent.message.receiverId) === myId
    setLiveMessages((current) => mergeMessageList(current, { ...messageEvent.message, deliveryStatus: 'sent' }))

    if (incoming) {
      markConversationRead(messageEvent.conversationId)
    }
  }, [markConversationRead, messageEvent, myId, params.conversationId])

  useEffect(() => {
    if (!messageConfirmedEvent || messageConfirmedEvent.conversationId !== params.conversationId) return
    setLiveMessages((current) =>
      mergeMessageList(current, {
        ...messageConfirmedEvent.message,
        clientMessageId: messageConfirmedEvent.clientMessageId,
        deliveryStatus: 'sent',
      }),
    )
  }, [messageConfirmedEvent, params.conversationId])

  useEffect(() => {
    const pendingEvents = messageReactionEvents.filter((event) => (
      event.conversationId === params.conversationId && !processedReactionEventsRef.current.has(event)
    ))
    if (!pendingEvents.length) return
    pendingEvents.forEach((event) => processedReactionEventsRef.current.add(event))
    const version = Date.now()
    setLiveMessages((current) => pendingEvents.reduce((messages, event, index) => mergeMessageList(messages, {
      ...event.message,
      liveReactionVersion: version + index,
    }), current))

    pendingEvents.forEach((event) => {
      if (event.reactedBy === myId) return
      if (event.removed) {
        setNewReactionMessageId((current) => current === event.message._id ? '' : current)
        setPendingReactionMessageId((current) => current === event.message._id ? '' : current)
      } else {
        setPendingReactionMessageId(event.message._id)
      }
    })
  }, [messageReactionEvents, myId, params.conversationId])

  useEffect(() => {
    if (!pendingReactionMessageId) return undefined
    const detectionFrame = window.requestAnimationFrame(() => {
      const viewport = messagesRef.current
      const target = document.getElementById(`chat-message-${pendingReactionMessageId}`)
      if (!viewport || !target) return
      const viewportRect = viewport.getBoundingClientRect()
      const targetRect = target.getBoundingClientRect()
      if (targetRect.bottom <= viewportRect.top + 8) setNewReactionMessageId(pendingReactionMessageId)
      setPendingReactionMessageId('')
    })
    return () => window.cancelAnimationFrame(detectionFrame)
  }, [liveMessages, pendingReactionMessageId])

  useEffect(() => {
    if (!messagesReadEvent || messagesReadEvent.conversationId !== params.conversationId || messagesReadEvent.readBy === myId) return
    setLiveMessages((current) =>
      current.map((message) =>
        senderIdValue(message.senderId) === myId ? { ...message, isRead: true } : message,
      ),
    )
  }, [messagesReadEvent, myId, params.conversationId])

  useEffect(() => {
    setDismissedListingId('')
  }, [params.listingId])

  useEffect(() => {
    if (!params.conversationId || messagesLoading) return undefined

    const node = messagesRef.current
    if (!node) return undefined
    const conversationChanged = lastConversationRef.current !== params.conversationId
    const initialMessagesArrived = !lastNewestMessageRef.current && Boolean(newestMessageId)
    const newestChanged = Boolean(lastNewestMessageRef.current && newestMessageId && lastNewestMessageRef.current !== newestMessageId)
    lastConversationRef.current = params.conversationId
    lastNewestMessageRef.current = newestMessageId

    if (!conversationChanged && !initialMessagesArrived && !newestChanged) return undefined

    scrollToLatestMessage()

    const timer = window.setTimeout(() => {
      scrollToLatestMessage()
      setOlderMessagesEnabled(true)
    }, 80)
    return () => window.clearTimeout(timer)
  }, [messagesLoading, newestMessageId, params.conversationId, scrollToLatestMessage])

  useEffect(() => {
    if (!params.conversationId || !activeConversation?.unreadCount) return
    markConversationRead(params.conversationId)
  }, [activeConversation?.unreadCount, markConversationRead, params.conversationId])

  useEffect(() => {
    if (messagesLoading || newReactionMessageId || pendingReactionMessageId || !activeConversation?.unreadReactionCount) return
    const reactedMessage = [...liveMessages].find((message) => (
      message.reactions?.some((reaction) => userIdValue(reaction.userId) !== myId && reaction.isRead === false)
    ))
    if (reactedMessage && initialReactionCheckRef.current !== reactedMessage._id) {
      initialReactionCheckRef.current = reactedMessage._id
      setPendingReactionMessageId(reactedMessage._id)
    }
  }, [activeConversation?.unreadReactionCount, liveMessages, messagesLoading, myId, newReactionMessageId, pendingReactionMessageId])

  useEffect(() => {
    const conversationId = params.conversationId
    if (!conversationId) return undefined
    let armed = false
    const armTimer = window.setTimeout(() => {
      armed = true
      reactionReadOnExitRef.current = conversationId
    }, 0)

    return () => {
      window.clearTimeout(armTimer)
      if (armed && reactionReadOnExitRef.current === conversationId) {
        reactionReadOnExitRef.current = ''
        void markConversationReactionsRead(conversationId).catch(() => undefined)
      }
    }
  }, [markConversationReactionsRead, params.conversationId])

  useEffect(() => {
    if (!params.receiverId || params.conversationId || !myId) return
    const existingConversation = orderedConversations.find((conversation) => userIdValue(conversation.participant) === params.receiverId)
    const conversationId = existingConversation?.conversationId || conversationIdFor(myId, params.receiverId)
    if (!conversationId) return

    const query = new URLSearchParams()
    query.set('conversationId', conversationId)
    query.set('receiverId', params.receiverId)
    if (params.listingId) query.set('listingId', params.listingId)
    navigateTo(`/inbox?${query.toString()}`)
  }, [myId, orderedConversations, params.conversationId, params.listingId, params.receiverId])

  function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || [])
    const invalidType = files.find((file) => !CHAT_ATTACHMENT_TYPES.has(file.type))
    const oversized = files.find((file) => file.size > CHAT_ATTACHMENT_MAX_BYTES)
    const remainingSlots = Math.max(CHAT_ATTACHMENT_MAX_FILES - selectedAttachments.length, 0)

    if (invalidType || oversized || files.length > remainingSlots) {
      setSendErrorTitle('Attachment not added')
      setSendError(invalidType
        ? 'Use JPEG, PNG, WebP, MP4, WebM, or QuickTime files.'
        : oversized
          ? `${oversized.name} is larger than 25 MB.`
          : `You can attach up to ${CHAT_ATTACHMENT_MAX_FILES} files.`)
    } else {
      setSendError('')
    }

    const acceptedFiles = files
      .filter((file) => CHAT_ATTACHMENT_TYPES.has(file.type) && file.size <= CHAT_ATTACHMENT_MAX_BYTES)
      .slice(0, remainingSlots)
    const nextAttachments = acceptedFiles.map((file, index) => ({
      file,
      id: draftAttachmentId(file, index),
      type: draftAttachmentType(file),
      url: URL.createObjectURL(file),
    }))
    setSelectedAttachments((current) => [...current, ...nextAttachments].slice(0, CHAT_ATTACHMENT_MAX_FILES))
    event.target.value = ''
  }

  function removeSelectedFile(id: string) {
    setSelectedAttachments((current) =>
      current.filter((attachment) => {
        if (attachment.id !== id) return true
        URL.revokeObjectURL(attachment.url)
        return false
      }),
    )
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending) return
    const form = event.currentTarget
    const formData = new FormData(form)
    const content = String(formData.get('content') || '').trim()
    const fallbackReceiverId = String(formData.get('receiverId') || '').trim()
    const receiverId = params.receiverId || userIdValue(activeParticipant) || fallbackReceiverId

    if ((!content && !selectedAttachments.length) || (!params.conversationId && !receiverId)) return

    setSendError('')
    setSendErrorTitle('Message not sent')
    setSending(true)
    try {
      const listingId = activeComposerListing && params.listingId && dismissedListingId !== params.listingId ? params.listingId : ''

      if (selectedAttachments.length) {
        const payload = new FormData()
        if (content) payload.append('content', content)
        if (params.conversationId) payload.append('conversationId', params.conversationId)
        if (listingId) payload.append('listingId', listingId)
        if (replyTarget?._id) payload.append('replyTo', replyTarget._id)
        if (!params.conversationId && receiverId) payload.append('receiverId', receiverId)
        selectedAttachments.forEach((attachment) => payload.append('attachments', attachment.file))

        const result = await apiPost<{ conversationId: string; message: InboxChatMessage }>('/chat', payload)
        setLiveMessages((current) => mergeMessageList(current, { ...result.message, deliveryStatus: 'sent' }))
        if (!params.conversationId) {
          const query = new URLSearchParams()
          query.set('conversationId', result.conversationId)
          if (receiverId) query.set('receiverId', receiverId)
          if (listingId) query.set('listingId', listingId)
          navigateTo(`/inbox?${query.toString()}`)
        }
      } else {
        const clientMessageId = tempMessageId()
        const conversationId = params.conversationId || conversationIdFor(myId, receiverId)
        const optimisticMessage: InboxChatMessage = {
          _id: clientMessageId,
          clientMessageId,
          content,
          conversationId,
          createdAt: new Date().toISOString(),
          deliveryStatus: 'sending',
          listingId: activeComposerListing,
          receiverId: activeParticipantProfile || receiverId,
          replyTo: replyTarget || undefined,
          senderId: user || myId,
        }

        setLiveMessages((current) => mergeMessageList(current, optimisticMessage))

        const ack = await sendSocketMessage({
          clientMessageId,
          content,
          conversationId: params.conversationId || undefined,
          listingId: listingId || undefined,
          receiverId: receiverId || undefined,
          replyTo: replyTarget?._id,
        })

        if (!ack.success || !ack.message || !ack.conversationId) {
          setLiveMessages((current) =>
            current.map((message) =>
              message.clientMessageId === clientMessageId ? { ...message, deliveryStatus: 'failed' } : message,
            ),
          )
          setSendError(ack.error || 'Could not send message')
          return
        }

        const confirmedMessage = ack.message
        setLiveMessages((current) =>
          mergeMessageList(current, {
            ...confirmedMessage,
            clientMessageId,
            deliveryStatus: 'sent',
          }),
        )

        if (!params.conversationId) {
          const query = new URLSearchParams()
          query.set('conversationId', ack.conversationId)
          if (receiverId) query.set('receiverId', receiverId)
          if (listingId) query.set('listingId', listingId)
          navigateTo(`/inbox?${query.toString()}`)
        }
      }

      form.reset()
      if (messageInputRef.current) resizeMessageInput(messageInputRef.current)
      selectedAttachments.forEach((attachment) => URL.revokeObjectURL(attachment.url))
      setSelectedAttachments([])
      setReplyTarget(null)
      if (listingId) setDismissedListingId(listingId)
    } catch (err) {
      setSendError(getErrorMessage(err, 'Could not send message'))
    } finally {
      setSending(false)
    }
  }

  async function reactToMessage(messageId: string, reaction: ChatReactionName) {
    try {
      const result = await apiPut<{ message: InboxChatMessage }>(`/chat/messages/${encodeURIComponent(messageId)}/reaction`, { reaction })
      setLiveMessages((current) => mergeMessageList(current, { ...result.message, liveReactionVersion: Date.now() }))
    } catch (err) {
      setSendErrorTitle('Reaction not saved')
      setSendError(getErrorMessage(err, 'Could not save reaction'))
    }
  }

  function jumpToNewReaction() {
    if (!newReactionMessageId) return
    document.getElementById(`chat-message-${newReactionMessageId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setNewReactionMessageId('')
    setPendingReactionMessageId('')
    if (params.conversationId) {
      void markConversationReactionsRead(params.conversationId).catch(() => {
        setSendErrorTitle('Reaction not marked as read')
        setSendError('Please try opening the reaction again.')
      })
    }
  }

  function startReply(message: InboxChatMessage) {
    setReplyTarget(message)
    window.requestAnimationFrame(() => {
      messageInputRef.current?.focus()
    })
  }

  function openNotificationDetails(notification: Notification, trigger: HTMLElement) {
    if (!notification.isRead && !pendingReads.current.has(notification._id)) {
      pendingReads.current.add(notification._id)
      void markNotificationRead(notification._id)
        .catch(() => showToast({ title: 'Notification still unread', message: 'Could not mark this notification as read. Try again.', tone: 'error' }))
        .finally(() => pendingReads.current.delete(notification._id))
    }
    const target = notificationTarget(notification.link)
    if (target.kind === 'internal') {
      setNextNavigationContext({ trigger: captureNavigationTrigger(trigger) })
      navigateTo(target.href)
    } else setSelectedNotification(notification)
  }

  useEffect(() => {
    selectedAttachmentsRef.current = selectedAttachments
  }, [selectedAttachments])

  useEffect(() => {
    return () => {
      selectedAttachmentsRef.current.forEach((attachment) => URL.revokeObjectURL(attachment.url))
    }
  }, [])

  return (
    <AppShell active="inbox" compactImmersive={compactThreadOpen} searchPlaceholder="Search messages..." flush showFooter={false}>
      <main className={`inbox-shell grid min-h-[calc(100dvh-4rem)] border-x border-foose-border bg-foose-surface xl:h-[calc(100dvh-4rem)] xl:min-h-0 xl:grid-cols-[360px_minmax(0,1fr)] xl:overflow-hidden ${compactThreadOpen ? 'max-xl:h-dvh max-xl:min-h-0 max-xl:overflow-hidden' : 'max-lg:pb-20'}`}>
        <aside className={`conversation-list flex min-h-0 flex-col border-b border-foose-border xl:h-full xl:border-b-0 xl:border-r ${compactThreadOpen ? 'max-xl:hidden' : ''}`}>
          <div className="inbox-heading shrink-0 border-b border-foose-border bg-foose-surface px-4 pb-3 pt-4">
            <h1 className="text-2xl font-bold">Messages</h1>
            <nav className="mt-3 grid grid-cols-2 gap-2" aria-label="Message sections">
              <a
                aria-current={params.section === 'inbox' ? 'page' : undefined}
                className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition ${params.section === 'inbox' ? 'border-accent bg-accent text-white' : 'border-foose-border bg-foose-surface-low text-foose-muted hover:border-accent hover:text-accent'}`}
                href={withBasePath('/inbox')}
              >
                Inbox
                {unreadConversationCount > 0 && (
                  <span className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-black leading-none ring-1 ring-white/70 ${params.section === 'inbox' ? 'bg-white text-accent-strong' : 'bg-accent-strong text-white'}`}>
                    {unreadConversationCount > 99 ? '99+' : unreadConversationCount}
                  </span>
                )}
              </a>
              <a
                aria-current={params.section === 'system' ? 'page' : undefined}
                className={`relative inline-flex min-h-10 items-center justify-center gap-2 rounded-full border px-4 text-sm font-bold transition ${params.section === 'system' ? 'border-accent bg-accent text-white' : 'border-foose-border bg-foose-surface-low text-foose-muted hover:border-accent hover:text-accent'}`}
                href={withBasePath('/inbox?view=system')}
              >
                System
                {notificationItems.some((notification) => !notification.isRead) && (
                  <span aria-label="Unread system notification" className={`size-2.5 rounded-full ring-1 ring-white/70 ${params.section === 'system' ? 'bg-white' : 'bg-accent-strong'}`} />
                )}
              </a>
            </nav>
          </div>
          {params.section === 'inbox' && (
          <section className="conversation-stack flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="Inbox conversations">
            <h2 className="sr-only">Inbox</h2>
            {notificationLoading && <InboxListSkeleton label="Loading conversations" />}
            {notificationError && <StatePanel body={notificationError} layout="pane" title="Conversations unavailable" tone="error" />}
            {!notificationLoading && !notificationError && !orderedConversations.length && (
              <StatePanel body="Message a seller from any listing page to start a thread." layout="pane" title="No conversations yet" tone="empty" />
            )}
            {!!orderedConversations.length &&
              orderedConversations.map((conversation) => {
                const participant = conversation.participant
                const active = conversation.conversationId === params.conversationId
                const image = userPhoto(participant)
                const unread = conversationUnreadTotal(conversation)

                return (
                  <a
                    className={`conversation grid min-h-[76px] grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-3 border-b border-foose-border px-4 py-3 text-left transition hover:bg-foose-surface-low ${active ? 'bg-accent-light' : ''}`}
                    href={withBasePath(`/inbox?conversationId=${encodeURIComponent(conversation.conversationId)}`)}
                    key={conversation.conversationId}
                    onClick={prepareConversationOpen}
                  >
                    {image ? <img alt="" className="size-13 rounded-full object-cover" src={image} /> : <span className="conversation-avatar inline-flex size-13 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">{initials(displayUser(participant))}</span>}
                    <span className="min-w-0">
                      <strong className="block truncate text-sm font-bold text-foose-text">{displayUser(participant)}</strong>
                      <p className={`truncate text-sm ${unread > 0 ? 'font-semibold text-foose-text' : 'text-foose-muted'}`} title={conversation.latestMessage.content || attachmentLabel(conversation.latestMessage.attachments?.length || 0)}>
                        {conversationPreview(conversation.latestMessage)}
                      </p>
                    </span>
                    <span className="flex min-w-12 flex-col items-end gap-1">
                      {conversation.latestMessage.createdAt && <time className={`whitespace-nowrap text-xs ${unread > 0 ? 'font-bold text-accent' : 'text-foose-faint'}`}>{conversationTimestamp(conversation.latestMessage.createdAt)}</time>}
                      {unread > 0 && <b className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-black leading-none text-white">{unread > 99 ? '99+' : unread}</b>}
                    </span>
                  </a>
                )
              })}
          </section>
          )}
          {params.section === 'system' && (
          <section ref={systemListRef} className="system-notifications flex min-h-0 flex-1 flex-col overflow-y-auto" aria-label="System notifications">
            <h2 className="sr-only">System notifications</h2>
            {notificationLoading && <InboxListSkeleton label="Loading notifications" />}
            {notificationError && <StatePanel body={notificationError} layout="pane" title="Notifications unavailable" tone="error" />}
            {!notificationLoading && !notificationError && !notificationItems.length && (
              <StatePanel body="Likes, comments, replies, follows, reviews, and account updates will appear here." layout="pane" title="No activity yet" tone="empty" />
            )}
            {notificationItems.map((notification) => (
              <button className={`notification-item grid min-h-[76px] w-full grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 border-b border-foose-border px-4 py-3 text-left transition hover:bg-foose-surface-low ${notification.isRead ? 'bg-foose-surface' : 'bg-accent-light/55'}`} key={notification._id} id={`notification-${notification._id}`} onClick={(event) => openNotificationDetails(notification, event.currentTarget)} type="button">
                <span className="inline-flex size-11 items-center justify-center rounded-full bg-accent-light text-accent">
                  <Icon name="bell" />
                </span>
                <span className="min-w-0">
                  <strong className="block truncate text-sm font-bold text-foose-text">{notification.title}</strong>
                  <p className="line-clamp-2 text-sm leading-5 text-foose-muted">{notification.body || 'System update'}</p>
                  {notification.createdAt && <time className="mt-1 block text-xs text-foose-faint">{conversationTimestamp(notification.createdAt)}</time>}
                </span>
                {!notification.isRead && <span aria-label="Unread" className="size-2.5 rounded-full bg-foose-danger" />}
              </button>
            ))}
          </section>
          )}
        </aside>
        <section className={`thread flex min-h-0 flex-col bg-foose-bg xl:h-full xl:overflow-hidden ${compactThreadOpen ? 'max-xl:h-dvh' : 'max-xl:hidden'}`}>
          {!canCompose ? (
            <div className="flex min-h-[70dvh] flex-1 items-center justify-center p-6 text-center xl:min-h-0">
              <StatePanel body="Choose a conversation or message someone to start chatting." layout="pane" title="Your conversation will open here" tone="info" />
            </div>
          ) : (
            <>
          <header className="thread-header sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-foose-border bg-foose-surface px-4 py-2 shadow-sm max-xl:px-3 [&_img]:size-10 [&_img]:shrink-0 [&_img]:rounded-full [&_img]:object-cover [&_h2]:truncate [&_h2]:text-sm [&_h2]:font-bold [&_p]:truncate [&_p]:text-xs [&_p]:text-foose-muted">
            <NavigationBackButton
              className="size-10 bg-transparent shadow-none hover:bg-foose-surface-low xl:hidden"
              fallback={{ href: '/inbox', label: 'Inbox' }}
              variant="icon"
            />
            {userPhoto(activeParticipantProfile) ? <img alt="" src={userPhoto(activeParticipantProfile)} /> : <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">{initials(activeThreadTitle)}</span>}
            <div className="min-w-0 flex-1">
              <h2>{activeThreadTitle}</h2>
              <p>{activeThreadSubtitle}</p>
              {contactPhone && (
                <a className="chat-contact-phone text-xs font-semibold text-accent" href={`tel:${contactPhone}`}>
                  {contactPhone}
                </a>
              )}
            </div>
            {activeParticipantProfile && (
              <div className="relative shrink-0" ref={accountActionsRef}>
                <button
                  aria-expanded={accountActionsOpen}
                  aria-haspopup="menu"
                  aria-label="Account actions"
                  className="icon-button"
                  onClick={() => setAccountActionsOpen((open) => !open)}
                  type="button"
                >
                  <HiFlag size={20} />
                </button>
                {accountActionsOpen && (
                  <div className="absolute right-0 top-full z-[1000] mt-2 w-52 rounded-xl border border-foose-border bg-foose-surface p-1.5 text-foose-text shadow-2xl" role="menu">
                    <ReportUserDialog
                      renderTrigger={({ onClick }) => (
                        <button
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold transition hover:bg-foose-surface-low"
                          onClick={() => {
                            setAccountActionsOpen(false)
                            onClick()
                          }}
                          role="menuitem"
                          type="button"
                        >
                          Report user
                        </button>
                      )}
                      reportedUserId={activeParticipantProfile._id}
                    />
                    <BlockUserButton
                      blockedUserId={activeParticipantProfile._id}
                      renderTrigger={({ active, busy, onClick }) => (
                        <button
                          className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-foose-danger transition hover:bg-foose-danger-bg/40 disabled:opacity-50"
                          disabled={busy}
                          onClick={(event) => {
                            setAccountActionsOpen(false)
                            onClick(event)
                          }}
                          role="menuitem"
                          type="button"
                        >
                          {active ? 'Unblock user' : 'Block user'}
                        </button>
                      )}
                    />
                  </div>
                )}
              </div>
            )}
          </header>
          <div className="relative flex min-h-0 flex-1">
          <div className="messages flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain p-4 pb-6 max-md:px-3" ref={messagesRef}>
            {params.conversationId && olderMessagesEnabled && (
              <div ref={messagesSentinelRef} className="flex min-h-10 flex-col items-center justify-center gap-2 py-2">
                {messagesLoadingMore && <SkeletonBlock className="h-8 w-40 rounded-full" />}
                {messagesLoadMoreError && <InlineNotice action={<button className="text-sm font-bold text-accent" onClick={() => void retryMessagesLoadMore()} type="button">Retry</button>} tone="warning">Older messages could not load.</InlineNotice>}
              </div>
            )}
            {messagesInitialLoading && (
              <LoadingRegion className="grid flex-1 content-end gap-4" label="Loading conversation" layout="pane">
                <SkeletonBlock className="h-16 w-3/5 rounded-2xl" />
                <SkeletonBlock className="ml-auto h-20 w-2/3 rounded-2xl" />
                <SkeletonBlock className="h-14 w-1/2 rounded-2xl" />
                <SkeletonBlock className="ml-auto h-16 w-3/5 rounded-2xl" />
              </LoadingRegion>
            )}
            {messagesError && !messageItems.length && <StatePanel action={<button className="text-sm font-bold text-accent" onClick={() => void refetchMessages()} type="button">Retry conversation</button>} body={messagesError} layout="pane" title="Conversation unavailable" tone="error" />}
            {!params.conversationId && params.receiverId && (
              <StatePanel body="Send the first message to start this seller conversation." layout="pane" title="Ready to message" tone="info" />
            )}
            {!!orderedMessages.length &&
              orderedMessages.map((message) => {
                const incoming = Boolean(myId) && senderIdValue(message.senderId) !== myId
                const subtitle = message.createdAt ? formatDateTime(message.createdAt) : undefined
                if (message.type === 'offer' && message.offer) {
                  const bargainId = typeof message.bargainId === 'string' ? message.bargainId : message.bargainId?._id
                  return (
                    <OfferCard
                      bargain={bargainId ? bargaining.bargains[bargainId] : undefined}
                      busy={Boolean(bargainId) && bargaining.busyId === bargainId}
                      currentUserId={myId}
                      incoming={incoming}
                      isLatest={bargaining.isLatestOfferMessage(message._id)}
                      key={message._id}
                      message={message}
                      onAction={(id, action, amount) => void bargaining.act(id, action, amount)}
                      subtitle={subtitle}
                    />
                  )
                }
                return (
                  <Message
                    attachments={message.attachments || []}
                    currentUserId={myId}
                    incoming={incoming}
                    key={message._id}
                    listing={message.listingId}
                    messageId={message._id}
                    onReact={(messageId, reaction) => void reactToMessage(messageId, reaction)}
                    onReply={() => startReply(message)}
                    reactions={message.reactions || []}
                    replyTo={message.replyTo}
                    subtitle={subtitle}
                  >
                    {message.content}
                  </Message>
                )
              })}
          </div>
          {newReactionMessageId && (
            <button
              aria-label="Jump up to the new reaction"
              className="message-new-reaction absolute left-1/2 top-3 z-30 inline-flex min-h-9 -translate-x-1/2 items-center gap-2 rounded-full border border-accent/20 bg-foose-surface px-4 text-xs font-black text-accent shadow-lg transition hover:-translate-y-0.5 hover:bg-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent motion-reduce:hover:translate-y-0"
              onClick={jumpToNewReaction}
              type="button"
            >
              <span aria-hidden>↑</span>
              New reaction
            </button>
          )}
          </div>
          {bargaining.actionError && (
            <InlineNotice
              action={<button className="text-sm font-bold text-accent" onClick={bargaining.clearActionError} type="button">Dismiss</button>}
              className="mx-3 mb-2"
              title="Bargain not updated"
              tone="error"
            >
              {bargaining.actionError}
            </InlineNotice>
          )}
          {sendError && <InlineNotice className="mx-3 mb-2" title={sendErrorTitle} tone="error">{sendError}</InlineNotice>}
          {replyTarget && <ReplyContextBand message={replyTarget} onDismiss={() => setReplyTarget(null)} />}
          <ListingContextBand listing={activeComposerListing} onDismiss={() => setDismissedListingId(params.listingId)} />
          <form aria-busy={sending} className={`message-composer sticky bottom-0 flex min-w-0 shrink-0 items-end gap-2 border-t border-foose-border bg-foose-surface/95 p-3 shadow-[0_-8px_24px_rgba(26,27,37,0.04)] backdrop-blur max-md:gap-1.5 max-sm:px-2 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))] ${canCompose ? 'single-line' : ''} `} onSubmit={(event) => void sendMessage(event)}>
            {!params.conversationId && !params.receiverId && <input aria-label="Receiver user ID" name="receiverId" placeholder="Receiver user ID" />}
            <div className="composer-main min-w-0 flex-1">
              <div className="overflow-hidden rounded-3xl bg-foose-surface-low pr-1 ring-1 ring-inset ring-foose-border transition focus-within:bg-foose-surface focus-within:ring-accent">
                <textarea aria-label="Write message" className="message-composer-input block h-12 max-h-36 min-h-12 w-full resize-none bg-transparent px-4 py-3 text-foose-text outline-none" name="content" onInput={(event) => resizeMessageInput(event.currentTarget)} placeholder={activeComposerListing ? 'Ask a question about this product...' : 'Message'} readOnly={sending} ref={messageInputRef} rows={1} />
              </div>
              {!!selectedAttachments.length && (
                <div className="composer-media-previews flex flex-wrap gap-2">
                  {selectedAttachments.map((attachment, index) => (
                    <div className="composer-media-preview [&_img]:max-h-44 [&_img]:rounded-lg [&_img]:object-cover [&_video]:max-h-44 [&_video]:rounded-lg [&_video]:object-cover relative overflow-hidden rounded-lg border border-foose-border bg-foose-surface-low p-1 [&>button:first-child]:block [&>button:first-child]:border-0 [&>button:first-child]:bg-transparent [&>button:first-child]:p-0 [&_small]:block [&_small]:max-w-28 [&_small]:truncate [&_small]:text-xs [&_small]:text-foose-muted" key={attachment.id}>
                      <button
                        aria-label={`Preview ${attachment.file.name}`}
                        onClick={() =>
                          openPreview(
                            selectedAttachments.map((item) => ({
                              alt: item.file.name,
                              src: item.url,
                              type: item.type,
                            })),
                            index,
                          )
                        }
                        type="button"
                      >
                        {attachment.type === 'video' ? (
                          <video muted src={attachment.url} />
                        ) : (
                          <img alt={attachment.file.name} src={attachment.url} />
                        )}
                      </button>
                      <span>{attachment.file.name}</span>
                      <button aria-label={`Remove ${attachment.file.name}`} className="inline-flex size-11 items-center justify-center rounded-full bg-black/65 text-white" onClick={() => removeSelectedFile(attachment.id)} type="button">
                        x
                      </button>
                      <small>{index + 1}</small>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <label aria-label="Attach images or videos" className="attachment-button inline-flex size-12 max-sm:size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-foose-border bg-foose-surface text-accent transition hover:bg-accent-light focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent [&_input]:sr-only" title="Attach images or videos">
              <span className="sr-only">Attach images or videos</span>
              <Icon name="upload" />
              <input accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" disabled={sending} multiple name="attachments" onChange={handleAttachmentChange} type="file" />
            </label>
            <label aria-label="Open camera" className="attachment-button inline-flex size-12 max-sm:size-10 shrink-0 cursor-pointer items-center justify-center rounded-full border border-foose-border bg-foose-surface text-accent transition hover:bg-accent-light focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent [&_input]:sr-only" title="Open camera">
              <span className="sr-only">Open camera</span>
              <Icon name="camera" />
              <input accept="image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime" capture="environment" disabled={sending} multiple onChange={handleAttachmentChange} type="file" />
            </label>
            <button aria-label={sending ? 'Sending message' : 'Send message'} className="message-send-button inline-flex size-12 max-sm:size-10 shrink-0 items-center justify-center rounded-full border border-accent bg-accent text-white shadow-sm transition hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:bg-foose-surface-mid disabled:text-foose-faint" disabled={sending} type="submit">
              {sending ? <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-white/45 border-t-white motion-reduce:animate-none" /> : <Icon name="send" />}
            </button>
          </form>
            </>
          )}
        </section>
        <Dialog
          description={selectedNotification?.body || 'System update'}
          footer={selectedNotification ? (
            <>
              <button className="inline-flex min-h-11 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-4 text-sm font-bold text-foose-text transition hover:border-accent hover:text-accent" onClick={() => setSelectedNotification(null)} type="button">
                Close
              </button>
              {notificationTarget(selectedNotification.link).kind === 'external' && (
                <a className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 text-sm font-bold text-white" href={selectedNotification.link} target="_blank" rel="noopener noreferrer">Open website</a>
              )}
            </>
          ) : null}
          onClose={() => setSelectedNotification(null)}
          open={Boolean(selectedNotification)}
          size="sm"
          title={selectedNotification?.title || 'Notification'}
        >
          {selectedNotification && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              {(() => { const target = notificationTarget(selectedNotification.link); return target.kind === 'external' ? <p className="text-sm text-foose-muted">Website: {target.domain}</p> : target.kind === 'details' && target.unavailable ? <p className="text-sm text-foose-muted">This link is unavailable.</p> : null })()}
              {selectedNotification.createdAt && (
                <span className="text-xs font-semibold uppercase tracking-wider text-foose-faint">{formatDateTime(selectedNotification.createdAt)}</span>
              )}
            </div>
          )}
        </Dialog>
      </main>
    </AppShell>
  )
}
