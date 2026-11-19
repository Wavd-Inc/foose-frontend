import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ToastProvider } from '../components'
import type { ProfileSummary } from '../types/api'
import { ProfilePage } from './ProfilePage'

const mocks = vi.hoisted(() => ({
  auth: {
    status: 'authenticated',
    user: { _id: 'user-1', name: 'Ama', username: 'ama' },
  } as { status: string; user: Record<string, unknown> | null },
  contentPaths: [] as string[],
  contentRefetch: vi.fn(),
  resourcePaths: [] as string[],
  apiDelete: vi.fn(),
  apiPost: vi.fn(),
  connectionRestricted: false,
  navigateTo: vi.fn(),
  summary: null as ProfileSummary | null,
}))

function baseSummary(): ProfileSummary {
  return {
    contentCounts: { events: 2, finspo: 4, listings: 1 },
    followerCount: 8,
    followingCount: 3,
    isFollowing: false,
    shop: {
      _id: 'shop-1',
      bannerUrl: 'banner.jpg',
      bio: 'Curated Ghanaian fashion.',
      category: 'retail',
      location: { city: 'Accra', region: 'Greater Accra' },
      logoUrl: 'logo.jpg',
      rating: 4.8,
      shopName: 'Ama Shop',
      slug: 'ama-shop',
    },
    user: {
      _id: 'user-1',
      email: 'ama@example.com',
      hasShop: true,
      isEmailVerified: true,
      isKycVerified: true,
      name: 'Ama Mensah',
      username: 'ama',
    },
  }
}

const content = {
  events: [
    { _id: 'event-1', date: '2027-01-01', location: 'Accra', status: 'upcoming', title: 'Vintage Fair', type: 'fair' },
    { _id: 'event-past', date: '2020-01-01', location: 'Kumasi', status: 'past', title: 'Old Market Day', type: 'fair' },
  ],
  finspo: [{ _id: 'finspo-1', caption: 'Blue mood', imageUrl: 'look.jpg', likes: [] }],
  listings: [{ _id: 'listing-1', currency: 'GHS', images: ['dress.jpg'], price: 12000, status: 'active', title: 'Blue dress', type: 'retail' }],
}

const connections = {
  followers: [{ _id: 'follower-1', hasShop: false, isKycVerified: false, name: 'Efua Owusu', profilePhoto: 'efua.jpg', username: 'efua' }],
  following: [{ _id: 'following-1', hasShop: true, isKycVerified: true, name: 'Kojo Asare', profilePhoto: 'kojo.jpg', username: 'kojo' }],
}

vi.mock('../components/layout/AppShell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => <main>{children}</main>,
}))

vi.mock('../components/navigation', () => ({
  NavigationBackButton: () => null,
}))

vi.mock('../components/marketplace/ProductCard', () => ({
  PRODUCT_GRID_CLASS: 'grid',
  ProductCard: ({ listing, manageHref }: { listing: { title: string }; manageHref?: string }) => <article data-testid="product-card">{listing.title}{manageHref ? <a aria-label={`Edit ${listing.title}`} href={manageHref}>Edit</a> : <button aria-label="Favorite" type="button" />}</article>,
}))

vi.mock('../components/ui/FinspoLikeButton', () => ({
  FinspoLikeButton: () => <button aria-label="Like Finspo" type="button" />,
}))

vi.mock('../hooks/useAuth', () => ({
  useAuth: () => mocks.auth,
}))

vi.mock('../hooks/useApiResource', () => ({
  useApiResource: (path: string | null) => {
    if (path) mocks.resourcePaths.push(path)
    return {
      data: mocks.summary,
      error: '',
      errorMeta: null,
      initialLoading: false,
      loading: false,
      refetch: mocks.contentRefetch,
      refreshing: false,
    }
  },
}))

vi.mock('../hooks/useInfiniteApiResource', () => ({
  useInfiniteApiResource: (buildPath: (page: number) => string | null, extractItems: (page: Record<string, unknown>) => unknown[]) => {
    const path = buildPath(1)
    if (!path) {
      return {
        data: null, error: '', errorMeta: null, hasMore: false, initialLoading: false, items: [], loading: false, loadingMore: false,
        loadMoreError: '', loadMoreErrorMeta: null, refetch: vi.fn(), refreshing: false, retryLoadMore: vi.fn(), sentinelRef: vi.fn(), total: 0,
      }
    }
    mocks.contentPaths.push(path)
    const type = new URL(path, window.location.origin).searchParams.get('type') || ''
    const source = (type in content ? content[type as keyof typeof content] : connections[type as keyof typeof connections]) || []
    const total = type === 'followers' ? 42 : type === 'following' ? 3 : source.length
    const pageData = { items: source, page: 1, pages: 1, restricted: type in connections && mocks.connectionRestricted, total, type }
    const items = extractItems(pageData)
    return {
      data: pageData,
      error: '',
      errorMeta: null,
      hasMore: false,
      initialLoading: false,
      items,
      loading: false,
      loadingMore: false,
      loadMoreError: '',
      loadMoreErrorMeta: null,
      refetch: mocks.contentRefetch,
      refreshing: false,
      retryLoadMore: vi.fn(),
      sentinelRef: vi.fn(),
      total,
    }
  },
}))

vi.mock('../lib/api', async (importOriginal) => ({
  ...await importOriginal<typeof import('../lib/api')>(),
  apiDelete: mocks.apiDelete,
  apiPost: mocks.apiPost,
}))

vi.mock('../utils/navigation', () => ({
  cacheFinspoPreview: vi.fn(),
  captureNavigationTrigger: vi.fn(),
  getCurrentAppHref: () => `${window.location.pathname}${window.location.search}`,
  getCurrentAppPathname: () => window.location.pathname,
  navigateTo: mocks.navigateTo,
  stripBasePath: (path: string) => path,
  subscribeToNavigation: () => () => undefined,
  withBasePath: (path: string) => path,
}))

function setProfileUrl(tab?: string) {
  window.history.replaceState({}, '', `/profile/ama${tab ? `?tab=${tab}` : ''}`)
}

function renderPage() {
  return render(<ProfilePage />, { wrapper: ToastProvider })
}

function viewAsVisitor() {
  mocks.auth.user = { _id: 'viewer-1', name: 'Kojo', username: 'kojo' }
}

describe('ProfilePage creator tabs', () => {
  beforeEach(() => {
    mocks.auth.status = 'authenticated'
    mocks.auth.user = { _id: 'user-1', name: 'Ama', username: 'ama' }
    mocks.contentPaths.length = 0
    mocks.contentRefetch.mockReset()
    mocks.contentRefetch.mockResolvedValue(undefined)
    mocks.resourcePaths.length = 0
    mocks.apiDelete.mockReset()
    mocks.apiDelete.mockImplementation((path: string) => Promise.resolve(path.includes('/me/followers/') ? { followerCount: 7, removed: true } : { following: false, followingCount: 2 }))
    mocks.apiPost.mockReset()
    mocks.apiPost.mockResolvedValue({ followerCount: 9, following: true })
    mocks.navigateTo.mockReset()
    mocks.connectionRestricted = false
    mocks.summary = baseSummary()
    Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    setProfileUrl()
  })

  it('defaults to Finspo, shows three content tabs, and keeps the shop separate', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Finspo, 4 posts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: 'Listings, 1 listing' })).not.toHaveAttribute('aria-current')
    expect(screen.getByRole('link', { name: 'Events, 2 events' })).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Shop' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ama Shop' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'View shop' })).toHaveAttribute('href', '/shops/ama-shop')
    expect(screen.getByRole('link', { name: 'Manage shop' })).toHaveAttribute('href', '/manage-shop')
    expect(screen.getByText('Blue mood')).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open Blue mood, image 1 of 1' })).toHaveAttribute('href', '/community/finspo/finspo-1')
    expect(screen.queryByText(/active orders/i)).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Post Finspo' })).toHaveAttribute('href', '/community/finspo/new')
    expect(mocks.contentPaths.some((path) => path.includes('type=finspo'))).toBe(true)
    expect(mocks.contentPaths.some((path) => path.includes('type=listings'))).toBe(false)
  })

  it('reduces the shop card to a logo, identity, and View shop strip below desktop', () => {
    renderPage()

    const shopCard = screen.getByTestId('profile-shop-card')
    expect(shopCard.firstElementChild).toHaveClass('hidden', 'lg:block')
    expect(shopCard.lastElementChild).toHaveClass('flex', 'items-center', 'lg:block')
    expect(screen.getByAltText('Ama Shop logo')).toHaveClass('rounded-full', 'lg:rounded-xl')
    expect(screen.getByRole('heading', { name: 'Ama Shop' })).toHaveClass('truncate')
    expect(screen.getByText('retail')).toBeVisible()
    expect(screen.getByRole('link', { name: 'View shop' })).toHaveClass('whitespace-nowrap')
    expect(screen.getByRole('link', { name: 'Manage shop' })).toHaveClass('hidden', 'lg:inline-flex')
  })

  it('uses URL-selected tabs and their contextual owner actions', () => {
    setProfileUrl('listings')
    renderPage()

    expect(screen.getByRole('link', { name: 'Listings, 1 listing' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByTestId('product-card')).toHaveTextContent('Blue dress')
    expect(screen.getByRole('link', { name: 'Edit Blue dress' })).toHaveAttribute('href', '/listings/listing-1/edit')
    expect(screen.queryByRole('button', { name: 'Favorite' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Add listing' })).toHaveAttribute('href', '/listings/new')
    expect(mocks.contentPaths.some((path) => path.includes('type=listings'))).toBe(true)
    expect(mocks.contentPaths.some((path) => path.includes('type=finspo'))).toBe(false)
  })

  it.each(['shop', 'orders'])('falls back to Finspo for the %s tab URL', (tab) => {
    setProfileUrl(tab)
    renderPage()

    expect(screen.getByRole('link', { name: 'Finspo, 4 posts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.queryByRole('link', { name: 'Shop' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Ama Shop' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Events, 2 events' })).toHaveAttribute('href', '/profile/ama?tab=events')
  })

  it('offers owners a standalone Open Shop action when they have no shop', () => {
    mocks.summary = { ...baseSummary(), shop: null, user: { ...baseSummary().user, hasShop: false } }
    renderPage()

    expect(screen.getByRole('heading', { name: 'No DigiShop yet' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Open a DigiShop' })).toHaveAttribute('href', '/open-shop')
    expect(screen.getByRole('link', { name: 'Post Finspo' })).toHaveAttribute('href', '/community/finspo/new')
  })

  it('shows the visitor-facing shop empty state above the responsive tab content', () => {
    mocks.auth.status = 'guest'
    mocks.auth.user = null
    mocks.summary = { ...baseSummary(), shop: null, contentCounts: { events: 0, finspo: 0, listings: 0 }, user: { ...baseSummary().user, hasShop: false } }
    setProfileUrl('shop')
    renderPage()

    expect(screen.getByRole('link', { name: 'Finspo, 0 posts' })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('heading', { name: 'No DigiShop yet' })).toBeVisible()
    expect(screen.getByText('This member has not opened a DigiShop.')).toBeVisible()
    expect(screen.queryByRole('link', { name: 'Open a DigiShop' })).not.toBeInTheDocument()
    expect(mocks.contentPaths.some((path) => path.includes('type=finspo'))).toBe(true)

    const shopAside = screen.getByTestId('profile-shop-card').closest('aside')
    const tabNav = screen.getByRole('navigation', { name: 'Profile sections' })
    expect(shopAside).not.toBeNull()
    expect(shopAside).toHaveClass('order-first', 'lg:order-last', 'lg:sticky')
    expect(shopAside!.compareDocumentPosition(tabNav) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(tabNav.firstElementChild).toHaveClass('grid-cols-3')
  })

  it('retains a visited content panel while switching to another tab', () => {
    const view = renderPage()
    const listingsTab = screen.getByRole('link', { name: 'Listings, 1 listing' })
    listingsTab.addEventListener('click', (event) => event.preventDefault())
    fireEvent.click(listingsTab)
    setProfileUrl('listings')
    view.rerender(<ProfilePage />)
    expect(screen.getByTestId('product-card')).toBeVisible()

    setProfileUrl('events')
    view.rerender(<ProfilePage />)
    expect(screen.getByTestId('product-card').closest('section')).toHaveAttribute('hidden')
    expect(screen.getByRole('heading', { name: 'Ama Shop' })).toBeVisible()
    expect(screen.getByRole('link', { name: 'Events, 2 events' })).toHaveAttribute('aria-current', 'page')
  })

  it('renders a compact borderless identity band with plain stacked connection controls', () => {
    renderPage()

    const band = screen.getByTestId('profile-identity-band')
    expect(band).not.toHaveClass('border')
    expect(band.firstElementChild).toHaveClass('grid-cols-[auto_minmax(0,1fr)]')

    const followers = screen.getByRole('button', { name: 'View 8 followers' })
    const following = screen.getByRole('button', { name: 'View 3 following' })
    expect(followers).toHaveClass('flex-col', 'border-0', 'cursor-pointer')
    expect(following).toHaveClass('flex-col', 'border-0', 'cursor-pointer')
    expect(followers.firstElementChild).toHaveTextContent('8')
    expect(followers.lastElementChild).toHaveTextContent('Followers')
  })

  it('keeps the Profile section selector pinned beneath the persistent header', () => {
    renderPage()

    const tabs = screen.getByRole('navigation', { name: 'Profile sections' })
    expect(tabs).toHaveClass('sticky', 'top-16')
    expect(tabs).not.toHaveClass('translate-y-[-120%]')
  })

  it('shows Finspo management only to the owner and refreshes after archive confirmation', async () => {
    const view = renderPage()

    expect(screen.queryByRole('button', { name: 'Like Finspo' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Open options for Blue mood' }))
    expect(screen.getByRole('menuitem', { name: 'Edit' })).toHaveAttribute('href', '/community/finspo/finspo-1/edit')
    expect(screen.getByRole('link', { name: 'Archived Finspo' })).toHaveAttribute('href', '/community/finspo/archived')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Archive' }))
    expect(screen.getByRole('dialog', { name: 'Archive this post?' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Archive post' }))
    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith('/community/gallery/finspo-1/archive'))
    expect(mocks.contentRefetch).toHaveBeenCalled()

    viewAsVisitor()
    view.rerender(<ProfilePage />)
    expect(screen.queryByRole('button', { name: /options for Blue mood/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Like Finspo' })).toBeVisible()
  })

  it('shows Event manage/delete controls only to the owner', () => {
    setProfileUrl('events')
    const view = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Open options for Vintage Fair' }))
    expect(screen.getByRole('menuitem', { name: 'Manage' })).toHaveAttribute('href', '/community/events/event-1/manage')
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible()
    viewAsVisitor()
    view.rerender(<ProfilePage />)
    expect(screen.queryByRole('button', { name: /options for Vintage Fair/ })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'View event' })).toBeVisible()
  })

  it('hides past events by default and exposes them only through the owner Past events view', () => {
    setProfileUrl('events')
    const view = renderPage()

    expect(screen.getByText('Vintage Fair')).toBeVisible()
    expect(screen.queryByText('Old Market Day')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Past events' }))
    expect(screen.getByText('Old Market Day')).toBeVisible()
    expect(screen.queryByText('Vintage Fair')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Current events' })).toHaveAttribute('aria-pressed', 'true')

    viewAsVisitor()
    view.rerender(<ProfilePage />)
    expect(screen.queryByRole('button', { name: 'Past events' })).not.toBeInTheDocument()
    expect(screen.queryByText('Old Market Day')).not.toBeInTheDocument()
    expect(screen.getByText('Vintage Fair')).toBeVisible()
  })

  it('opens accessible owner connection dialogs with profile, message, and relationship actions', async () => {
    renderPage()

    const followingTrigger = screen.getByRole('button', { name: 'View 3 following' })
    followingTrigger.focus()
    fireEvent.click(followingTrigger)
    const dialog = await screen.findByRole('dialog', { name: 'Following' })
    expect(dialog).toBeVisible()
    expect(screen.getByRole('link', { name: /Kojo Asare/ })).toHaveAttribute('href', '/profile/kojo')
    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', '/inbox?receiverId=following-1&conversationId=following-1_user-1_general')

    const unfollow = within(dialog).getByRole('button', { name: 'Unfollow' })
    fireEvent.click(unfollow)
    const confirmation = screen.getByRole('dialog', { name: 'Unfollow?' })
    expect(mocks.apiDelete).not.toHaveBeenCalled()
    fireEvent.keyDown(confirmation, { key: 'Escape' })
    expect(confirmation).not.toBeInTheDocument()
    expect(dialog).toBeVisible()

    fireEvent.click(unfollow)
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unfollow?' })).getByRole('button', { name: 'Unfollow' }))
    await waitFor(() => expect(mocks.apiDelete).toHaveBeenCalledWith('/users/kojo/follow'))
    expect(screen.queryByText('@kojo')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View 2 following' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Close following' }))
    await waitFor(() => expect(followingTrigger).toHaveFocus())
  })

  it('confirms follower removal before updating the owner list and count', async () => {
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'View 8 followers' }))

    expect(await screen.findByRole('dialog', { name: 'Followers' })).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }))
    expect(screen.getByRole('dialog', { name: 'Remove follower?' })).toBeVisible()
    expect(mocks.apiDelete).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Remove follower' }))
    await waitFor(() => expect(mocks.apiDelete).toHaveBeenCalledWith('/users/me/followers/efua'))
    expect(screen.queryByText('@efua')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'View 7 followers' })).toBeVisible()
  })

  it('retains the connection row and count when an owner action fails', async () => {
    mocks.apiDelete.mockRejectedValueOnce(new Error('Connection service unavailable'))
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'View 3 following' }))

    fireEvent.click(await screen.findByRole('button', { name: 'Unfollow' }))
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Unfollow?' })).getByRole('button', { name: 'Unfollow' }))
    expect(await screen.findByText('Connection did not update')).toBeVisible()
    expect(screen.getByText('Connection service unavailable')).toBeVisible()
    expect(screen.getByText('@kojo')).toBeVisible()
    expect(screen.getByRole('button', { name: 'View 3 following' })).toBeVisible()
  })

  it('shows visitors read-only capped connections and only displays the privacy notice when truncated', async () => {
    viewAsVisitor()
    mocks.connectionRestricted = true
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'View 8 followers' }))

    expect(await screen.findByText('@efua')).toBeVisible()
    expect(screen.getByText('Only @ama can see all followers.')).toBeVisible()
    const dialog = screen.getByRole('dialog', { name: 'Followers' })
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Message' })).not.toBeInTheDocument()
    expect(mocks.contentPaths.some((path) => path.includes('/users/ama/connections?type=followers&page=1&limit=30'))).toBe(true)
  })

  it('does not show the connection privacy notice when a visitor can see the complete list', async () => {
    viewAsVisitor()
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'View 3 following' }))

    expect(await screen.findByText('@kojo')).toBeVisible()
    expect(screen.queryByText(/Only @ama can see all following/)).not.toBeInTheDocument()
  })

  it('allows guests to view the limited list without owner actions', async () => {
    mocks.auth.status = 'guest'
    mocks.auth.user = null
    mocks.connectionRestricted = true
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'View 8 followers' }))

    const dialog = await screen.findByRole('dialog', { name: 'Followers' })
    expect(within(dialog).getByText('@efua')).toBeVisible()
    expect(within(dialog).queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument()
    expect(within(dialog).queryByRole('link', { name: 'Message' })).not.toBeInTheDocument()
  })

  it('shows only Edit Profile and Share in the owner action row', () => {
    renderPage()

    expect(screen.getByRole('link', { name: 'Edit Profile' })).toHaveAttribute('href', '/profile/settings')
    expect(screen.getByRole('button', { name: 'Share profile' })).toBeVisible()
    expect(screen.queryByRole('button', { name: /follow @/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Message' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Open profile options' })).not.toBeInTheDocument()
  })

  it('follows and unfollows a viewed member while updating the visible count', async () => {
    viewAsVisitor()
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Follow @ama' }))

    await waitFor(() => expect(mocks.apiPost).toHaveBeenCalledWith('/users/ama/follow'))
    expect(screen.getByRole('button', { name: 'Unfollow @ama' })).toBeVisible()
    expect(screen.getByRole('button', { name: 'View 9 followers' })).toBeVisible()

    mocks.apiPost.mockResolvedValueOnce({ followerCount: 8, following: false })
    fireEvent.click(screen.getByRole('button', { name: 'Unfollow @ama' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Follow @ama' })).toBeVisible())
    expect(screen.getByRole('button', { name: 'View 8 followers' })).toBeVisible()
  })

  it('shows Follow back for a follower and Friends after following each other', async () => {
    viewAsVisitor()
    mocks.summary = { ...baseSummary(), followsYou: true }
    renderPage()
    fireEvent.click(screen.getByRole('button', { name: 'Follow back @ama' }))
    const friends = await screen.findByRole('button', { name: 'Friends @ama' })
    expect(friends).toHaveAttribute('aria-pressed', 'true')
    mocks.apiPost.mockResolvedValueOnce({ followerCount: 8, following: false })
    fireEvent.click(friends)
    const confirmation = screen.getByRole('dialog', { name: 'Unfollow?' })
    expect(confirmation).toHaveAccessibleDescription("Unfollow @ama? You'll no longer be friends.")
    expect(mocks.apiPost).toHaveBeenCalledTimes(1)
    fireEvent.click(within(confirmation).getByRole('button', { name: 'Cancel' }))
    expect(friends).toBeVisible()
    expect(mocks.apiPost).toHaveBeenCalledTimes(1)

    fireEvent.click(friends)
    const confirmButton = within(screen.getByRole('dialog', { name: 'Unfollow?' })).getByRole('button', { name: 'Unfollow' })
    expect(confirmButton).toHaveClass('bg-foose-danger')
    fireEvent.click(confirmButton)
    expect(await screen.findByRole('button', { name: 'Follow back @ama' })).toBeVisible()
  })

  it('renders the viewer follow state from the initial profile response without another request', () => {
    viewAsVisitor()
    mocks.summary = { ...baseSummary(), isFollowing: true }
    renderPage()

    expect(screen.queryByRole('status', { name: 'Loading profile' })).not.toBeInTheDocument()
    expect(screen.getByTestId('profile-identity-band')).toBeVisible()
    expect(screen.getByTestId('profile-shop-card')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Unfollow @ama' })).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Follow @ama' })).not.toBeInTheDocument()
    expect(mocks.resourcePaths).toContain('/users/ama/profile')
    expect(mocks.resourcePaths.some((path) => path.endsWith('/follow'))).toBe(false)
  })

  it('redirects guest follow attempts to sign in and surfaces follow failures', async () => {
    mocks.auth.status = 'guest'
    mocks.auth.user = null
    const view = renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Follow @ama' }))
    expect(mocks.navigateTo).toHaveBeenCalledWith(expect.stringContaining('/login?redirect='))

    mocks.auth.status = 'authenticated'
    viewAsVisitor()
    mocks.apiPost.mockRejectedValueOnce(new Error('Follow service unavailable'))
    view.rerender(<ProfilePage />)
    fireEvent.click(screen.getByRole('button', { name: 'Follow @ama' }))
    expect(await screen.findByText('Follow status did not update')).toBeVisible()
    expect(screen.getByText('Follow service unavailable')).toBeVisible()
  })

  it('links signed-in and guest visitors to the existing inbox conversation contract', () => {
    viewAsVisitor()
    const view = renderPage()

    expect(screen.getByRole('link', { name: 'Message' })).toHaveAttribute('href', '/inbox?receiverId=user-1&conversationId=user-1_viewer-1_general')

    mocks.auth.status = 'guest'
    mocks.auth.user = null
    view.rerender(<ProfilePage />)
    const guestHref = screen.getByRole('link', { name: 'Message' }).getAttribute('href') || ''
    expect(guestHref).toContain('/login?redirect=')
    expect(decodeURIComponent(guestHref)).toContain('/inbox?receiverId=user-1')
  })

  it('shares natively when available and removes the active tab from the shared URL', async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    setProfileUrl('events')
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }))

    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(share.mock.calls[0][0].url).toMatch(/\/profile\/ama$/)
    expect(share.mock.calls[0][0].url).not.toContain('tab=')
    expect(await screen.findByText('Profile shared')).toBeVisible()
  })

  it('copies the profile URL when native sharing is unavailable and reports failures', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }))
    await waitFor(() => expect(writeText).toHaveBeenCalledOnce())
    expect(await screen.findByText('Link copied')).toBeVisible()

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined })
    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }))
    expect(await screen.findByText('Share failed')).toBeVisible()
  })

  it('silently handles a cancelled native share', async () => {
    const share = vi.fn().mockRejectedValue(new DOMException('Cancelled', 'AbortError'))
    Object.defineProperty(navigator, 'share', { configurable: true, value: share })
    renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Share profile' }))
    await waitFor(() => expect(share).toHaveBeenCalledOnce())
    expect(screen.queryByText('Profile shared')).not.toBeInTheDocument()
    expect(screen.queryByText('Share failed')).not.toBeInTheDocument()
  })

  it('provides an accessible placeholder safety menu that dismisses outside and on Escape', () => {
    viewAsVisitor()
    renderPage()

    const trigger = screen.getByRole('button', { name: 'Open profile options' })
    fireEvent.click(trigger)
    expect(screen.getByRole('menuitem', { name: 'Report' })).toBeVisible()
    expect(screen.getByRole('menuitem', { name: 'Block' })).toBeVisible()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(screen.getByRole('menuitem', { name: 'Report' }))
    expect(screen.getByRole('menu')).toBeVisible()
    expect(mocks.apiPost).not.toHaveBeenCalled()

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open profile options' }))
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(mocks.apiPost).not.toHaveBeenCalled()
  })
})
