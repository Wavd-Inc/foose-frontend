import { FinspoMasonry } from '../community/FinspoMasonry'

const tileAspects = [
  'aspect-[3/4]',
  'aspect-[4/5]',
  'aspect-square',
  'aspect-[2/3]',
  'aspect-[5/6]',
] as const

function Pulse({ className = '' }: { className?: string }) {
  return <span aria-hidden className={`block animate-pulse bg-foose-surface-mid ${className}`} />
}

type FinspoSkeletonTileProps = {
  index?: number
  overlay?: boolean
  showAuthor?: boolean
  showMenu?: boolean
}

type FinspoSkeletonTilesProps = {
  count?: number
  showAuthor?: boolean
  showMenu?: boolean
}

export function FinspoSkeletonTile({
  index = 0,
  overlay = false,
  showAuthor = true,
  showMenu = false,
}: FinspoSkeletonTileProps) {
  if (overlay) {
    return (
      <article className="finspo-tile relative min-w-0 overflow-hidden rounded-2xl bg-foose-surface-mid">
        <Pulse className={`w-full ${tileAspects[index % tileAspects.length]}`} />
        <Pulse className="absolute right-2 top-2 size-8 rounded-full bg-foose-surface-high" />
        <div className="absolute inset-x-0 bottom-0 space-y-2 bg-gradient-to-t from-black/35 to-transparent p-3">
          <Pulse className="h-3 w-3/4 rounded-full bg-white/75" />
          {showAuthor && <Pulse className="h-2.5 w-20 rounded-full bg-white/55" />}
        </div>
      </article>
    )
  }

  return (
    <article className="finspo-tile relative mb-3 break-inside-avoid max-md:mb-2">
      <Pulse className={`w-full ${tileAspects[index % tileAspects.length]}`} />
      {showMenu && <Pulse className="absolute right-2 top-2 size-8 rounded-full bg-foose-surface-high" />}
      {showAuthor && <Pulse className="absolute right-2 top-2 size-8 rounded-full bg-foose-surface-high" />}
      <Pulse className="mt-1 h-3 w-3/4 rounded-full" />
      {showAuthor && <Pulse className="mt-1 h-3 w-24 rounded-full" />}
    </article>
  )
}

export function FinspoSkeletonTiles({
  count = 50,
  showAuthor = true,
  showMenu = false,
}: FinspoSkeletonTilesProps) {
  return Array.from({ length: count }).map((_, index) => (
    <FinspoSkeletonTile index={index} key={index} showAuthor={showAuthor} showMenu={showMenu} />
  ))
}

export function FinspoFeedSkeleton({
  count = 50,
  label = 'Loading Finspo posts',
  showAuthor = true,
  showMenu = false,
}: {
  count?: number
  label?: string
  showAuthor?: boolean
  showMenu?: boolean
}) {
  return (
    <section aria-busy="true" aria-label={label} className="my-2" role="status">
      <span className="sr-only">{label}</span>
      <div className="finspo-masonry columns-2 gap-2 md:columns-3 lg:columns-5 max-md:columns-2 max-md:gap-2">
        <FinspoSkeletonTiles count={count} showAuthor={showAuthor} showMenu={showMenu} />
      </div>
    </section>
  )
}

export function FinspoDetailSkeleton({
  featuredWidth = 900,
  wrapFeatured = false,
}: {
  featuredWidth?: number
  wrapFeatured?: boolean
}) {
  return (
    <section aria-busy="true" aria-label="Loading Finspo post" className="finspo-detail-layout min-w-0" role="status">
      <span className="sr-only">Loading Finspo post</span>
      <FinspoMasonry
        className="finspo-surround"
        featuredItem={(
        <article className="finspo-detail-card finspo-focus-card relative grid min-w-0 self-start items-start gap-0 overflow-hidden rounded-2xl border border-foose-border/70 bg-foose-surface shadow-sm md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]" key="focused-finspo-skeleton">
          <Pulse className="aspect-[4/5] w-full rounded-t-2xl md:aspect-auto md:h-full md:rounded-none" />
          <div className="flex h-[min(72dvh,620px)] min-h-0 flex-col overflow-hidden rounded-none border-0 bg-foose-surface p-4 shadow-none sm:p-5 md:h-[min(72dvh,680px)]">
            <div className="grid max-h-[40%] shrink-0 grid-cols-1 gap-3 overflow-hidden pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <Pulse className="size-8 shrink-0 rounded-full" />
                <span className="grid min-w-0 flex-1 gap-1.5">
                  <Pulse className="h-3 w-24 rounded-full" />
                  <Pulse className="h-2.5 w-20 rounded-full" />
                </span>
              </div>
              <Pulse className="h-4 w-4/5 rounded-full" />
              <Pulse className="h-4 w-3/5 rounded-full" />
              <Pulse className="h-3 w-24 rounded-full" />
              <span className="grid grid-cols-2 items-center gap-2 border-y border-foose-border py-2">
                <Pulse className="h-10 w-full rounded-xl" />
                <Pulse className="h-10 w-full rounded-xl" />
              </span>
            </div>
            <div className="flex min-h-0 flex-1 flex-col border-t border-foose-border pt-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <Pulse className="h-4 w-20 rounded-full" />
                <Pulse className="h-3 w-4 rounded-full" />
              </div>
              <div className="min-h-0 flex-1 space-y-4 overflow-hidden py-2">
                <Pulse className="h-3 w-4/5 rounded-full" />
                <Pulse className="h-3 w-3/5 rounded-full" />
              </div>
              <div className="shrink-0 border-t border-foose-border pt-3 md:flex md:items-center md:gap-2">
                <Pulse className="h-20 w-full rounded-xl md:h-12 md:flex-1" />
                <Pulse className="ml-auto mt-2 h-11 w-20 rounded-xl md:mt-0 md:h-8 md:w-16" />
              </div>
            </div>
          </div>
        </article>
        )}
        featuredReserveColumns={wrapFeatured ? 1 : 0}
        featuredWidth={featuredWidth}
        gap={10}
        maxColumns={5}
        minColumnWidth={135}
        minColumns={2}
        targetColumnWidth={220}
      >
        {Array.from({ length: 12 }, (_, index) => <FinspoSkeletonTile index={index} key={index} overlay />)}
      </FinspoMasonry>
    </section>
  )
}
