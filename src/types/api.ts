import type { UserRole, UserRoles } from '../constants/roles'

export type ApiSuccess<T> = {
  success: true
  data: T
  message?: string
}

export type ApiFailure = {
  success: false
  error: string
  details?: unknown
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure

export type AuthTokens = {
  accessToken: string
  refreshToken: string
  expiresIn?: string
}

export type PaystackPaymentSession = {
  accessCode: string
  provider: 'paystack'
  reference: string
  status: 'pending'
}

export type PromotionTier = 'quick_boost' | 'weekend_push' | 'top_pick' | 'homepage_feature'

export type PromotionItem = {
  targetId: string
  startsAt?: string
  endsAt?: string
  impressions: number
  clicks: number
  clickThroughRate: number
  status: 'pending' | 'processing' | 'active' | 'scheduled' | 'expired' | 'failed'
  target?: Pick<Listing, '_id' | 'title' | 'images'> | Pick<Event, '_id' | 'title' | 'coverImage' | 'date'> | null
}

export type PromotionOrder = {
  _id: string
  targetType: 'listing' | 'event'
  tier: PromotionTier
  unitAmount: number
  totalAmount: number
  currency: 'GHS'
  durationHours: number
  paymentReference: string
  paymentStatus: 'pending' | 'processing' | 'paid' | 'failed'
  paidAt?: string
  fulfilledAt?: string
  items: PromotionItem[]
  createdAt: string
}

export type User = {
  _id: string
  name: string
  email: string
  username: string
  phone?: string
  bio?: string
  profilePhoto?: string
  roles?: UserRoles
  role?: UserRole | string | number
  isEmailVerified: boolean
  isKycVerified: boolean
  hasShop: boolean
  wallet?: {
    balance: number
    escrow: number
  }
  location?: {
    region?: string
    city?: string
  }
  kycId?: KycRecord | string | null
  following?: string[]
  preferences?: UserPreferences
  pendingEmail?: string
  createdAt?: string
  updatedAt?: string
}

export type NotificationCategory = 'order' | 'chat' | 'review' | 'system'

export type UserPreferences = {
  theme: 'light' | 'dark' | 'system'
  notifications: {
    order: { email: boolean }
    chat: { email: boolean }
    review: { email: boolean }
    system: { email: boolean; inApp: boolean }
  }
}

export type Shop = {
  _id: string
  ownerId?: User | string
  shopName: string
  slug: string
  bio?: string
  logoUrl?: string
  bannerUrl?: string
  category?: 'retail' | 'wholesale' | 'both'
  location?: {
    city?: string
    region?: string
  }
  isLive?: boolean
  rating?: number
  totalReviews?: number
  payoutMethod?: {
    type?: 'mobile_money' | 'bank_transfer'
    accountName?: string
    provider?: string
    accountNumber?: string
    bankName?: string
    branch?: string
  }
  socialLinks?: {
    instagram?: string
    whatsapp?: string
  }
}

export type Listing = {
  _id: string
  shopId?: Shop | string
  location?: {
    city?: string
    region?: string
  }
  title: string
  description?: string
  hashtags?: string[]
  category?: string
  subcategory?: string
  brand?: string
  size?: string
  gender?: 'men' | 'women' | 'unisex' | 'kids'
  condition?: 'excellent' | 'great' | 'good' | 'fair' | 'poor'
  color?: 'beige' | 'black' | 'blue' | 'brown' | 'burgundy' | 'cream' | 'cyan' | 'gold' | 'green' | 'gray' | 'ivory' | 'khaki' | 'multi' | 'navy' | 'olive' | 'orange' | 'pink' | 'purple' | 'red' | 'silver' | 'teal' | 'turquoise' | 'violet' | 'white' | 'yellow'
  colors?: NonNullable<Listing['color']>[]
  attributes?: {
    material?: 'cotton' | 'denim' | 'leather' | 'faux-leather' | 'wool' | 'polyester' | 'linen' | 'silk' | 'canvas' | 'rubber' | 'metal' | 'wood' | 'mixed' | 'other'
    fit?: 'slim' | 'regular' | 'relaxed' | 'oversized' | 'tailored'
    pattern?: 'solid' | 'striped' | 'checked' | 'floral' | 'graphic' | 'animal' | 'geometric' | 'traditional-print' | 'other'
    baleGrade?: 'premium' | 'grade-a' | 'grade-b' | 'mixed'
  }
  type: 'retail' | 'wholesale'
  price: number
  currency?: string
  quantity?: number
  bulkMinQty?: number
  bulkWeight?: string
  bargainingAllowed?: boolean
  /** Seller-only. Never returned on public listing reads. */
  minAcceptablePrice?: number
  volumeDiscounts?: Array<{
    minQty?: number
    pricePerUnit?: number
  }>
  images?: string[]
  promotionTags?: string[]
  promotionExpiresAt?: string
  visibility?: 'marketplace' | 'event'
  status?: 'active' | 'sold' | 'draft' | 'removed'
  views?: number
  createdAt?: string
  updatedAt?: string
}

export type MyListingsResponse = {
  listings: Listing[]
  page: number
  pages: number
  total: number
}

export type HashtagSuggestion = {
  name: string
  hashtag: string
  postCount: number
}

export type HashtagSuggestionsResponse = {
  suggestions: HashtagSuggestion[]
}

export type OrderFulfillmentStatus =
  | 'awaiting_seller'
  | 'ready_for_pickup'
  | 'in_transit'
  | 'completed'
  | 'cancelled'

export type OrderSettlementStatus =
  | 'payment_pending'
  | 'cash_due'
  | 'cash_collected'
  | 'held'
  | 'released'
  | 'refund_pending'
  | 'refund_attention'
  | 'refunded'
  | 'refund_failed'
  | 'void'

export type OrderAllowedAction =
  | 'cancel_cash_pickup'
  | 'mark_pickup_ready'
  | 'complete_cash_pickup'
  | 'release_unclaimed_pickup'
  | 'confirm_collection'
  | 'dispatch'
  | 'dispatchCourier'
  | 'confirm_receipt'
  | 'close_no_action'
  | 'report'

export type OrderWorkflow = {
  nextActor: 'buyer' | 'seller' | 'system' | 'support' | 'none' | string
  allowedActions: Array<OrderAllowedAction | 'report_order'>
  deadline: {
    at: string
    consequence?: string
    type: string
  } | null
  serverNow: string
  report: {
    active: boolean
    id?: string
    status?: string
  } | null
  settlementExplanation: string
}

export type PrivateOrderAsset = string | {
  mimetype?: string
  name?: string
  originalName?: string
  size?: number
  signedUrl?: string
  url?: string
}

export type OrderTransit = {
  serviceName?: string
  transitServiceName?: string
  driverPhone?: string
  busNumber?: string
  /** The transit fee the buyer must pay to collect the parcel, in pesewas. */
  amount?: number
  cargoTrackingNumber?: string
  billImage?: PrivateOrderAsset
}

export type OrderDestination = {
  recipientName?: string
  recipientPhone?: string
  region?: string
  town?: string
  preferredTerminal?: string
  /** intra_city_courier/inter_city_courier only. */
  deliveryAddress?: string
  secondAddress?: string
  deliveryNote?: string
}

export type CourierProviderId = 'bolt_send' | 'yango_delivery' | 'shaq_express'

export type OrderEvent = {
  _id?: string
  actor?: 'buyer' | 'seller' | 'system' | 'support' | string
  actorType?: 'buyer' | 'seller' | 'system' | 'support' | string
  createdAt: string
  description?: string
  label?: string
  message?: string
  metadata?: Record<string, unknown>
  type?: string
  eventType?: string
}

export type OrderReportCategory =
  | 'not_received'
  | 'invalid_transit_details'
  | 'seller_or_driver_unreachable'
  | 'wrong_or_missing_items'
  | 'damaged_or_not_as_described'
  | 'fraud_or_safety_concern'
  | 'other'

export type OrderReport = {
  _id: string
  orderId?: Order | string
  category: OrderReportCategory
  affectedItemIds: string[]
  requestedOutcome: string
  detailedAccount: string
  evidence?: PrivateOrderAsset[]
  declarationAccepted: boolean
  status: 'submitted' | 'under_review' | 'resolved' | string
  frozenAt?: string
  createdAt?: string
  submittedAt?: string
  /** Read aliases from the first report API revision. */
  details?: string
  reviewStatus?: string
}

export type Order = {
  _id: string
  buyerId?: User | string
  shopId?: Shop | string
  items: Array<{
    _id?: string
    listingId?: Listing | string
    title: string
    /** What the buyer paid per unit. Below `listPrice` when a bargain was used. */
    price: number
    listPrice?: number
    bargainId?: string
    quantity: number
  }>
  bargainIds?: string[]
  subtotalAmount?: number
  deliveryFee?: number
  totalAmount: number
  currency?: string
  fulfillmentStatus?: OrderFulfillmentStatus
  settlementStatus?: OrderSettlementStatus
  workflow?: OrderWorkflow
  events?: OrderEvent[]
  activeReportId?: OrderReport | string | null
  reportResolution?: {
    awardedTo?: 'buyer' | 'seller'
    resolvedAt?: string
  }
  report?: OrderReport | null
  paidAt?: string
  readyAt?: string
  pickupExpiresAt?: string
  sentAt?: string
  deliveryReleaseAt?: string
  completedAt?: string
  cancelledAt?: string
  inventoryRestoredAt?: string
  settledAt?: string
  /** Temporary legacy fields retained while existing orders are migrated. */
  status?: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'disputed' | 'cancelled' | 'refunded'
  paymentMethod?: 'paystack_mock' | 'paystack' | 'cash_on_pickup'
  paymentStatus?: 'unpaid' | 'paid' | 'cash_on_pickup' | 'refunded'
  paymentRef?: string
  escrowStatus?: 'not_held' | 'held' | 'released' | 'refunded'
  sellerAction?: 'pending' | 'accepted' | 'shipped' | 'pickup_ready'
  sellerActionAt?: string
  sellerActionDeadline?: string
  sellerNote?: string
  autoReleaseAt?: string
  releasedAt?: string
  buyerConfirmedAt?: string
  delivery?: {
    method?: 'station_pickup' | 'shop_pickup' | 'airport_to_airport' | 'intra_city_courier' | 'inter_city_courier'
    company?: string
    fee?: number
    /** Distance-based planning estimate (pesewas) — never charged, see backend/CLAUDE.md. */
    estimatedFeePesewas?: number
    /** intra_city_courier/inter_city_courier only. */
    provider?: CourierProviderId | string
    /** Tracking URL the seller pastes in for the two courier methods. */
    trackingLink?: string
    destination?: OrderDestination
    recipient?: {
      name?: string
      phone?: string
    }
    transit?: OrderTransit
    address?: {
      region?: string
      city?: string
      street?: string
    }
    trackingInfo?: string
  }
  createdAt?: string
  updatedAt?: string
}

export type WalletLedgerEntryType =
  | 'escrow_hold'
  | 'escrow_release'
  | 'escrow_refund'
  | 'withdrawal'
  | 'adjustment'

export type WalletLedgerOrder = {
  id: string
  shortReference: string
  itemSummary: string
  itemCount: number
  totalAmount: number
  currency: string
  fulfillmentStatus?: OrderFulfillmentStatus
  settlementStatus?: OrderSettlementStatus
  deliveryMethod?: 'station_pickup' | 'shop_pickup'
  workflow?: OrderWorkflow | null
}

export type WalletLedgerEntry = {
  id: string
  entryType: WalletLedgerEntryType
  amount: number
  balanceDelta: number
  escrowDelta: number
  balanceAfter?: number
  escrowAfter?: number
  currency: string
  description?: string
  createdAt: string
  order?: WalletLedgerOrder | null
}

export type WalletLedgerResponse = {
  entries: WalletLedgerEntry[]
  hasMore: boolean
  nextCursor?: string | null
  serverNow: string
}

export type Review = {
  _id: string
  reviewerId?: User | string
  shopId?: Shop | string
  orderId?: Order | string
  source?: 'order' | 'direct'
  rating: number
  comment?: string
  createdAt?: string
  updatedAt?: string
}

export type UserReportReason =
  | 'harassment'
  | 'scam_or_fraud'
  | 'counterfeit_or_fake_listings'
  | 'inappropriate_content'
  | 'spam'
  | 'other'

export type UserReport = {
  _id: string
  reporterId?: User | string
  reportedUserId?: User | string
  reason: UserReportReason
  details?: string
  status: 'open' | 'resolved' | 'dismissed' | string
  isActive: boolean
  createdAt?: string
}

export type KycRecord = {
  _id?: string
  userId?: User | string
  idType?: 'Ghana Card' | 'Passport' | 'Driving License'
  idNo?: string
  dob?: string
  phone?: string
  phoneVerified?: boolean
  idImgUrl?: string
  idBackImgUrl?: string
  selfieImgUrl?: string
  status: 'not_submitted' | 'pending' | 'approved' | 'rejected'
  rejectionReason?: string
  submissionCount?: number
  submittedAt?: string
  reviewedAt?: string
  reviewedBy?: User | string
}

export type Event = {
  _id: string
  organizerId?: User | string
  shopId?: Shop | string
  title: string
  description?: string
  date: string
  startTime?: string
  endTime?: string
  startsAt?: string
  endsAt?: string
  location?: string
  coverImage?: string
  eventListings?: Listing[] | string[]
  promotionTags?: string[]
  promotionExpiresAt?: string
  type: 'online-pop-up' | 'in-person-pop-up' | 'pop-up' | 'fair' | 'online'
  attendees?: string[]
  status?: 'upcoming' | 'ongoing' | 'past'
}

export type GalleryPost = {
  _id: string
  imageUrl: string
  images?: string[]
  caption?: string
  tags?: string[]
  likes?: string[]
  commentCount?: number
  isArchived?: boolean
  archivedAt?: string
  archiveDeleteAt?: string
  userId?: User | string
  createdAt?: string
}

export type ProfileContentType = 'finspo' | 'listings' | 'events'

export type ProfileConnectionType = 'followers' | 'following'

export type ProfileConnectionMember = Pick<User, '_id' | 'hasShop' | 'isKycVerified' | 'name' | 'profilePhoto' | 'username'>

export type PaginatedProfileConnections = {
  items: ProfileConnectionMember[]
  page: number
  pages: number
  restricted: boolean
  total: number
  type: ProfileConnectionType
}

export type ProfileContentCounts = Record<ProfileContentType, number>

export type ProfileSummary = {
  user: User
  contentCounts: ProfileContentCounts
  followerCount: number
  followingCount: number
  isFollowing?: boolean
  followsYou?: boolean
  shop?: Shop | null
}

export type PaginatedProfileContent<T extends GalleryPost | Listing | Event> = {
  items: T[]
  page: number
  pages: number
  total: number
  type: ProfileContentType
}

export type FinspoComment = {
  _id: string
  body: string
  userId: User
  replyToUserId: User | null
  likeCount: number
  liked: boolean
  replyCount: number
  rootCommentId?: string
  createdAt: string
}

export type PaginatedFinspoComments = {
  comments: FinspoComment[]
  total: number
  totalComments: number
  page: number
  pages: number
}

export type PaginatedFinspoReplies = {
  replies: FinspoComment[]
  total: number
  page: number
  pages: number
  rootCommentId: string
}

export type CreatedFinspoComment = {
  comment: FinspoComment
  totalComments: number
}

export type CreatedFinspoReply = {
  reply: FinspoComment
  rootCommentId: string
  rootReplyCount: number
  totalComments: number
}

export type FinspoCommentLikeState = {
  commentId: string
  liked: boolean
  likeCount: number
}

export type FinspoCommentContext = {
  isReply: boolean
  rootComment: FinspoComment
  rootCommentId: string
  target: FinspoComment
  totalComments: number
}

export type FinspoAccountSuggestion = Pick<
  User,
  '_id' | 'bio' | 'hasShop' | 'isKycVerified' | 'name' | 'profilePhoto' | 'username'
> & {
  finspoCount: number
  followsYou?: boolean
}

export type FollowingFinspoFeed = {
  followingCount: number
  posts: GalleryPost[]
  suggestedAccounts: FinspoAccountSuggestion[]
  suggestionMeta: {
    fallbackCount: number
    personalized: boolean
    personalizedCount: number
  } | null
  total: number
}

export type PaginatedFinspoFeed = {
  feed: {
    allocations: {
      fallback: number
      new: number
      personalized: number
    }
    newCount: number
    pageSize: number
    personalized: boolean
    personalizedCount: number
  }
  page: number
  pages: number
  posts: GalleryPost[]
  total: number
}

export type FavoriteCollections = {
  ids: {
    events: string[]
    finspos: string[]
    listings: string[]
  }
  events: Event[]
  finspos: GalleryPost[]
  listings: Listing[]
}

export type Notification = {
  _id: string
  userId?: User | string
  type: 'order' | 'chat' | 'review' | 'kyc' | 'system'
  title: string
  body?: string
  link?: string
  isRead?: boolean
  createdAt?: string
}

export type PopularSearch = {
  count: number
  query: string
  normalizedQuery: string
}

export type WeeklyTopSeller = Shop & {
  completedOrders: number
  revenue: number
}

export type ChatMessage = {
  _id: string
  attachments?: ChatAttachment[]
  content: string
  conversationId?: string
  createdAt?: string
  isRead?: boolean
  reactions?: ChatReaction[]
  replyTo?: ChatMessagePreview | string
  senderId?: User | string
  receiverId?: User | string
  listingId?: Listing | string
  type?: 'text' | 'image' | 'video' | 'mixed' | 'offer'
  bargainId?: Bargain | string
  /** Immutable snapshot of the negotiation round this message represents. */
  offer?: ChatMessageOffer
}

export type ChatMessageOffer = {
  action: BargainAction
  actor: BargainActor
  amount?: number
  previousAmount?: number
  round?: number
}

export type ChatConversation = {
  conversationId: string
  latestMessage: ChatMessage
  unreadCount: number
  unreadReactionCount?: number
  participant?: User | string
  listing?: Listing | string
}

export type ChatAttachment = {
  url: string
  type: 'image' | 'video'
  mimetype?: string
  originalname?: string
}

export type ChatReactionName = 'thumbs_up' | 'heart' | 'thumbs_down' | 'fire' | 'sad' | 'laugh'

export type ChatReaction = {
  isRead?: boolean
  userId?: User | string
  reaction: ChatReactionName
}

export type BargainAction = 'open' | 'counter' | 'accept' | 'decline' | 'cancel' | 'close'

export type BargainActor = 'buyer' | 'seller' | 'system'

export type BargainStatus =
  | 'awaiting_seller'
  | 'awaiting_buyer'
  | 'accepted'
  | 'consumed'
  | 'declined'
  | 'cancelled'
  | 'closed'

export type BargainOffer = {
  _id?: string
  actor: 'buyer' | 'seller'
  amount: number
  note?: string
  messageId?: string
  createdAt?: string
}

export type Bargain = {
  _id: string
  listingId?: Listing | string
  buyerId?: User | string
  sellerId?: User | string
  shopId?: Shop | string
  conversationId: string
  /** Listing price when the bargain opened, in pesewas. */
  listPriceAtOpen: number
  currency?: string
  status: BargainStatus
  isActive?: boolean
  offers: BargainOffer[]
  roundCount: number
  agreedPrice?: number
  acceptedAt?: string
  acceptedBy?: 'buyer' | 'seller'
  consumedByOrderId?: string
  consumedAt?: string
  closedReason?: 'round_limit' | 'listing_unavailable' | 'declined' | 'cancelled'
  createdAt?: string
  updatedAt?: string
  /** Server-derived, relative to the caller. */
  allowedActions?: BargainAction[]
  isFinalRound?: boolean
  viewerRole?: 'buyer' | 'seller' | null
}

export type BargainResponse = {
  bargain: Bargain
  message?: ChatMessage
  /** True when the buyer's offer fell under the seller's private floor. */
  belowSellerMinimum?: boolean
}

export type ChatMessagePreview = {
  _id: string
  attachments?: ChatAttachment[]
  content?: string
  createdAt?: string
  senderId?: User | string
  listingId?: Listing | string
}

export type AuthPayload = {
  user: User
  tokens: AuthTokens
}

export type PaginatedListings = {
  results: Listing[]
  total: number
  page: number
  pages: number
  filters?: {
    locations?: Array<{
      label: string
      value: string
    }>
  }
  feed?: {
    allocations: {
      new: number
      promoted: number
      suggested: number
    }
    candidateLimit: number
    pageSize: number
    personalized: boolean
    promotedGap: number
    requestedPromotedGap: number
  }
}

export type PaginatedReviews = {
  reviews: Review[]
  total: number
  page: number
  pages: number
}

export type PaginatedShops = {
  shops: Shop[]
  total: number
  page: number
  pages: number
}

export type UnifiedSearchScope = 'all' | 'items' | 'finspo' | 'events' | 'users'

export type UnifiedSearchResultType = 'item' | 'finspo' | 'event' | 'user'

export type UnifiedSearchUser = User & {
  shop?: Pick<Shop, '_id' | 'bio' | 'category' | 'isLive' | 'location' | 'logoUrl' | 'rating' | 'shopName' | 'slug'> | null
}

export type UnifiedSearchResult =
  | { entity: Listing; type: 'item' }
  | { entity: GalleryPost; type: 'finspo' }
  | { entity: Event; type: 'event' }
  | { entity: UnifiedSearchUser; type: 'user' }

export type UnifiedSearchCounts = Record<UnifiedSearchScope, number>

export type UnifiedSearchResponse = {
  counts: UnifiedSearchCounts
  hasMore: boolean
  nextCursor: string | null
  query: string
  results: UnifiedSearchResult[]
  scope: UnifiedSearchScope
  total: number
}

export type UnifiedSearchSuggestion = {
  entity?: Listing | GalleryPost | Event | UnifiedSearchUser
  hashtag?: string
  href?: string
  id?: string
  imageUrl?: string
  keyword?: string
  kind?: 'entity' | 'hashtag' | 'keyword'
  label: string
  sourceId?: string
  subtitle?: string
  type: UnifiedSearchResultType | 'hashtag' | 'keyword'
  username?: string
}

export type UnifiedSearchSuggestionsResponse = {
  suggestions: UnifiedSearchSuggestion[]
}

export type BrowseSearchItemSuggestion = {
  entity: Listing
  href?: string
  imageUrl?: string
  kind: 'entity'
  label: string
  sourceId?: string
  subtitle?: string
  type: 'item'
}

export type BrowseSearchRefinementSuggestion = {
  count: number
  kind: 'term'
  label: string
  type: 'brand' | 'category' | 'hashtag'
  value: string
}

export type BrowseSearchSuggestion = BrowseSearchItemSuggestion | BrowseSearchRefinementSuggestion

export type BrowseSearchSuggestionsResponse = {
  suggestions: BrowseSearchSuggestion[]
}

export type AdminStats = {
  users: number
  shops: number
  orders: number
  listings: number
  revenue: number
}
