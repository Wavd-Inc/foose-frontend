import { useCallback, useEffect, useState, type MouseEvent } from 'react'
import { AppShell, ButtonLink, FavoriteButton, FinspoAccountSuggestions, FinspoAccountSuggestionsSkeleton, FinspoLikeButton, FinspoMasonry, FinspoMediaCarousel, FinspoSkeletonTile, FloatingCreateButton, InlineNotice, LoadingState, RefreshIndicator, StatePanel } from '../components'
import { AppendFeedback, EventGridSkeleton } from '../components/feedback/DiscoverySkeletons'
import { DiscoveryImage } from '../components/feedback/DiscoveryMedia'
import { useAuth } from '../hooks/useAuth'
import { useApiResource } from '../hooks/useApiResource'
import { useFinspoFeed, type FinspoFeedSnapshot } from '../hooks/useFinspoFeed'
import { useImageBatchReady } from '../hooks/useImageBatchReady'
import { useInfiniteApiResource, type InfiniteResourceSnapshot } from '../hooks/useInfiniteApiResource'
import { usePageNavigationSnapshot } from '../hooks/usePageNavigationSnapshot'
import { getNavigationSnapshot } from '../stores/navigationMemoryStore'
import type { Event, FinspoAccountSuggestion, FollowingFinspoFeed, GalleryPost } from '../types/api'
import { authHref } from '../utils/authRedirect'
import { communityMineRedirect } from '../utils/communityNavigation'
import { eventHostName, eventTimeLabel, eventTypeLabel, isOnlinePopUp } from '../utils/events'
import { finspoImages } from '../utils/finspoImages'
import { cacheFinspoPreview, captureNavigationTrigger, navigateTo, withBasePath } from '../utils/navigation'
import { isActiveEventPromotion } from '../utils/promotions'

type CommunityMainTab = 'events' | 'finspo'
type EventFilter = 'all' | 'featured' | 'weekend' | 'in-person' | 'online'
type FinspoScope = 'following' | 'public'
type PaginatedEvents = { events: Event[]; page: number; pages: number; total: number }
const FINSPO_MASONRY_LAYOUT = { gap: 10, maxColumns: 5, minColumnWidth: 135, minColumns: 2, targetColumnWidth: 220 } as const
type CommunityFinspoNavigationSnapshot = {
  failedImages: string[]
  items: GalleryPost[]
  publicFeed: FinspoFeedSnapshot | null
  scope: FinspoScope
  version: 1
}
type CommunityEventsNavigationSnapshot = {
  events: InfiniteResourceSnapshot<Event, PaginatedEvents>
  filter: EventFilter
  version: 1
}

function initialCommunityState() {
  const params = new URLSearchParams(window.location.search)
  const tab = params.get('tab') === 'events' ? 'events' : 'finspo'
  const scope = params.get('scope')
  const requestedFilter = params.get('filter')
  const eventFilter: EventFilter = requestedFilter === 'featured' || requestedFilter === 'weekend' || requestedFilter === 'in-person' || requestedFilter === 'online'
    ? requestedFilter
    : scope === 'featured' ? 'featured' : 'all'

  return {
    eventFilter,
    finspoScope: scope === 'following' ? scope : 'public',
    legacyMine: scope === 'mine',
    mainTab: tab,
  } as const
}

function isPromotedEvent(event: Event) {
  return isActiveEventPromotion(event.promotionTags, event.promotionExpiresAt, event.status)
}

function finspoAuthor(post: GalleryPost) {
  if (post.userId && typeof post.userId === 'object') return `@${post.userId.username}`
  return 'Foose member'
}

function finspoAuthorHref(post: GalleryPost) {
  if (post.userId && typeof post.userId === 'object') return `/profile/${post.userId.username}`
  return '#'
}

function refreshScopedFinspoOrder(current: GalleryPost[], incoming: GalleryPost[]) {
  const refreshed = new Map(incoming.map((post) => [post._id, post]))
  const known = new Set(current.map((post) => post._id))
  return [
    ...current.filter((post) => refreshed.has(post._id)).map((post) => refreshed.get(post._id) || post),
    ...incoming.filter((post) => !known.has(post._id)),
  ]
}

function openFinspo(event: MouseEvent<HTMLAnchorElement>, post: GalleryPost, sourceLabel: string) {
  if (event.button !== 0 || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return
  event.preventDefault()
  cacheFinspoPreview(post)
  navigateTo(`/community/finspo/${post._id}`, {
    sourceLabel,
    trigger: captureNavigationTrigger(event.currentTarget),
  })
}

export function CommunityPage() {
  const initialState = initialCommunityState()
  const { refreshUser, status, user } = useAuth()
  const [mainTab] = useState<CommunityMainTab>(initialState.mainTab)
  const [eventFilter] = useState<EventFilter>(initialState.eventFilter)
  const [finspoScope] = useState<FinspoScope>(initialState.finspoScope)
  const [restoredFinspo] = useState<CommunityFinspoNavigationSnapshot | null>(() => {
    const snapshot = getNavigationSnapshot<CommunityFinspoNavigationSnapshot>(`community-finspo:${initialState.finspoScope}`)?.data
    return snapshot?.version === 1 && snapshot.scope === initialState.finspoScope ? snapshot : null
  })
  const [restoredEvents] = useState<CommunityEventsNavigationSnapshot | null>(() => {
    const snapshot = getNavigationSnapshot<CommunityEventsNavigationSnapshot>(`community-events:${initialState.eventFilter}`)?.data
    return snapshot?.version === 1 && snapshot.filter === initialState.eventFilter ? snapshot : null
  })
  const [suggestionSession, setSuggestionSession] = useState<{ accounts: FinspoAccountSuggestion[]; personalized: boolean; userId: string } | null>(null)
  const eventsPath = useCallback((page: number) => `/community/events?page=${page}&limit=12&filter=${eventFilter}`, [eventFilter])
  const extractEvents = useCallback((data: PaginatedEvents) => data.events || [], [])
  const events = useInfiniteApiResource(eventsPath, extractEvents, [eventFilter], restoredEvents?.events ?? null)
  const promotedEvents = useApiResource<{ events: Event[] }>('/community/events/featured', mainTab === 'events' && eventFilter === 'all')
  usePageNavigationSnapshot<CommunityEventsNavigationSnapshot>({
    capture: () => ({ events: events.navigationSnapshot, filter: eventFilter, version: 1 }),
    namespace: `community-events:${eventFilter}`,
    ready: !events.loading,
  })
  const gallery = useFinspoFeed({
    enabled: mainTab === 'finspo',
    initialSnapshot: restoredFinspo?.publicFeed,
  })
  const followingGallery = useApiResource<FollowingFinspoFeed>('/community/gallery/following', Boolean(user && mainTab === 'finspo' && finspoScope === 'following'))

  const publicEvents = events.items
  const heroEvent = (eventFilter === 'all' ? promotedEvents.data?.events?.find(isPromotedEvent) : undefined) || publicEvents[0]
  const visibleEvents = publicEvents.filter((event) => event._id !== heroEvent?._id)
  const finspoSource = followingGallery
  const incomingScopedFinspoItems = finspoSource.data?.posts
  const restoredScopedFinspoItems = restoredFinspo?.items || []
  const scopedFinspoItems = incomingScopedFinspoItems
    ? refreshScopedFinspoOrder(restoredScopedFinspoItems, incomingScopedFinspoItems)
    : restoredScopedFinspoItems
  const scopedImages = useImageBatchReady(
    scopedFinspoItems.flatMap(finspoImages),
    finspoScope === 'following' && (!finspoSource.loading || Boolean(restoredScopedFinspoItems.length)),
  )
  const failedScopedImages = new Set([...(restoredFinspo?.failedImages || []), ...scopedImages.failed])
  const readyScopedFinspoItems = scopedImages.ready ? scopedFinspoItems : []
  const finspoItems = finspoScope === 'public' ? gallery.items : readyScopedFinspoItems
  const activeFinspoError = finspoScope === 'public' ? gallery.error : finspoSource.error
  const activeFinspoLoading = finspoScope === 'public'
    ? gallery.loading
    : (finspoSource.loading && !restoredScopedFinspoItems.length) || (!finspoSource.error && !scopedImages.ready)
  const activeFinspoRefetch = finspoScope === 'public' ? gallery.refetch : finspoSource.refetch
  const restorationMedia = useImageBatchReady(
    finspoItems.flatMap(finspoImages),
    mainTab === 'finspo' && !activeFinspoLoading,
  )
  const activeFailedImages = finspoScope === 'public'
    ? Array.from(gallery.failedImageSet)
    : Array.from(failedScopedImages)
  const restorationReady = mainTab !== 'finspo' || (!activeFinspoLoading && restorationMedia.ready)
  usePageNavigationSnapshot<CommunityFinspoNavigationSnapshot>({
    capture: () => ({
      failedImages: activeFailedImages,
      items: finspoItems,
      publicFeed: gallery.snapshot,
      scope: finspoScope,
      version: 1,
    }),
    mediaHeavy: true,
    namespace: `community-finspo:${finspoScope}`,
    ready: restorationReady,
  })
  const responseSuggestions = followingGallery.data?.suggestedAccounts || []
  const activeSuggestionSession = suggestionSession && suggestionSession.userId === user?._id ? suggestionSession : null
  const finspoAccountSuggestions = finspoScope === 'following'
    ? (activeSuggestionSession?.accounts || responseSuggestions)
    : []
  const suggestionsPersonalized = activeSuggestionSession
    ? activeSuggestionSession.personalized
    : Boolean(followingGallery.data?.suggestionMeta?.personalized)

  useEffect(() => {
    if (!initialState.legacyMine || status === 'checking') return
    const destination = communityMineRedirect(window.location.search, Boolean(user))
    if (destination) navigateTo(destination)
  }, [initialState.legacyMine, status, user])

  async function refreshFollowingAfterSuggestion() {
    if (user && responseSuggestions.length && suggestionSession?.userId !== user._id) {
      setSuggestionSession({
        accounts: responseSuggestions,
        personalized: Boolean(followingGallery.data?.suggestionMeta?.personalized),
        userId: user._id,
      })
    }
    await Promise.allSettled([refreshUser(), followingGallery.refetch()])
  }

  function addEventHref() {
    return user || status === 'checking' ? withBasePath('/community/events/new') : authHref('/login', '/community/events/new', { closeToHome: true })
  }

  function addFinspoHref() {
    return user || status === 'checking' ? withBasePath('/community/finspo/new') : authHref('/login', '/community/finspo/new', { closeToHome: true })
  }

  function renderFloatingCreateButton() {
    const isFinspo = mainTab === 'finspo'
    return <div className={isFinspo ? '' : 'sm:hidden'}><FloatingCreateButton href={isFinspo ? addFinspoHref() : addEventHref()} label={isFinspo ? 'Post Finspo' : 'Add event'} /></div>
  }

  function renderEventCard(event: Event) {
    return (
      <article className="event-card min-w-0" key={event._id}>
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-foose-surface-mid">
          <a className="block h-full w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover" href={withBasePath(`/community/events/${event._id}`)}>
            <DiscoveryImage alt={`${event.title} cover`} fallback="Event cover unavailable" fallbackClassName="h-full w-full" src={event.coverImage} />
          </a>
          <span className="absolute left-3 top-3 rounded-full bg-foose-surface px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wide text-foose-text shadow-sm">{eventTypeLabel(event)}</span>
          <FavoriteButton className="favorite-button absolute right-3 top-3 flex size-9 items-center justify-center rounded-full bg-foose-surface text-foose-text shadow-sm transition hover:text-accent [&.is-active]:text-accent" targetId={event._id} targetType="event" />
        </div>
        <div className="pt-3">
          <p className="mb-1 text-xs font-extrabold text-accent">{eventTimeLabel(event)}</p>
          <h2 className="text-base font-bold leading-snug text-foose-text"><a className="hover:text-accent" href={withBasePath(`/community/events/${event._id}`)}>{event.title}</a></h2>
          <p className="mt-1 text-xs text-foose-muted">{isOnlinePopUp(event) ? 'Hosted on Foose' : event.location || 'Location pending'} · {eventHostName(event)}</p>
        </div>
      </article>
    )
  }

  function renderEventHero(event: Event) {
    const promoted = isPromotedEvent(event)
    return (
      <article className="mb-7 grid overflow-hidden rounded-2xl border border-foose-border bg-foose-surface-low md:grid-cols-[1.25fr_1fr]">
        <a className="block h-40 bg-foose-surface-mid sm:h-48 md:h-[230px] [&_img]:h-full [&_img]:w-full [&_img]:object-cover" href={withBasePath(`/community/events/${event._id}`)}>
          <DiscoveryImage alt={`${event.title} cover`} fallback="Event cover unavailable" fallbackClassName="h-full w-full" loading="eager" src={event.coverImage} />
        </a>
        <div className="flex min-w-0 flex-col items-start justify-center gap-2 p-4 sm:p-5 md:p-6">
          <span className="max-w-full truncate text-[10px] font-extrabold uppercase tracking-[.14em] text-accent">{promoted ? 'Featured event' : 'Up next'} · {isOnlinePopUp(event) ? 'Online' : event.location || 'Location pending'}</span>
          <h2 className="line-clamp-2 font-display text-2xl font-bold leading-tight text-foose-text lg:text-3xl" title={event.title}>{event.title}</h2>
          <p className="max-w-full truncate text-xs font-semibold text-foose-muted">{eventTimeLabel(event)} · {eventHostName(event)}</p>
          {event.description && <p className="line-clamp-1 text-xs leading-5 text-foose-muted">{event.description}</p>}
          <a className="mt-1 inline-flex min-h-9 items-center justify-center rounded-lg bg-accent px-4 py-2 text-xs font-bold text-white transition hover:bg-accent-hover" href={withBasePath(`/community/events/${event._id}`)}>Explore event <span aria-hidden="true" className="ml-2">↗</span></a>
        </div>
      </article>
    )
  }

  function renderFinspoTile(post: GalleryPost) {
    const sourceLabel = finspoScope === 'following'
        ? 'Following Finspo'
        : 'Finspo'
    const images = finspoImages(post)
    const hasMultipleImages = images.length > 1
    return (
      <article className="finspo-tile relative min-w-0 overflow-hidden rounded-2xl bg-foose-surface-mid shadow-sm" key={post._id}>
        <FinspoMediaCarousel
          alt={post.caption || `Finspo by ${finspoAuthor(post)}`}
          className="finspo-image rounded-none finspo-tile-link"
          href={withBasePath(`/community/finspo/${post._id}`)}
          images={images}
          onNavigate={(event) => openFinspo(event, post, sourceLabel)}
          surface="feed"
        />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
        <FinspoLikeButton className="favorite-button absolute right-2 top-2 z-10 inline-flex size-8 shrink-0 items-center justify-center rounded-full border border-white/70 bg-white/95 text-foose-ink shadow-sm transition hover:bg-accent-light hover:text-accent [&.is-active]:border-accent [&.is-active]:bg-accent [&.is-active]:text-white" initialCount={post.likes?.length} initialLiked={user ? post.likes?.some((userId) => String(userId) === user._id) : undefined} targetId={post._id} />
        <div className={`pointer-events-none absolute inset-x-0 z-10 px-3 text-white ${hasMultipleImages ? 'bottom-11' : 'bottom-3'}`}>
          {post.caption && <p className="line-clamp-2 text-xs font-bold leading-4 drop-shadow-sm">{post.caption}</p>}
          <a className="finspo-author-link pointer-events-auto mt-1 inline-flex min-h-5 items-center text-[11px] font-semibold text-white/90 hover:text-white hover:underline" href={finspoAuthorHref(post)}>{finspoAuthor(post)}</a>
        </div>
        {!!post.tags?.length && <span className="sr-only">{post.tags.map((tag) => `#${tag}`).join(' ')}</span>}
      </article>
    )
  }

  function renderEventFilters() {
    const filters: { label: string; value: EventFilter }[] = [
      { label: 'All events', value: 'all' },
      { label: 'Featured', value: 'featured' },
      { label: 'This weekend', value: 'weekend' },
      { label: 'In person', value: 'in-person' },
      { label: 'Online', value: 'online' },
    ]
    return (
      <nav aria-label="Filter events" className="mb-7 flex gap-2 overflow-x-auto pb-2">
        {filters.map(({ label, value }) => <a
          aria-current={eventFilter === value ? 'page' : undefined}
          className={`shrink-0 rounded-full border px-4 py-2.5 text-xs font-bold transition ${eventFilter === value ? 'border-foose-text bg-foose-text text-foose-bg' : 'border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent'}`}
          href={withBasePath(`/community?tab=events&filter=${value}`)}
          key={value}
        >{label}</a>)}
      </nav>
    )
  }

  function renderFinspoTabs() {
    return (
      <nav className="mb-5 flex items-center gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Browse Finspo">
        <a aria-current={finspoScope === 'public' ? 'page' : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-xs font-bold transition ${finspoScope === 'public' ? 'border-foose-text bg-foose-text text-foose-bg' : 'border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent'}`} href={withBasePath('/community?tab=finspo&scope=public')}>Public</a>
        <a aria-current={finspoScope === 'following' ? 'page' : undefined} className={`inline-flex min-h-10 shrink-0 items-center rounded-full border px-4 text-xs font-bold transition ${finspoScope === 'following' ? 'border-foose-text bg-foose-text text-foose-bg' : 'border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent'}`} href={user ? withBasePath('/community?tab=finspo&scope=following') : authHref('/login', '/community?tab=finspo&scope=following')}>Following</a>
        <span aria-hidden="true" className="mx-1 h-5 shrink-0 border-l border-foose-border" />
        <a className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-foose-border bg-foose-surface px-4 text-xs font-bold text-foose-text transition hover:border-accent hover:text-accent" href={withBasePath('/community?tab=finspo&scope=public')}>All looks</a>
        <a className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-foose-border bg-foose-surface px-4 text-xs font-bold text-foose-text transition hover:border-accent hover:text-accent" href={withBasePath('/search?tag=denim&tab=finspo')}>Denim</a>
        <a className="inline-flex min-h-10 shrink-0 items-center rounded-full border border-foose-border bg-foose-surface px-4 text-xs font-bold text-foose-text transition hover:border-accent hover:text-accent" href={withBasePath('/search?tag=vintage&tab=finspo')}>Vintage</a>
      </nav>
    )
  }

  function renderEventPanel() {
    const filterLabels: Record<EventFilter, string> = {
      all: 'More to explore',
      featured: 'Featured events',
      weekend: 'This weekend',
      'in-person': 'In-person events',
      online: 'Online events',
    }
    return (
      <section className="community-panel mx-auto w-full max-w-[1280px]">
        <div className="mb-7 flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[.15em] text-accent">Discover / Events</p>
            <h1 className="font-display text-3xl font-bold leading-tight text-foose-text sm:text-5xl">Find your next good find.</h1>
            <p className="mt-2 text-sm text-foose-muted">Pop-ups, thrift markets, and creative gatherings around you.</p>
          </div>
          <a className="hidden min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover sm:inline-flex" href={addEventHref()}>＋ Host an event</a>
        </div>
        {renderEventFilters()}
        <RefreshIndicator active={events.refreshing} className="mb-4" label="Refreshing community events" />
        {heroEvent && renderEventHero(heroEvent)}
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-foose-text sm:text-xl">{filterLabels[eventFilter]}</h2>
          {eventFilter !== 'all' && <a className="text-xs font-bold text-accent hover:underline" href={withBasePath('/community?tab=events&filter=all')}>See all events →</a>}
        </div>
        {events.loading && !publicEvents.length && <EventGridSkeleton count={6} label="Loading community events" />}
        {events.error && !publicEvents.length && <StatePanel action={<button className="button button-secondary" onClick={events.refetch} type="button">Try again</button>} body={events.error} layout="section" title="Community events could not load" tone="error" />}
        {events.error && !!publicEvents.length && <InlineNotice action={<button className="font-black text-accent" onClick={events.refetch} type="button">Retry</button>} tone="warning">Community events could not refresh. Showing the current events.</InlineNotice>}
        {!events.loading && !events.error && !publicEvents.length && <StatePanel action={eventFilter === 'all' ? <ButtonLink to="/community/events/new">Add an event</ButtonLink> : <ButtonLink to="/community?tab=events&filter=all">See all events</ButtonLink>} body={eventFilter === 'all' ? 'Be the first to publish a community event or pop-up.' : 'Try another filter to find more events.'} layout="section" title={eventFilter === 'all' ? 'No events yet' : 'No matching events'} tone="empty" />}
        {!!visibleEvents.length && <div className="event-grid grid grid-cols-1 gap-x-5 gap-y-7 sm:grid-cols-2 lg:grid-cols-4">{visibleEvents.map((event) => renderEventCard(event))}</div>}
        {!events.loading && !events.error && !!heroEvent && !visibleEvents.length && <p className="text-sm text-foose-muted">More events will appear here soon.</p>}
        <div ref={events.sentinelRef} className="flex min-h-14 items-center justify-center py-4">
          <AppendFeedback error={events.loadMoreError} label="Loading more community events" loading={events.loadingMore} retry={events.retryLoadMore} />
        </div>
      </section>
    )
  }
  function renderFinspoPanel() {
    return (
      <section className="community-panel mx-auto w-full max-w-[1280px]">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-extrabold uppercase tracking-[.15em] text-accent">Community / Finspo</p>
            <h1 className="font-sans text-3xl font-extrabold leading-tight tracking-tight text-foose-text sm:text-4xl">Looks worth a second look.</h1>
            <p className="mt-2 text-sm text-foose-muted">Find real style from the Foose community.</p>
          </div>
          <a className="hidden min-h-11 items-center justify-center rounded-xl bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover sm:inline-flex" href={addFinspoHref()}>＋ Post Finspo</a>
        </div>
        {renderFinspoTabs()}
        <RefreshIndicator active={finspoScope === 'public' ? gallery.refreshing : finspoSource.refreshing} className="mb-4" label="Refreshing Finspo" />

        <>
            {activeFinspoLoading && !finspoItems.length && !finspoAccountSuggestions.length && (
              finspoScope === 'following' ? <FinspoAccountSuggestionsSkeleton /> : (
                <section aria-busy="true" aria-label="Loading Finspo posts" role="status">
                  <FinspoMasonry {...FINSPO_MASONRY_LAYOUT}>
                    {Array.from({ length: 15 }, (_, index) => <FinspoSkeletonTile index={index} key={`finspo-initial-${index}`} overlay />)}
                  </FinspoMasonry>
                </section>
              )
            )}
            {activeFinspoError && <InlineNotice action={<button className="font-black text-accent" onClick={activeFinspoRefetch} type="button">Retry</button>} title="Finspo could not load" tone="error">{activeFinspoError}</InlineNotice>}
            {finspoScope === 'following' && !!finspoAccountSuggestions.length && (
              <FinspoAccountSuggestions accounts={finspoAccountSuggestions} onFollowingChanged={refreshFollowingAfterSuggestion} personalized={suggestionsPersonalized} />
            )}
            {!activeFinspoLoading && !activeFinspoError && !finspoItems.length && !finspoAccountSuggestions.length && (
              <StatePanel action={finspoScope === 'following' ? <a className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" href={withBasePath('/community?tab=finspo&scope=public')}>Discover public Finspo</a> : <ButtonLink to="/community/finspo/new">Post Finspo</ButtonLink>} body={finspoScope === 'following' ? 'Follow members to build a Finspo feed around their posts.' : 'Be the first to share a look or source of inspiration.'} layout="section" title="No Finspo yet" tone="empty" />
            )}
            {!!finspoItems.length && (
              <FinspoMasonry {...FINSPO_MASONRY_LAYOUT} className="finspo-masonry">
                {finspoItems.map((post) => renderFinspoTile(post))}
                {finspoScope === 'public' && gallery.loadingMore && Array.from({ length: 10 }, (_, index) => <FinspoSkeletonTile index={index} key={`finspo-more-${index}`} overlay />)}
              </FinspoMasonry>
            )}
            {finspoScope === 'public' && (
              <div ref={gallery.sentinelRef} className="min-h-14 py-4" aria-label={gallery.hasMore ? 'Load more Finspo posts' : 'All Finspo posts loaded'}>
                {gallery.loadMoreError && <InlineNotice action={<button className="font-black text-accent" onClick={gallery.retryLoadMore} type="button">Try again</button>} title="More Finspo did not load" tone="error">{gallery.loadMoreError}</InlineNotice>}
              </div>
            )}
        </>
      </section>
    )
  }

  return (
    <AppShell active="community">
      {initialState.legacyMine && <LoadingState label="Redirecting to your profile" layout="page" variant="spinner" />}

      {!initialState.legacyMine && <><nav className="tab-line community-main-tabs mb-6 flex flex-wrap items-center justify-center gap-2 [&_button]:shrink-0 [&_button]:rounded-full [&_button]:border [&_button]:border-foose-border [&_button]:bg-foose-surface-low [&_button]:px-4 [&_button]:py-2 [&_button]:text-sm [&_button]:font-semibold [&_button]:text-foose-muted [&_button]:transition [&_button]:hover:border-accent [&_button]:hover:text-accent [&_a]:shrink-0 [&_a]:rounded-full [&_a]:border [&_a]:border-foose-border [&_a]:bg-foose-surface-low [&_a]:px-4 [&_a]:py-2 [&_a]:text-sm [&_a]:font-semibold [&_a]:text-foose-muted [&_a]:transition [&_a]:hover:border-accent [&_a]:hover:text-accent [&_button.active]:border-accent [&_button.active]:bg-accent [&_button.active]:text-white [&_a.active]:border-accent [&_a.active]:bg-accent [&_a.active]:text-white" aria-label="Community sections">
        <a aria-current={mainTab === 'finspo' ? 'page' : undefined} className={mainTab === 'finspo' ? 'active' : ''} href={withBasePath(`/community?tab=finspo&scope=${finspoScope}`)}>
          Finspo
        </a>
        <a aria-current={mainTab === 'events' ? 'page' : undefined} className={mainTab === 'events' ? 'active' : ''} href={withBasePath(`/community?tab=events&filter=${eventFilter}`)}>
          Events
        </a>
      </nav>

      {mainTab === 'finspo' && renderFinspoPanel()}
      {mainTab === 'events' && renderEventPanel()}
      {renderFloatingCreateButton()}

      {!user && (
        <section className="seller-cta mx-auto w-full max-w-[1280px] rounded-xl bg-accent p-6 text-white my-10 grid gap-6 md:grid-cols-[1fr_auto] [&_h2]:text-3xl [&_h2]:font-bold compact">
          <div>
            <h2>Want to contribute?</h2>
            <p>Create an account to save events, like Finspo, and manage your own posts.</p>
          </div>
          <ButtonLink to={authHref('/login', '/community')} variant="secondary">
            Sign up
          </ButtonLink>
        </section>
      )}
      </>}
    </AppShell>
  )
}
