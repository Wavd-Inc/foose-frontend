import { AppShell, FavoriteButton, Icon, InlineNotice, LightboxImage, ProductCard, RefreshIndicator, SectionHeader, StatePanel } from '../components'
import { EventDetailSkeleton } from '../components/feedback/DiscoverySkeletons'
import { PRODUCT_GRID_CLASS } from '../components/marketplace/ProductCard'
import { NavigationBackButton } from '../components/navigation'
import { useAuth } from '../hooks/useAuth'
import { useApiResource } from '../hooks/useApiResource'
import { useCart } from '../hooks/useCart'
import type { Event, Listing } from '../types/api'
import { concreteEventListings, eventHostHref, eventHostName, eventTimeLabel, eventTimeTerm, eventTypeLabel, eventWindowHasClosed, eventWindowHasOpened, isOnlinePopUp } from '../utils/events'
import { getShop } from '../utils/format'
import { getCurrentAppPathname, navigateTo, withBasePath } from '../utils/navigation'
import { isActiveEventPromotion } from '../utils/promotions'

function eventIdFromPath() {
  const match = getCurrentAppPathname().match(/^\/community\/events\/([^/]+)/)
  return match ? decodeURIComponent(match[1]).trim() : ''
}

export function EventDetailPage() {
  const { user } = useAuth()
  const eventId = eventIdFromPath()
  const eventResource = useApiResource<{ event: Event }>(eventId ? `/community/events/${eventId}` : null, Boolean(eventId))
  const { addListing, items: cartItems } = useCart()
  const event = eventResource.data?.event
  const listings = event ? concreteEventListings(event).filter((listing) => {
    const owner = getShop(listing)?.ownerId
    const ownerId = typeof owner === 'string' ? owner : owner?._id
    return !user?._id || ownerId !== user._id
  }) : []
  const hostHref = event ? eventHostHref(event) : ''
  const onlineEvent = event ? isOnlinePopUp(event) : false
  const checkoutClosed = event ? eventWindowHasClosed(event) : false
  const checkoutOpen = event ? eventWindowHasOpened(event) && !checkoutClosed : false

  function addPopUpListing(listing: Listing) {
    if (!event) return
    addListing(listing, 1, {
      availableFrom: event.startsAt,
      availableUntil: event.endsAt,
      sourceEventId: event._id,
      sourceEventTitle: event.title,
    })
  }

  function renderListing(listing: Listing) {
    // Read from the cart itself, so the state survives a reload and stays right
    // if the item is removed from the cart page.
    const inCart = cartItems.some((item) => item.listingId === listing._id)
    return (
      <div className="flex flex-col gap-2" key={listing._id}>
        <ProductCard listing={listing} />
        {inCart ? (
          <button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition [&.full]:w-full border-foose-success bg-foose-success-bg text-foose-success hover:brightness-95" onClick={() => navigateTo('/cart')} type="button">
            <Icon name="check" size={16} />
            Added to cart
          </button>
        ) : (
          <button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-primary border-accent bg-accent text-white shadow-md shadow-accent/15 hover:bg-accent-hover" disabled={listing.status !== 'active'} onClick={() => addPopUpListing(listing)} type="button">
            Add to cart
          </button>
        )}
      </div>
    )
  }

  return (
    <AppShell active="community" searchPlaceholder="Search events...">
      <NavigationBackButton className="mb-6" fallback={{ href: '/community?tab=events', label: 'Community events' }} />

      {!eventId && <StatePanel action={<a className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" href={withBasePath('/community?tab=events')}>Browse community events</a>} body="This link does not identify a community event." layout="page" title="Event link is incomplete" tone="unavailable" />}
      {eventResource.initialLoading && <EventDetailSkeleton />}
      <RefreshIndicator active={eventResource.refreshing} className="mb-4" label="Refreshing event details" />
      {eventResource.error && <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={eventResource.refetch} type="button">Try again</button>} body={eventResource.error} layout="page" title={eventResource.errorMeta?.status === 404 ? 'This event is no longer available' : 'Event could not load'} tone={eventResource.errorMeta?.status === 403 ? 'permission' : eventResource.errorMeta?.status === 404 ? 'unavailable' : 'error'} />}

      {event && (
        <section className="event-detail">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1.13fr)_minmax(340px,.87fr)]">
            <div className="aspect-[16/11] overflow-hidden rounded-2xl bg-foose-surface-mid lg:aspect-auto lg:h-[410px] [&_.lightbox-trigger]:h-full [&_.lightbox-trigger]:w-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover">
              {event.coverImage ? <LightboxImage alt={event.title} src={event.coverImage} /> : <span className="flex h-full min-h-64 items-center justify-center text-sm font-semibold text-foose-faint">No event cover</span>}
            </div>
            <div className="flex min-w-0 flex-col justify-center gap-4 py-1 lg:py-4">
              <div className="flex flex-wrap gap-2">
                {isActiveEventPromotion(event.promotionTags, event.promotionExpiresAt, event.status) && <span className="rounded-full bg-accent-light px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-accent">Featured</span>}
                <span className="rounded-full bg-foose-surface-mid px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-wider text-foose-text">{eventTypeLabel(event)}</span>
              </div>
              <h1 className="break-words font-sans text-3xl font-extrabold leading-tight tracking-tight text-foose-text sm:text-4xl">{event.title}</h1>
              <p className="text-sm text-foose-muted">{event.status === 'ongoing' ? 'Happening now' : event.status === 'past' ? 'This event has ended' : 'Coming up soon'} on Foose.</p>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-5 py-2">
                <div className="flex min-w-0 gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent"><Icon name="calendar" size={16} /></span>
                  <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-foose-faint">{eventTimeTerm(event)}</dt><dd className="mt-0.5 text-xs font-semibold leading-5 text-foose-text">{eventTimeLabel(event)}</dd></div>
                </div>
                <div className="flex min-w-0 gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent"><Icon name="location" size={16} /></span>
                  <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-foose-faint">Location</dt><dd className="mt-0.5 text-xs font-semibold leading-5 text-foose-text">{onlineEvent ? 'Hosted on Foose' : event.location || 'Location pending'}</dd></div>
                </div>
                <div className="flex min-w-0 gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent"><Icon name="store" size={16} /></span>
                  <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-foose-faint">Host</dt><dd className="mt-0.5 text-xs font-semibold leading-5 text-foose-text">{hostHref ? <a className="hover:text-accent hover:underline" href={withBasePath(hostHref)}>{eventHostName(event)}</a> : eventHostName(event)}</dd></div>
                </div>
                <div className="flex min-w-0 gap-2">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-light text-accent"><Icon name="grid" size={16} /></span>
                  <div className="min-w-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-foose-faint">Type</dt><dd className="mt-0.5 text-xs font-semibold leading-5 text-foose-text">{eventTypeLabel(event)}</dd></div>
                </div>
              </dl>
              <FavoriteButton className="favorite-button inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-accent bg-accent px-5 py-2.5 text-sm font-bold text-white transition hover:bg-accent-hover [&.is-active]:bg-accent-strong [&.is-active]:text-white" showText targetId={event._id} targetType="event" />
            </div>
          </div>
          <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
            <div>
              <h2 className="font-sans text-xl font-bold text-foose-text">About this event</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-foose-muted">{event.description || 'The host has not added a description yet.'}</p>
              {onlineEvent && (
                <div className="mt-6 flex max-w-2xl gap-3 rounded-2xl border border-foose-border bg-foose-surface-low p-4">
                  <Icon name="cart" size={20} />
                  <div>
                    <strong className="text-sm text-foose-text">{checkoutClosed ? 'Shopping window closed' : checkoutOpen ? 'Shopping window open' : 'Preview window'}</strong>
                    <p className="mt-1 text-xs leading-5 text-foose-muted">{checkoutClosed ? 'You can still browse the catalog, but checkout has ended.' : checkoutOpen ? 'Items in this pop-up can be checked out now.' : 'Add items to cart now, then checkout when the pop-up window opens.'}</p>
                  </div>
                </div>
              )}
            </div>
            <aside className="h-fit rounded-2xl border border-foose-border bg-foose-surface p-5 shadow-sm">
              <span className="flex size-11 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white">{eventHostName(event).replace(/^@/, '').charAt(0).toUpperCase()}</span>
              <h2 className="mt-3 text-base font-bold text-foose-text">Hosted by {eventHostName(event)}</h2>
              <p className="mt-2 text-xs leading-5 text-foose-muted">Foose community event host</p>
              {hostHref && <a className="mt-5 inline-flex min-h-10 w-full items-center justify-center rounded-lg border border-foose-border px-4 py-2 text-xs font-bold text-foose-text transition hover:border-accent hover:text-accent" href={withBasePath(hostHref)}>View host profile</a>}
            </aside>
          </div>
        </section>
      )}
      {event && onlineEvent && (
        <section className="event-management-section mt-8 rounded-2xl border border-foose-border bg-foose-surface p-5 sm:p-7">
          <SectionHeader title="Pop-up catalog" eyebrow={checkoutClosed ? 'Shopping window closed' : checkoutOpen ? 'Checkout is open now' : 'Browse before the shopping window opens'} />
          {checkoutClosed && <InlineNotice className="mb-4" title="This pop-up has ended" tone="info">Its catalog remains available to review, but checkout is closed.</InlineNotice>}
          {!listings.length && <StatePanel body="The host has not added items to this pop-up yet." layout="section" title="No catalog items yet" tone="empty" />}
          {!!listings.length && <div className={PRODUCT_GRID_CLASS}>{listings.map(renderListing)}</div>}
        </section>
      )}
    </AppShell>
  )
}
