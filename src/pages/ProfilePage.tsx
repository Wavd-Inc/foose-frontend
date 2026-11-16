import { useCallback, useEffect, useRef, useState, type MouseEvent, type ReactNode } from 'react'
import { IoArchiveOutline, IoBanOutline, IoChatbubbleOutline, IoEllipsisVertical, IoFlagOutline, IoShareSocialOutline } from 'react-icons/io5'
import { MdVerified } from 'react-icons/md'
import { AppShell, Badge, ButtonLink, ConfirmDialog, Dialog, FinspoCaption, FinspoLikeButton, FinspoMasonry, FinspoFeedSkeleton, FinspoMediaCarousel, FloatingCreateButton, Icon, InlineNotice, LoadingState, ProductCard, RefreshIndicator, SafeImage, StatePanel, useToast } from '../components'
import { AppendFeedback, EventGridSkeleton, ProductGridSkeleton, ProfilePageSkeleton } from '../components/feedback/DiscoverySkeletons'
import { DiscoveryImage } from '../components/feedback/DiscoveryMedia'
import { NavigationBackButton } from '../components/navigation'
import { useAuth } from '../hooks/useAuth'
import { useApiResource } from '../hooks/useApiResource'
import { useInfiniteApiResource } from '../hooks/useInfiniteApiResource'
import { apiDelete, apiPost } from '../lib/api'
import type { Event, GalleryPost, Listing, PaginatedProfileConnections, PaginatedProfileContent, ProfileConnectionMember, ProfileConnectionType, ProfileContentType, ProfileSummary, Shop } from '../types/api'
import { authHref } from '../utils/authRedirect'
import { getErrorMessage } from '../utils/errorMessage'
import { eventTimeLabel, eventTypeLabel, eventWindowHasClosed } from '../utils/events'
import { initials } from '../utils/format'
import { finspoImages } from '../utils/finspoImages'
import { cacheFinspoPreview, captureNavigationTrigger, getCurrentAppHref, getCurrentAppPathname, navigateTo, withBasePath } from '../utils/navigation'

type ProfileTab = ProfileContentType

const PROFILE_TABS: Array<{ label: string; value: ProfileTab }> = [
  { label: 'Finspo', value: 'finspo' },
  { label: 'Listings', value: 'listings' },
  { label: 'Events', value: 'events' },
]

function profileUsername() {
  return decodeURIComponent(getCurrentAppPathname().replace(/^\/profile\/?/, '')).trim()
}

function currentProfileTab(): ProfileTab {
  const tab = new URL(getCurrentAppHref(), window.location.origin).searchParams.get('tab')
  return PROFILE_TABS.some((item) => item.value === tab) ? tab as ProfileTab : 'finspo'
}

function profilePageHref(username: string, tab: ProfileTab) {
  const pathname = username ? `/profile/${encodeURIComponent(username)}` : '/profile'
  return `${pathname}?tab=${tab}`
}

function conversationIdFor(userA?: string, userB?: string) {
  if (!userA || !userB || userA === userB) return ''
  return `${[userA, userB].sort().join('_')}_general`
}

function profileMessageHref(viewerId: string | undefined, profileId: string) {
  const query = new URLSearchParams({ receiverId: profileId })
  const conversationId = conversationIdFor(viewerId, profileId)
  if (conversationId) query.set('conversationId', conversationId)
  return `/inbox?${query.toString()}`
}

function profileShareUrl(username: string) {
  const route = `/profile/${encodeURIComponent(username)}`
  if (window.location.hash.startsWith('#/')) return `${window.location.origin}${window.location.pathname}#${route}`
  return new URL(withBasePath(route), window.location.origin).toString()
}

function ProfileSafetyMenu() {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return

    function closeOnOutsideClick(event: globalThis.MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="relative shrink-0" ref={menuRef}>
      <button aria-expanded={open} aria-haspopup="menu" aria-label={`${open ? 'Close' : 'Open'} profile options`} className="inline-flex size-11 cursor-pointer items-center justify-center rounded-xl border border-foose-border bg-foose-surface text-foose-text transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setOpen((current) => !current)} type="button">
        <IoEllipsisVertical size={20} />
      </button>
      {open && (
        <div className="absolute right-0 top-12 z-50 w-44 rounded-xl border border-foose-border bg-foose-surface p-1.5 shadow-2xl" role="menu">
          <button className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-foose-text transition hover:bg-foose-surface-low hover:text-accent" role="menuitem" type="button"><IoFlagOutline size={18} /> Report</button>
          <button className="flex min-h-10 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-left text-sm font-bold text-foose-danger transition hover:bg-foose-danger-bg" role="menuitem" type="button"><IoBanOutline size={18} /> Block</button>
        </div>
      )}
    </div>
  )
}

function contentPath(username: string, type: ProfileContentType, page: number) {
  return `/users/${encodeURIComponent(username)}/profile/content?type=${type}&page=${page}&limit=12`
}

function ProfilePanel({ active, children, id }: { active: boolean; children: ReactNode; id: ProfileTab }) {
  return (
    <section aria-labelledby={`profile-tab-${id}`} hidden={!active} id={`profile-panel-${id}`}>
      {children}
    </section>
  )
}

function ProfileContentFeedback({
  error,
  hasMore,
  label,
  loadingMore,
  retry,
  sentinelRef,
}: {
  error: string
  hasMore: boolean
  label: string
  loadingMore: boolean
  retry: () => Promise<void>
  sentinelRef: (node: HTMLElement | null) => void
}) {
  return (
    <div aria-label={hasMore ? `Load more ${label}` : `All ${label} loaded`} className="min-h-14 py-4" ref={sentinelRef}>
      <AppendFeedback error={error} label={`Loading more ${label}`} loading={loadingMore} retry={() => void retry()} />
      {!hasMore && !loadingMore && !error && <p className="text-center text-xs font-semibold text-foose-faint">You’ve reached the end.</p>}
    </div>
  )
}

type ProfileCardMenuItem = {
  href?: string
  icon: ReactNode
  label: string
  onSelect?: () => void
  tone?: 'default' | 'danger'
}

function ProfileCardMenu({ items, label }: { items: ProfileCardMenuItem[]; label: string }) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) return
    const closeOnOutsideClick = (event: globalThis.MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutsideClick)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('mousedown', closeOnOutsideClick)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return (
    <div className="absolute right-2 top-2 z-30" ref={menuRef}>
      <button aria-expanded={open} aria-haspopup="menu" aria-label={`${open ? 'Close' : 'Open'} options for ${label}`} className="inline-flex size-9 items-center justify-center rounded-full border border-white/70 bg-white/95 text-foose-ink shadow-md transition hover:bg-white hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" onClick={() => setOpen((current) => !current)} type="button">
        <IoEllipsisVertical size={19} />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-40 w-44 rounded-xl border border-foose-border bg-foose-surface p-1.5 shadow-2xl" role="menu">
          {items.map((item) => {
            const className = `flex min-h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-bold transition ${item.tone === 'danger' ? 'text-foose-danger hover:bg-foose-danger-bg' : 'text-foose-text hover:bg-foose-surface-low hover:text-accent'}`
            if (item.href) return <a className={className} href={withBasePath(item.href)} key={item.label} onClick={() => setOpen(false)} role="menuitem">{item.icon}{item.label}</a>
            return <button className={className} key={item.label} onClick={() => { setOpen(false); item.onSelect?.() }} role="menuitem" type="button">{item.icon}{item.label}</button>
          })}
        </div>
      )}
    </div>
  )
}

function connectionPath(username: string, type: ProfileConnectionType, page: number) {
  return `/users/${encodeURIComponent(username)}/connections?type=${type}&page=${page}&limit=30`
}

function ConnectionListSkeleton() {
  return (
    <div aria-hidden="true" className="space-y-2">
      {Array.from({ length: 6 }, (_, index) => (
        <div className="flex items-center justify-between gap-3 rounded-xl p-2" key={index}>
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="size-12 shrink-0 animate-pulse rounded-full bg-foose-surface-mid" />
            <span className="min-w-0 flex-1 space-y-2"><span className="block h-4 w-32 max-w-full animate-pulse rounded bg-foose-surface-mid" /><span className="block h-3 w-20 animate-pulse rounded bg-foose-surface-mid" /></span>
          </div>
          <span className="h-10 w-24 shrink-0 animate-pulse rounded-xl bg-foose-surface-mid" />
        </div>
      ))}
    </div>
  )
}

function ProfileConnectionsDialog({
  followerCount,
  followingCount,
  isOwnProfile,
  onClose,
  onFollowerCountChange,
  onFollowingCountChange,
  selected,
  username,
  visited,
  viewerId,
}: {
  followerCount: number
  followingCount: number
  isOwnProfile: boolean
  onClose: () => void
  onFollowerCountChange: (count: number) => void
  onFollowingCountChange: (count: number) => void
  selected: ProfileConnectionType | null
  username: string
  visited: Set<ProfileConnectionType>
  viewerId?: string
}) {
  const { showToast } = useToast()
  const [hiddenFollowers, setHiddenFollowers] = useState<Set<string>>(() => new Set())
  const [hiddenFollowing, setHiddenFollowing] = useState<Set<string>>(() => new Set())
  const [busyId, setBusyId] = useState('')
  const [actionError, setActionError] = useState<{ message: string; type: ProfileConnectionType } | null>(null)
  const [pendingRemoval, setPendingRemoval] = useState<ProfileConnectionMember | null>(null)

  const followersVisited = visited.has('followers')
  const followingVisited = visited.has('following')
  const followerBuildPath = useCallback((page: number) => followersVisited ? connectionPath(username, 'followers', page) : null, [username, followersVisited])
  const followingBuildPath = useCallback((page: number) => followingVisited ? connectionPath(username, 'following', page) : null, [username, followingVisited])
  const extractConnections = useCallback((page: PaginatedProfileConnections) => page.items, [])
  const followers = useInfiniteApiResource<ProfileConnectionMember, PaginatedProfileConnections>(followerBuildPath, extractConnections, [username, followersVisited])
  const following = useInfiniteApiResource<ProfileConnectionMember, PaginatedProfileConnections>(followingBuildPath, extractConnections, [username, followingVisited])
  const resource = selected === 'following' ? following : followers
  const hiddenIds = selected === 'following' ? hiddenFollowing : hiddenFollowers
  const visibleItems = resource.items.filter((member) => !hiddenIds.has(member._id))
  const activating = Boolean(selected && !resource.data && !resource.error)
  const currentCount = selected === 'following' ? followingCount : followerCount
  const label = selected === 'following' ? 'Following' : 'Followers'

  async function unfollow(member: ProfileConnectionMember) {
    setBusyId(member._id)
    setActionError(null)
    try {
      const result = await apiDelete<{ following: false; followingCount: number }>(`/users/${encodeURIComponent(member.username)}/follow`)
      setHiddenFollowing((current) => new Set([...current, member._id]))
      onFollowingCountChange(result.followingCount)
      showToast({ message: `You no longer follow @${member.username}.`, title: 'Unfollowed', tone: 'success' })
    } catch (error) {
      setActionError({ message: getErrorMessage(error, `Could not unfollow @${member.username}`), type: 'following' })
    } finally {
      setBusyId('')
    }
  }

  async function removeFollower() {
    const member = pendingRemoval
    if (!member) return
    setBusyId(member._id)
    setActionError(null)
    try {
      const result = await apiDelete<{ followerCount: number; removed: boolean }>(`/users/me/followers/${encodeURIComponent(member.username)}`)
      setHiddenFollowers((current) => new Set([...current, member._id]))
      onFollowerCountChange(result.followerCount)
      setPendingRemoval(null)
      showToast({ message: `@${member.username} was removed from your followers.`, title: 'Follower removed', tone: 'success' })
    } catch (error) {
      setActionError({ message: getErrorMessage(error, `Could not remove @${member.username}`), type: 'followers' })
      setPendingRemoval(null)
    } finally {
      setBusyId('')
    }
  }

  return (
    <>
      <Dialog closeLabel={`Close ${label.toLocaleLowerCase()}`} description={`${currentCount} ${currentCount === 1 ? label.slice(0, -1).toLocaleLowerCase() : label.toLocaleLowerCase()}`} onClose={onClose} open={Boolean(selected)} size="sm" title={label}>
        {(resource.initialLoading || activating) && <ConnectionListSkeleton />}
        {resource.error && !resource.items.length && <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Try again</button>} body={resource.error} layout="compact" title={`${label} could not load`} tone="error" />}
        {!activating && !resource.initialLoading && !resource.error && !visibleItems.length && <StatePanel body={isOwnProfile ? `You do not have any ${label.toLocaleLowerCase()} yet.` : `@${username} does not have any ${label.toLocaleLowerCase()} yet.`} layout="compact" title={`No ${label.toLocaleLowerCase()}`} tone="empty" />}
        {actionError?.type === selected && <InlineNotice className="mb-3" title="Connection did not update" tone="error">{actionError.message}</InlineNotice>}
        {!!visibleItems.length && (
          <div className="divide-y divide-foose-border/70">
            {visibleItems.map((member) => (
              <div className="flex items-center justify-between gap-3 py-3" key={member._id}>
                <a className="flex min-w-0 flex-1 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" href={withBasePath(`/profile/${encodeURIComponent(member.username)}`)}>
                  <SafeImage alt="" className="size-12 shrink-0 rounded-full object-cover" fallback={initials(member.name)} fallbackClassName="bg-accent-light text-sm font-black text-accent" src={member.profilePhoto} />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-black text-foose-text">{member.name}</span>
                    <span className="truncate text-xs font-bold text-foose-muted">@{member.username}</span>
                  </span>
                </a>
                {isOwnProfile && (
                  <span className="flex shrink-0 items-center gap-2">
                    <button className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl border border-foose-border px-3 text-xs font-black text-foose-text transition hover:border-foose-danger hover:text-foose-danger disabled:pointer-events-none disabled:opacity-60" disabled={busyId === member._id} onClick={() => selected === 'following' ? void unfollow(member) : setPendingRemoval(member)} type="button">{busyId === member._id ? 'Updating…' : selected === 'following' ? 'Unfollow' : 'Remove'}</button>
                    <a className="inline-flex min-h-10 items-center justify-center rounded-xl border border-accent bg-accent px-3 text-xs font-black text-white transition hover:bg-accent-hover" href={withBasePath(profileMessageHref(viewerId, member._id))} onClick={onClose}>Message</a>
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
        {resource.data?.restricted && <InlineNotice className="mt-4" tone="info">Only @{username} can see all {label.toLocaleLowerCase()}.</InlineNotice>}
        {isOwnProfile && !!resource.items.length && <ProfileContentFeedback error={resource.loadMoreError} hasMore={resource.hasMore} label={label.toLocaleLowerCase()} loadingMore={resource.loadingMore} retry={resource.retryLoadMore} sentinelRef={resource.sentinelRef} />}
      </Dialog>
      <ConfirmDialog busy={Boolean(pendingRemoval && busyId === pendingRemoval._id)} confirmLabel="Remove follower" description={pendingRemoval ? `Remove @${pendingRemoval.username} from your followers? They will no longer follow you.` : ''} onCancel={() => setPendingRemoval(null)} onConfirm={() => void removeFollower()} open={Boolean(pendingRemoval)} title="Remove follower?" tone="destructive" />
    </>
  )
}

function FinspoProfilePanel({ isOwnProfile, username, viewerId }: { isOwnProfile: boolean; username: string; viewerId?: string }) {
  const buildPath = useCallback((page: number) => contentPath(username, 'finspo', page), [username])
  const extractItems = useCallback((page: PaginatedProfileContent<GalleryPost>) => page.items, [])
  const resource = useInfiniteApiResource<GalleryPost, PaginatedProfileContent<GalleryPost>>(buildPath, extractItems, [username])
  const { showToast } = useToast()
  const [pendingAction, setPendingAction] = useState<{ action: 'archive' | 'delete'; post: GalleryPost } | null>(null)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')

  function openFinspo(event: MouseEvent<HTMLAnchorElement>, post: GalleryPost) {
    if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
    event.preventDefault()
    cacheFinspoPreview(post)
    navigateTo(`/community/finspo/${post._id}`, {
      sourceLabel: `@${username} Finspo`,
      trigger: captureNavigationTrigger(event.currentTarget),
    })
  }

  async function confirmAction() {
    if (!pendingAction || actionBusy) return
    const { action, post } = pendingAction
    setActionBusy(true)
    setActionError('')
    try {
      if (action === 'archive') await apiPost(`/community/gallery/${post._id}/archive`)
      else await apiDelete(`/community/gallery/${post._id}`)
      setPendingAction(null)
      await resource.refetch()
      showToast({
        message: action === 'archive' ? 'You can restore it from Archived Finspo for 30 days.' : 'The Finspo post was permanently removed.',
        title: action === 'archive' ? 'Finspo archived' : 'Finspo deleted',
        tone: 'success',
      })
    } catch (error) {
      const message = getErrorMessage(error, action === 'archive' ? 'Could not archive Finspo' : 'Could not delete Finspo')
      setActionError(message)
      showToast({ message, title: 'Finspo was not updated', tone: 'error' })
    } finally {
      setActionBusy(false)
    }
  }

  if (resource.initialLoading) return <FinspoFeedSkeleton count={8} label={`Loading @${username} Finspo`} showAuthor={false} />
  if (resource.error && !resource.items.length) {
    return <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Try again</button>} body={resource.error} layout="section" title="Finspo could not load" tone="error" />
  }
  if (!resource.items.length) {
    const action = isOwnProfile ? <div className="flex flex-wrap justify-center gap-2"><ButtonLink to="/community/finspo/new">Post Finspo</ButtonLink><ButtonLink to="/community/finspo/archived" variant="secondary">Archived Finspo</ButtonLink></div> : undefined
    return <StatePanel action={action} body={isOwnProfile ? 'Share a look or source of inspiration to start your profile collection.' : `@${username} has not shared any Finspo yet.`} layout="section" title="No Finspo posts" tone="empty" />
  }

  return (
    <>
      {isOwnProfile && (
        <div className="mb-3 flex justify-end">
          <ButtonLink to="/community/finspo/archived" variant="secondary">Archived Finspo</ButtonLink>
        </div>
      )}
      {actionError && <InlineNotice className="mb-3" tone="error">{actionError}</InlineNotice>}
      <FinspoMasonry className="profile-finspo-grid" gap={10} maxColumns={5} minColumnWidth={135} targetColumnWidth={190}>
        {resource.items.map((post) => (
          <article className="finspo-tile relative min-w-0" key={post._id}>
            <FinspoMediaCarousel
              alt={post.caption || `Finspo by @${username}`}
              className="block overflow-hidden rounded-xl bg-foose-surface-mid [&_img]:h-auto [&_img]:w-full [&_img]:object-contain [&_img]:transition-transform [&_img]:duration-300 [&_img]:ease-out hover:[&_img]:scale-[1.025] motion-reduce:[&_img]:transform-none motion-reduce:[&_img]:transition-none"
              href={withBasePath(`/community/finspo/${post._id}`)}
              images={finspoImages(post)}
              onNavigate={(event) => openFinspo(event, post)}
              surface="profile"
            />
            {isOwnProfile ? (
              <ProfileCardMenu
                items={[
                  { href: `/community/finspo/${post._id}/edit`, icon: <Icon name="pencil" size={17} />, label: 'Edit' },
                  { icon: <IoArchiveOutline size={18} />, label: 'Archive', onSelect: () => setPendingAction({ action: 'archive', post }) },
                  { icon: <Icon name="trash" size={17} />, label: 'Delete', onSelect: () => setPendingAction({ action: 'delete', post }), tone: 'danger' },
                ]}
                label={post.caption || 'Finspo post'}
              />
            ) : (
              <FinspoLikeButton className="absolute right-2 top-2 z-10 inline-flex size-9 items-center justify-center rounded-full bg-white/90 text-foose-ink shadow transition hover:bg-accent hover:text-white [&.is-active]:bg-accent [&.is-active]:text-white" initialCount={post.likes?.length} initialLiked={viewerId ? post.likes?.some((id) => String(id) === viewerId) : undefined} targetId={post._id} />
            )}
            <FinspoCaption caption={post.caption} />
          </article>
        ))}
      </FinspoMasonry>
      <ProfileContentFeedback error={resource.loadMoreError} hasMore={resource.hasMore} label="Finspo posts" loadingMore={resource.loadingMore} retry={resource.retryLoadMore} sentinelRef={resource.sentinelRef} />
      <ConfirmDialog
        busy={actionBusy}
        confirmLabel={pendingAction?.action === 'delete' ? 'Delete post' : 'Archive post'}
        description={pendingAction?.action === 'delete' ? 'This Finspo post will be permanently deleted. This action cannot be undone.' : 'This Finspo post will be hidden from your profile and kept in Archived Finspo for 30 days.'}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => void confirmAction()}
        open={Boolean(pendingAction)}
        title={pendingAction?.action === 'delete' ? 'Delete this post?' : 'Archive this post?'}
        tone={pendingAction?.action === 'delete' ? 'destructive' : 'default'}
      />
    </>
  )
}

function ListingsProfilePanel({ isOwnProfile, shop, username }: { isOwnProfile: boolean; shop?: Shop | null; username: string }) {
  const buildPath = useCallback((page: number) => contentPath(username, 'listings', page), [username])
  const extractItems = useCallback((page: PaginatedProfileContent<Listing>) => page.items, [])
  const resource = useInfiniteApiResource<Listing, PaginatedProfileContent<Listing>>(buildPath, extractItems, [username])

  if (resource.initialLoading) return <ProductGridSkeleton count={8} label={`Loading @${username} listings`} />
  if (resource.error && !resource.items.length) {
    return <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Try again</button>} body={resource.error} layout="section" title="Listings could not load" tone="error" />
  }
  if (!resource.items.length) {
    const action = isOwnProfile ? <ButtonLink to={shop ? '/listings/new' : '/open-shop'}>{shop ? 'Add listing' : 'Open a DigiShop'}</ButtonLink> : undefined
    return <StatePanel action={action} body={isOwnProfile ? 'Publish an active marketplace listing to display it here.' : `@${username} has no active listings right now.`} layout="section" title="No active listings" tone="empty" />
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 @[36rem]:grid-cols-3 @[48rem]:grid-cols-4">
        {resource.items.map((listing) => <ProductCard key={listing._id} listing={listing} manageHref={isOwnProfile ? `/listings/${listing._id}/edit` : undefined} />)}
      </div>
      <ProfileContentFeedback error={resource.loadMoreError} hasMore={resource.hasMore} label="listings" loadingMore={resource.loadingMore} retry={resource.retryLoadMore} sentinelRef={resource.sentinelRef} />
    </>
  )
}

function EventCard({ event, isOwnProfile, onDelete }: { event: Event; isOwnProfile: boolean; onDelete: (event: Event) => void }) {
  const statusTone = event.status === 'past' ? 'neutral' : event.status === 'ongoing' ? 'warning' : 'accent'
  return (
    <article className="relative overflow-visible rounded-xl border border-foose-border bg-foose-surface shadow-sm">
      {isOwnProfile && (
        <ProfileCardMenu
          items={[
            { href: `/community/events/${event._id}/manage`, icon: <Icon name="pencil" size={17} />, label: 'Manage' },
            { icon: <Icon name="trash" size={17} />, label: 'Delete', onSelect: () => onDelete(event), tone: 'danger' },
          ]}
          label={event.title}
        />
      )}
      <a className="block aspect-[16/9] overflow-hidden bg-foose-surface-mid" href={withBasePath(`/community/events/${event._id}`)}>
        <DiscoveryImage alt={`${event.title} cover`} className="h-full w-full object-cover transition duration-300 hover:scale-[1.02]" fallback="Event cover unavailable" fallbackClassName="h-full w-full" src={event.coverImage} />
      </a>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={statusTone}>{event.status || 'upcoming'}</Badge>
          <Badge>{eventTypeLabel(event)}</Badge>
        </div>
        <a className="block text-lg font-black leading-tight text-foose-text hover:text-accent" href={withBasePath(`/community/events/${event._id}`)}>{event.title}</a>
        <p className="flex items-start gap-2 text-sm text-foose-muted"><Icon name="calendar" size={17} /> <span>{eventTimeLabel(event)}</span></p>
        <p className="flex items-start gap-2 text-sm text-foose-muted"><Icon name="location" size={17} /> <span>{event.location || 'Hosted on Foose'}</span></p>
        <a className="inline-flex min-h-10 items-center font-black text-accent hover:underline" href={withBasePath(`/community/events/${event._id}`)}>View event</a>
      </div>
    </article>
  )
}

function EventsProfilePanel({ isOwnProfile, username }: { isOwnProfile: boolean; username: string }) {
  const buildPath = useCallback((page: number) => contentPath(username, 'events', page), [username])
  const extractItems = useCallback((page: PaginatedProfileContent<Event>) => page.items, [])
  const resource = useInfiniteApiResource<Event, PaginatedProfileContent<Event>>(buildPath, extractItems, [username])
  const { showToast } = useToast()
  const [pendingDelete, setPendingDelete] = useState<Event | null>(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [showPastEvents, setShowPastEvents] = useState(false)
  const currentEvents = resource.items.filter((event) => !eventWindowHasClosed(event))
  const pastEvents = resource.items.filter(eventWindowHasClosed)
  const visibleEvents = isOwnProfile && showPastEvents ? pastEvents : currentEvents

  async function deleteEvent() {
    if (!pendingDelete || deleteBusy) return
    setDeleteBusy(true)
    setDeleteError('')
    try {
      await apiDelete(`/community/events/${pendingDelete._id}`)
      setPendingDelete(null)
      await resource.refetch()
      showToast({ message: 'The event was removed from your profile and Community.', title: 'Event deleted', tone: 'success' })
    } catch (error) {
      const message = getErrorMessage(error, 'Could not delete event')
      setDeleteError(message)
      showToast({ message, title: 'Event was not deleted', tone: 'error' })
    } finally {
      setDeleteBusy(false)
    }
  }

  if (resource.initialLoading) return <EventGridSkeleton count={6} label={`Loading @${username} events`} />
  if (resource.error && !resource.items.length) {
    return <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Try again</button>} body={resource.error} layout="section" title="Events could not load" tone="error" />
  }
  if (!resource.items.length) {
    return <StatePanel action={isOwnProfile ? <ButtonLink to="/community/events/new">Add event</ButtonLink> : undefined} body={isOwnProfile ? 'Host an online or in-person event to display it here.' : `@${username} has not posted any events.`} layout="section" title="No posted events" tone="empty" />
  }

  return (
    <>
      {isOwnProfile && (
        <div className="mb-4 flex justify-end">
          <button aria-pressed={showPastEvents} className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => setShowPastEvents((current) => !current)} type="button">
            {showPastEvents ? 'Current events' : 'Past events'}
          </button>
        </div>
      )}
      {deleteError && <InlineNotice className="mb-3" tone="error">{deleteError}</InlineNotice>}
      {visibleEvents.length ? (
        <div className="grid gap-4 @[36rem]:grid-cols-2 @[52rem]:grid-cols-3">
          {visibleEvents.map((event) => <EventCard event={event} isOwnProfile={isOwnProfile} key={event._id} onDelete={setPendingDelete} />)}
        </div>
      ) : (
        <StatePanel
          action={showPastEvents ? undefined : isOwnProfile ? <ButtonLink to="/community/events/new">Add event</ButtonLink> : undefined}
          body={showPastEvents ? 'Events that have ended will appear here.' : isOwnProfile ? 'Add an event to display it on your profile.' : `@${username} has no upcoming or ongoing events.`}
          layout="section"
          title={showPastEvents ? 'No past events' : 'No current events'}
          tone="empty"
        />
      )}
      <ProfileContentFeedback error={resource.loadMoreError} hasMore={resource.hasMore} label="events" loadingMore={resource.loadingMore} retry={resource.retryLoadMore} sentinelRef={resource.sentinelRef} />
      <ConfirmDialog busy={deleteBusy} confirmLabel="Delete event" description={pendingDelete ? `Delete “${pendingDelete.title}”? This action cannot be undone.` : ''} onCancel={() => setPendingDelete(null)} onConfirm={() => void deleteEvent()} open={Boolean(pendingDelete)} title="Delete this event?" tone="destructive" />
    </>
  )
}

function ShopProfilePanel({ isOwnProfile, shop }: { isOwnProfile: boolean; shop?: Shop | null }) {
  if (!shop) {
    return (
      <section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-foose-border bg-foose-surface p-3 shadow-sm sm:p-4 lg:block lg:p-5" data-testid="profile-shop-card">
        <span className="inline-flex size-12 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent lg:rounded-xl"><Icon name="store" size={24} /></span>
        <div className="min-w-0 flex-1 lg:mt-4">
          <p className="text-[10px] font-black uppercase tracking-wide text-accent lg:text-xs">DigiShop</p>
          <h2 className="truncate text-base font-black text-foose-text lg:mt-1 lg:text-xl">No DigiShop yet</h2>
          <p className="hidden text-sm leading-6 text-foose-muted lg:mt-2 lg:block">{isOwnProfile ? 'Create a shop to sell through your profile.' : 'This member has not opened a DigiShop.'}</p>
        </div>
        {isOwnProfile && <ButtonLink className="shrink-0 whitespace-nowrap lg:mt-5 lg:w-full" to="/open-shop">Open a DigiShop</ButtonLink>}
      </section>
    )
  }

  const location = [shop.location?.city, shop.location?.region].filter(Boolean).join(', ')
  return (
    <section className="overflow-hidden rounded-2xl border border-foose-border bg-foose-surface shadow-sm" data-testid="profile-shop-card">
      <div className="hidden h-28 bg-foose-surface-mid lg:block">
        <DiscoveryImage alt={`${shop.shopName} banner`} className="h-full w-full object-cover" fallback="DigiShop banner" fallbackClassName="h-full w-full" src={shop.bannerUrl} />
      </div>
      <div className="flex flex-wrap items-center gap-3 p-3 sm:p-4 lg:block lg:p-5">
        <SafeImage alt={`${shop.shopName} logo`} className="size-14 shrink-0 rounded-full border-2 border-white object-cover shadow-sm lg:-mt-12 lg:mb-3 lg:size-16 lg:rounded-xl lg:border-4 lg:shadow-md" fallback={initials(shop.shopName)} fallbackClassName="bg-accent-light text-base font-black text-accent lg:text-lg" src={shop.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 lg:gap-2">
            <h2 className="min-w-0 truncate text-base font-black text-foose-text sm:text-lg lg:text-xl">{shop.shopName}</h2>
            {shop.category && <Badge tone="accent">{shop.category}</Badge>}
          </div>
          <p className="mt-2 hidden line-clamp-2 text-sm leading-6 text-foose-muted lg:block">{shop.bio || 'This DigiShop has not added a bio yet.'}</p>
          <div className="mt-3 hidden flex-wrap gap-2 text-xs font-semibold text-foose-muted lg:flex">
            <span className="rounded-full bg-foose-surface-low px-2.5 py-1">{shop.rating || 0} / 5 rating</span>
            {location && <span className="rounded-full bg-foose-surface-low px-2.5 py-1">{location}</span>}
          </div>
        </div>
        <div className="shrink-0 lg:mt-4 lg:grid lg:gap-2 xl:grid-cols-2">
          <ButtonLink className="whitespace-nowrap lg:w-full" to={`/shops/${shop.slug}`} variant="secondary">View shop</ButtonLink>
          {isOwnProfile && <ButtonLink className="hidden lg:inline-flex lg:w-full" to="/manage-shop">Manage shop</ButtonLink>}
        </div>
      </div>
    </section>
  )
}

function contextualOwnerAction(tab: ProfileTab, shop?: Shop | null) {
  if (tab === 'finspo') return { href: '/community/finspo/new', label: 'Post Finspo' }
  if (tab === 'listings') return shop ? { href: '/listings/new', label: 'Add listing' } : { href: '/open-shop', label: 'Open a DigiShop' }
  return { href: '/community/events/new', label: 'Add event' }
}

export function ProfilePage() {
  const { status, user } = useAuth()
  const { showToast } = useToast()
  const username = profileUsername()
  const activeTab = currentProfileTab()
  const [visitedTabs, setVisitedTabs] = useState<Set<ProfileContentType>>(() => new Set([activeTab]))
  const isExplicitOwnProfile = Boolean(username && user?.username && username.toLocaleLowerCase() === user.username.toLocaleLowerCase())
  const path = username ? `/users/${username}/profile` : user ? '/users/me/profile' : null
  const profile = useApiResource<ProfileSummary>(path)
  const [followError, setFollowError] = useState('')
  const [followAnnouncement, setFollowAnnouncement] = useState('')
  const [followBusy, setFollowBusy] = useState(false)
  const [followState, setFollowState] = useState<{ count?: number; following?: boolean }>({})
  const [followingCountState, setFollowingCountState] = useState<{ count: number; profileId: string } | null>(null)
  const [connectionState, setConnectionState] = useState<{ open: ProfileConnectionType | null; profileId: string; visited: Set<ProfileConnectionType> }>(() => ({ open: null, profileId: '', visited: new Set() }))
  const [shareBusy, setShareBusy] = useState(false)
  const data = profile.data
  const isOwnProfile = Boolean(data && user && data.user.username === user.username)
  const followerCount = followState.count ?? data?.followerCount ?? 0
  const followingCount = data && followingCountState?.profileId === data.user._id ? followingCountState.count : data?.followingCount ?? 0
  const isFollowing = followState.following ?? Boolean(data?.isFollowing)
  const activeConnections = data && connectionState.profileId === data.user._id ? connectionState : null
  const shouldRedirectToAuth = !username && status === 'guest' && !user

  useEffect(() => {
    if (shouldRedirectToAuth) navigateTo(authHref('/login', '/profile'))
  }, [shouldRedirectToAuth])

  async function toggleFollow() {
    if (!data) return
    if (!user) {
      navigateTo(authHref('/login'))
      return
    }
    setFollowError('')
    setFollowBusy(true)
    try {
      const result = await apiPost<{ followerCount: number; following: boolean }>(`/users/${data.user.username}/follow`)
      setFollowState({ count: result.followerCount, following: result.following })
      setFollowAnnouncement(result.following ? `You are now following ${data.user.name}` : `You unfollowed ${data.user.name}`)
    } catch (error) {
      setFollowError(getErrorMessage(error, 'Could not update follow status'))
    } finally {
      setFollowBusy(false)
    }
  }

  async function shareProfile() {
    if (!data || shareBusy) return
    const url = profileShareUrl(data.user.username)
    setShareBusy(true)

    try {
      if (navigator.share) {
        await navigator.share({
          text: `View @${data.user.username} on Foose.`,
          title: `${data.user.name} on Foose`,
          url,
        })
        showToast({ message: 'The profile link is ready to share.', title: 'Profile shared', tone: 'success' })
        return
      }

      if (!navigator.clipboard) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(url)
      showToast({ message: 'The profile link was copied to your clipboard.', title: 'Link copied', tone: 'success' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return

      if (!navigator.clipboard) {
        showToast({ message: 'The profile link could not be shared. Please try again.', title: 'Share failed', tone: 'error' })
        return
      }

      try {
        await navigator.clipboard.writeText(url)
        showToast({ message: 'The profile link was copied to your clipboard.', title: 'Link copied', tone: 'success' })
      } catch {
        showToast({ message: 'The profile link could not be shared. Please try again.', title: 'Share failed', tone: 'error' })
      }
    } finally {
      setShareBusy(false)
    }
  }

  if (!username && status === 'checking' && !user) return <LoadingState label="Checking your session" layout="page" variant="spinner" />
  if (shouldRedirectToAuth) return <LoadingState label="Redirecting to sign in" layout="page" variant="spinner" />

  const ownerAction = data && isOwnProfile ? contextualOwnerAction(activeTab, data.shop) : null
  const messageTarget = data ? profileMessageHref(user?._id, data.user._id) : '/inbox'
  const messageHref = user ? messageTarget : authHref('/login', messageTarget)

  return (
    <AppShell active="profile" searchPlaceholder="Search Foose...">
      {username && !isExplicitOwnProfile && !isOwnProfile && <NavigationBackButton className="mb-5" fallback={{ href: '/', label: 'Home' }} />}
      {profile.initialLoading && <ProfilePageSkeleton />}
      <RefreshIndicator active={profile.refreshing} className="mb-4" label="Refreshing profile" />
      {profile.error && !data && <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={profile.refetch} type="button">Try again</button>} body={profile.error} layout="page" title={profile.errorMeta?.status === 404 ? 'This profile is unavailable' : 'Profile could not load'} tone={profile.errorMeta?.status === 403 ? 'permission' : profile.errorMeta?.status === 404 ? 'unavailable' : 'error'} />}
      {profile.error && data && <InlineNotice action={<button className="font-black text-accent" onClick={profile.refetch} type="button">Retry</button>} tone="warning">This profile could not refresh. Showing the last loaded details.</InlineNotice>}
      <span aria-live="polite" className="sr-only">{followAnnouncement}</span>
      {data && (
        <>
          <section className="mb-4 rounded-2xl bg-foose-surface p-3 sm:p-4 lg:p-6" data-testid="profile-identity-band">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:gap-x-4 lg:gap-x-6">
              <div className="relative shrink-0">
                {data.user.profilePhoto ? <img alt="" className="size-20 rounded-full object-cover ring-3 ring-foose-surface sm:size-24 lg:size-28" src={data.user.profilePhoto} /> : <span className="inline-flex size-20 items-center justify-center rounded-full bg-accent-light text-xl font-black text-accent ring-3 ring-foose-surface sm:size-24 sm:text-2xl lg:size-28 lg:text-3xl">{initials(data.user.name)}</span>}
                {data.user.isKycVerified && <span className="absolute bottom-0 right-0 inline-flex size-8 items-center justify-center rounded-full bg-accent text-white ring-3 ring-foose-surface sm:size-9"><MdVerified aria-label="Verified profile" /></span>}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="min-w-0 break-words text-xl font-bold leading-tight text-foose-text sm:text-2xl lg:text-3xl">{data.user.name}</h1>
                  {data.user.hasShop && <span className="rounded-full bg-accent-light px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-accent sm:text-xs">Seller</span>}
                </div>
                <p className="mt-0.5 truncate text-sm font-bold text-accent sm:text-base">@{data.user.username}</p>
              </div>

              <p className="col-span-2 max-w-[65ch] break-words text-sm leading-6 text-foose-muted lg:col-start-2 lg:text-base lg:leading-7">{data.user.bio || "I'm just a Foose member finding curated second-hand gems."}</p>

              <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:col-start-2">
                <div className="flex items-center gap-5 sm:gap-7" aria-label="Profile connections">
                  <button aria-haspopup="dialog" aria-label={`View ${followerCount} followers`} className="flex min-h-11 cursor-pointer flex-col items-center justify-center border-0 bg-transparent p-0 text-center text-foose-text" onClick={() => setConnectionState((current) => ({ open: 'followers', profileId: data.user._id, visited: new Set([...(current.profileId === data.user._id ? current.visited : []), 'followers']) }))} type="button">
                    <strong className="text-lg font-black leading-none sm:text-xl">{followerCount}</strong>
                    <span className="mt-1 text-xs font-bold text-foose-muted">Followers</span>
                  </button>
                  <button aria-haspopup="dialog" aria-label={`View ${followingCount} following`} className="flex min-h-11 cursor-pointer flex-col items-center justify-center border-0 bg-transparent p-0 text-center text-foose-text" onClick={() => setConnectionState((current) => ({ open: 'following', profileId: data.user._id, visited: new Set([...(current.profileId === data.user._id ? current.visited : []), 'following']) }))} type="button">
                    <strong className="text-lg font-black leading-none sm:text-xl">{followingCount}</strong>
                    <span className="mt-1 text-xs font-bold text-foose-muted">Following</span>
                  </button>
                </div>

                <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto">
                  {!isOwnProfile && (
                    <>
                      <button aria-busy={followBusy} aria-label={`${isFollowing ? 'Unfollow' : 'Follow'} @${data.user.username}`} aria-pressed={isFollowing} className={`inline-flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 text-sm font-black transition disabled:pointer-events-none disabled:opacity-60 sm:flex-none sm:px-5 ${isFollowing ? 'border-foose-border bg-foose-surface text-foose-text hover:border-foose-danger hover:text-foose-danger' : 'border-accent bg-accent text-white shadow-md shadow-accent/15 hover:bg-accent-hover'}`} disabled={followBusy} onClick={() => void toggleFollow()} type="button">{followBusy ? 'Updating…' : isFollowing ? 'Unfollow' : 'Follow'}</button>
                      <a className="inline-flex min-h-11 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-foose-border bg-foose-surface px-3 text-sm font-black text-foose-text transition hover:border-accent hover:text-accent sm:flex-none sm:px-5" href={withBasePath(messageHref)}><IoChatbubbleOutline size={18} /> Message</a>
                    </>
                  )}
                  {isOwnProfile && <ButtonLink className="min-w-0 flex-1 sm:flex-none" to="/profile/settings">Edit Profile</ButtonLink>}
                  <button aria-busy={shareBusy} aria-label="Share profile" className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-foose-border bg-foose-surface text-foose-text transition hover:border-accent hover:text-accent disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent" disabled={shareBusy} onClick={() => void shareProfile()} title="Share profile" type="button"><IoShareSocialOutline size={20} /></button>
                  {!isOwnProfile && <ProfileSafetyMenu />}
                </div>
              </div>
            </div>
          </section>
          {followError && <InlineNotice className="mb-5" title="Follow status did not update" tone="error">{followError}</InlineNotice>}

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
            <aside aria-label="Shop profile" className="order-first lg:order-last lg:sticky lg:top-24">
              <ShopProfilePanel isOwnProfile={isOwnProfile} shop={data.shop} />
            </aside>
            <div className="min-w-0">
              <nav aria-label="Profile sections" className="sticky top-16 lg:top-[78px] z-30 mb-5 overflow-hidden border-b border-foose-border bg-foose-bg/95 backdrop-blur">
                <div className="grid w-full grid-cols-3 items-center">
              {PROFILE_TABS.map((tab) => {
                const count = data.contentCounts[tab.value]
                const active = activeTab === tab.value
                const accessibleLabel = tab.value === 'finspo'
                  ? `${tab.label}, ${count} ${count === 1 ? 'post' : 'posts'}`
                  : `${tab.label}, ${count} ${count === 1 ? tab.value.slice(0, -1) : tab.value}`
                return (
                  <a aria-current={active ? 'page' : undefined} aria-label={accessibleLabel} className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 px-1 text-xs font-black transition focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent sm:gap-2 sm:px-3 sm:text-sm ${active ? 'border-accent text-accent' : 'border-transparent text-foose-muted hover:border-accent/40 hover:text-accent'}`} href={withBasePath(profilePageHref(username, tab.value))} id={`profile-tab-${tab.value}`} key={tab.value} onClick={() => {
                    setVisitedTabs((current) => current.has(tab.value) ? current : new Set([...current, tab.value]))
                  }}>
                    {tab.label}
                    <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] sm:px-2 sm:text-[11px] ${active ? 'text-accent' : 'text-foose-faint'}`}>{count}</span>
                  </a>
                )
              })}
                </div>
              </nav>

              <div className="@container min-h-72">
                {(activeTab === 'finspo' || visitedTabs.has('finspo')) && <ProfilePanel active={activeTab === 'finspo'} id="finspo"><FinspoProfilePanel isOwnProfile={isOwnProfile} key={`${data.user.username}:finspo`} username={data.user.username} viewerId={user?._id} /></ProfilePanel>}
                {(activeTab === 'listings' || visitedTabs.has('listings')) && <ProfilePanel active={activeTab === 'listings'} id="listings"><ListingsProfilePanel isOwnProfile={isOwnProfile} key={`${data.user.username}:listings`} shop={data.shop} username={data.user.username} /></ProfilePanel>}
                {(activeTab === 'events' || visitedTabs.has('events')) && <ProfilePanel active={activeTab === 'events'} id="events"><EventsProfilePanel isOwnProfile={isOwnProfile} key={`${data.user.username}:events`} username={data.user.username} /></ProfilePanel>}
              </div>
            </div>
          </div>
          <ProfileConnectionsDialog
            followerCount={followerCount}
            followingCount={followingCount}
            isOwnProfile={isOwnProfile}
            key={data.user.username}
            onClose={() => setConnectionState((current) => ({ ...current, open: null }))}
            onFollowerCountChange={(count) => setFollowState((current) => ({ ...current, count }))}
            onFollowingCountChange={(count) => setFollowingCountState({ count, profileId: data.user._id })}
            selected={activeConnections?.open || null}
            username={data.user.username}
            visited={activeConnections?.visited || new Set()}
            viewerId={user?._id}
          />
        </>
      )}
      {ownerAction && <FloatingCreateButton href={ownerAction.href} label={ownerAction.label} />}
    </AppShell>
  )
}
