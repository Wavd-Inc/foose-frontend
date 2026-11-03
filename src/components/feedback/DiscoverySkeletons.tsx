import { PRODUCT_GRID_CLASS } from '../marketplace/ProductCard'
import { InlineNotice } from './InlineNotice'
import { LoadingRegion } from './LoadingRegion'
import { SkeletonBlock } from './SkeletonBlock'

const productGridClasses = PRODUCT_GRID_CLASS

function ProductTileSkeleton({ variant = 'default' }: { variant?: 'default' | 'catalog' | 'saved' }) {
  return (
    <div aria-hidden className="min-w-0 space-y-2">
      <SkeletonBlock className={`aspect-[4/5] w-full ${variant === 'catalog' ? 'rounded-[18px]' : variant === 'saved' ? 'rounded-sm' : 'rounded-lg'}`} />
      <SkeletonBlock className="h-3 w-4/5" />
      {variant !== 'default' && <SkeletonBlock className="h-3 w-3/5" />}
      <SkeletonBlock className="h-3 w-1/2" />
      <SkeletonBlock className="h-5 w-20" />
    </div>
  )
}

export function ProductGridSkeleton({ count = 12, label = 'Loading listings', variant = 'default' }: { count?: number; label?: string; variant?: 'default' | 'catalog' | 'saved' }) {
  return (
    <LoadingRegion label={label} layout="section">
      <div className={variant === 'saved' ? 'grid grid-cols-2 gap-x-3 gap-y-7 sm:grid-cols-3 sm:gap-x-5 sm:gap-y-9 lg:grid-cols-4 xl:grid-cols-5' : `${productGridClasses} ${variant === 'catalog' ? 'sm:gap-x-4 sm:gap-y-7' : ''}`}>
        {Array.from({ length: count }, (_, index) => <ProductTileSkeleton key={index} variant={variant} />)}
      </div>
    </LoadingRegion>
  )
}

export function ProductBandSkeleton({ count = 6, label = 'Loading products', variant = 'default' }: { count?: number; label?: string; variant?: 'default' | 'catalog' }) {
  return (
    <LoadingRegion label={label} layout="section">
      <div className={`flex gap-3 overflow-hidden ${variant === 'catalog' ? 'lg:grid lg:grid-cols-4 lg:gap-4' : ''}`}>
        {Array.from({ length: count }, (_, index) => (
          <div className={`shrink-0 space-y-2 ${variant === 'catalog' ? 'w-[min(62vw,14rem)] sm:w-56 lg:w-auto' : 'w-[132px] sm:w-[148px] md:w-[160px] lg:w-[172px]'}`} key={index}>
            <ProductTileSkeleton variant={variant} />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function EventCarouselSkeleton({ label = 'Loading featured events' }: { label?: string }) {
  return (
    <LoadingRegion label={label} layout="section">
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="w-[82vw] max-w-sm shrink-0 overflow-hidden rounded-xl border border-foose-border bg-foose-surface" key={index}>
            <SkeletonBlock className="aspect-[16/9] w-full rounded-none" />
            <div className="space-y-2 p-4">
              <SkeletonBlock className="h-5 w-4/5" />
              <SkeletonBlock className="h-3 w-3/5" />
              <SkeletonBlock className="h-3 w-2/5" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function EventGridSkeleton({ count = 6, label = 'Loading events', variant = 'default' }: { count?: number; label?: string; variant?: 'default' | 'saved' }) {
  return (
    <LoadingRegion label={label} layout="section">
      <div className={variant === 'saved' ? 'grid gap-x-5 gap-y-9 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' : 'grid gap-4 sm:grid-cols-2 lg:grid-cols-3'}>
        {Array.from({ length: count }, (_, index) => (
          <div className={variant === 'saved' ? 'overflow-hidden' : 'overflow-hidden rounded-xl border border-foose-border bg-foose-surface'} key={index}>
            <SkeletonBlock className={variant === 'saved' ? 'aspect-[4/3] w-full rounded-sm' : 'aspect-[16/9] w-full rounded-none'} />
            <div className={variant === 'saved' ? 'space-y-3 pt-3' : 'space-y-3 p-4'}>
              <SkeletonBlock className="h-5 w-4/5" />
              <SkeletonBlock className="h-3 w-2/3" />
              <SkeletonBlock className={variant === 'saved' ? 'h-3 w-1/3' : 'h-9 w-full'} />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function SavedFinspoSkeleton() {
  return (
    <LoadingRegion label="Loading liked Finspo posts" layout="section">
      <div className="columns-2 gap-3 sm:gap-5 md:columns-3 lg:columns-4 xl:columns-5">
        {Array.from({ length: 10 }, (_, index) => (
          <div className="mb-7 break-inside-avoid space-y-2 sm:mb-9" key={index}>
            <SkeletonBlock className={`${index % 3 === 0 ? 'aspect-[3/4]' : index % 3 === 1 ? 'aspect-square' : 'aspect-[4/5]'} w-full rounded-sm`} />
            <SkeletonBlock className="h-3 w-4/5" />
            <SkeletonBlock className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function ShopGridSkeleton({ count = 6, label = 'Loading DigiShops' }: { count?: number; label?: string }) {
  return (
    <LoadingRegion label={label} layout="section">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, index) => (
          <div className="overflow-hidden rounded-2xl border border-foose-border bg-foose-surface" key={index}>
            <SkeletonBlock className="h-28 w-full rounded-none" />
            <div className="space-y-3 p-4">
              <SkeletonBlock className="-mt-11 size-16 rounded-full ring-4 ring-foose-surface" />
              <SkeletonBlock className="h-5 w-3/5" />
              <SkeletonBlock className="h-10 w-full" />
              <SkeletonBlock className="h-7 w-2/5 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function ShopDetailSkeleton() {
  return (
    <LoadingRegion label="Loading shop" layout="page">
      <div className="overflow-hidden rounded-2xl border border-foose-border bg-foose-surface">
        <SkeletonBlock className="h-36 w-full rounded-none sm:h-48" />
        <div className="space-y-4 p-4 sm:p-6">
          <div className="flex items-end gap-4">
            <SkeletonBlock className="-mt-14 size-24 shrink-0 rounded-full ring-4 ring-foose-surface" />
            <div className="min-w-0 flex-1 space-y-2 pb-1">
              <SkeletonBlock className="h-7 w-52 max-w-full" />
              <SkeletonBlock className="h-4 w-72 max-w-full" />
            </div>
          </div>
          <SkeletonBlock className="h-12 w-full" />
        </div>
      </div>
      <div className="mt-6">
        <ProductGridSkeleton count={10} label="Loading shop listings" />
      </div>
    </LoadingRegion>
  )
}

export function ListingDetailSkeleton() {
  return (
    <LoadingRegion label="Loading listing details" layout="page">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.18fr)_minmax(340px,0.82fr)] lg:items-start lg:gap-9 xl:gap-12">
        <div className="space-y-3">
          <SkeletonBlock className="aspect-[4/5] max-h-[min(66dvh,44rem)] w-full rounded-[22px]" />
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {Array.from({ length: 5 }, (_, index) => <SkeletonBlock className="aspect-square rounded-xl" key={index} />)}
          </div>
        </div>
        <div className="space-y-5 pt-1">
          <SkeletonBlock className="h-3 w-28" />
          <SkeletonBlock className="h-10 w-4/5" />
          <SkeletonBlock className="h-4 w-2/3" />
          <SkeletonBlock className="h-10 w-32" />
          <div className="grid grid-cols-2 gap-3 border-t border-foose-border pt-5">
            {Array.from({ length: 4 }, (_, index) => <SkeletonBlock className="h-9 w-full" key={index} />)}
          </div>
          <SkeletonBlock className="h-12 w-full rounded-full" />
          <div className="grid grid-cols-2 gap-2"><SkeletonBlock className="h-11 w-full rounded-full" /><SkeletonBlock className="h-11 w-full rounded-full" /></div>
          <SkeletonBlock className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function EventDetailSkeleton() {
  return (
    <LoadingRegion label="Loading event details" layout="page">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1.13fr)_minmax(340px,.87fr)]">
        <SkeletonBlock className="aspect-[16/11] w-full rounded-2xl lg:aspect-auto lg:h-[410px]" />
        <div className="space-y-4 py-4">
          <SkeletonBlock className="h-6 w-28 rounded-full" />
          <SkeletonBlock className="h-9 w-4/5" />
          <SkeletonBlock className="h-4 w-3/5" />
          <div className="grid grid-cols-2 gap-4 py-2">
            {Array.from({ length: 4 }, (_, index) => <SkeletonBlock className="h-12 w-full" key={index} />)}
          </div>
          <SkeletonBlock className="h-11 w-full" />
        </div>
      </div>
      <div className="mt-9 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="space-y-3">
          <SkeletonBlock className="h-6 w-40" />
          <SkeletonBlock className="h-4 w-full max-w-xl" />
          <SkeletonBlock className="h-4 w-3/4 max-w-lg" />
        </div>
        <div className="rounded-2xl border border-foose-border bg-foose-surface p-5">
          <div className="space-y-3">
            <SkeletonBlock className="size-11 rounded-full" />
            <SkeletonBlock className="h-5 w-3/4" />
            <SkeletonBlock className="h-4 w-full" />
          </div>
        </div>
      </div>
    </LoadingRegion>
  )
}

export function ProfilePageSkeleton() {
  return (
    <LoadingRegion label="Loading profile" layout="page">
      <div className="rounded-2xl bg-foose-surface p-3 sm:p-4 lg:p-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 sm:gap-x-4 lg:gap-x-6">
          <SkeletonBlock className="size-20 shrink-0 rounded-full sm:size-24 lg:size-28" />
          <div className="min-w-0 space-y-2">
            <SkeletonBlock className="h-7 w-52 max-w-full lg:h-9" />
            <SkeletonBlock className="h-4 w-28 max-w-full" />
          </div>
          <div className="col-span-2 space-y-2 lg:col-start-2">
            <SkeletonBlock className="h-4 w-full max-w-xl" />
            <SkeletonBlock className="h-4 w-3/4 max-w-lg" />
          </div>
          <div className="col-span-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between lg:col-start-2">
            <div className="flex gap-5 sm:gap-7">
              <div className="space-y-1"><SkeletonBlock className="h-5 w-8" /><SkeletonBlock className="h-3 w-16" /></div>
              <div className="space-y-1"><SkeletonBlock className="h-5 w-8" /><SkeletonBlock className="h-3 w-16" /></div>
            </div>
            <div className="flex gap-2">
              <SkeletonBlock className="h-11 flex-1 sm:w-28 sm:flex-none" />
              <SkeletonBlock className="h-11 flex-1 sm:w-28 sm:flex-none" />
              <SkeletonBlock className="size-11 shrink-0" />
              <SkeletonBlock className="size-11 shrink-0" />
            </div>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="order-first overflow-hidden rounded-2xl border border-foose-border bg-foose-surface lg:order-last">
          <SkeletonBlock className="hidden h-28 w-full rounded-none lg:block" />
          <div className="flex items-center gap-3 p-3 sm:p-4 lg:block lg:space-y-3 lg:p-5">
            <SkeletonBlock className="size-14 shrink-0 rounded-full lg:-mt-12 lg:size-16 lg:rounded-xl lg:ring-4 lg:ring-foose-surface" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex items-center gap-2"><SkeletonBlock className="h-5 w-28" /><SkeletonBlock className="h-5 w-14 rounded-full" /></div>
              <SkeletonBlock className="hidden h-4 w-full lg:block" />
              <SkeletonBlock className="hidden h-4 w-4/5 lg:block" />
            </div>
            <SkeletonBlock className="h-10 w-24 shrink-0 lg:w-full" />
          </div>
        </div>
        <div className="min-w-0">
          <div className="grid grid-cols-3 border-b border-foose-border pb-2">
            {Array.from({ length: 3 }, (_, index) => <SkeletonBlock className="mx-auto h-10 w-20 max-w-[85%]" key={index} />)}
          </div>
          <div className="mt-5 grid grid-cols-2 items-start gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => <SkeletonBlock className={index % 3 === 0 ? 'aspect-[3/4]' : index % 3 === 1 ? 'aspect-square' : 'aspect-[4/5]'} key={index} />)}
          </div>
        </div>
      </div>
    </LoadingRegion>
  )
}

export function SavedPageSkeleton() {
  return (
    <LoadingRegion label="Loading saved collections" layout="page">
      <SkeletonBlock className="mb-4 h-8 w-52" />
      <div className="grid gap-8">
        <ProductBandSkeleton label="Loading saved items" />
        <EventGridSkeleton count={3} label="Loading saved events" />
      </div>
    </LoadingRegion>
  )
}

export function FinspoFormSkeleton() {
  return (
    <LoadingRegion label="Loading Finspo editor" layout="page">
      <div className="grid gap-5 rounded-xl border border-foose-border bg-foose-surface p-4 sm:p-6 lg:grid-cols-[minmax(240px,0.7fr)_minmax(0,1fr)]">
        <SkeletonBlock className="aspect-[4/5] w-full" />
        <div className="space-y-5">
          <SkeletonBlock className="h-28 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-12 w-full" />
          <SkeletonBlock className="h-11 w-36" />
        </div>
      </div>
    </LoadingRegion>
  )
}

export function CompactListSkeleton({ label = 'Loading activity', rows = 3 }: { label?: string; rows?: number }) {
  return (
    <LoadingRegion label={label} layout="compact">
      <div className="space-y-3">
        {Array.from({ length: rows }, (_, index) => (
          <div className="flex items-center gap-3" key={index}>
            <SkeletonBlock className="size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2"><SkeletonBlock className="h-4 w-3/5" /><SkeletonBlock className="h-3 w-4/5" /></div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}

export function AppendFeedback({ error, label, loading, retry }: { error?: string; label: string; loading?: boolean; retry?: () => void }) {
  if (error) {
    return (
      <InlineNotice
        action={retry ? <button className="text-sm font-black text-accent hover:underline" onClick={retry} type="button">Try again</button> : undefined}
        className="mx-auto my-3 max-w-xl"
        title="More results did not load"
        tone="error"
      >
        {error}
      </InlineNotice>
    )
  }

  if (!loading) return null

  return (
    <LoadingRegion className="py-3" label={label} layout="compact">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => <SkeletonBlock className="aspect-[4/5] w-full" key={index} />)}
      </div>
    </LoadingRegion>
  )
}
