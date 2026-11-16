import { useEffect, useRef, type ReactNode } from 'react'
import { registerNavigationScrollRegion } from '../../utils/navigation'
import { ButtonLink } from '../index'

export function SellerOnboardingLayout({ children, milestone = 0, compactHeading = false }: { children: ReactNode; milestone?: number; compactHeading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  useEffect(() => registerNavigationScrollRegion('seller-onboarding', () => scrollRef.current), [])
  const labels = ['Verify identity', 'Approval', 'Shop details', 'Payout', 'Brand & launch']
  return <div ref={scrollRef} className="h-dvh overflow-y-auto overscroll-y-contain bg-foose-bg text-foose-text [-webkit-overflow-scrolling:touch]">
    <header className="grid min-h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 py-3 sm:flex sm:justify-between border-b border-foose-border bg-foose-surface px-4 sm:px-6 md:px-12">
      <a href="/" className="font-display text-3xl font-semibold text-accent">foose</a>
      <span className="col-start-1 row-start-2 text-xs text-foose-muted sm:order-none">Seller onboarding</span>
      <ButtonLink className="col-start-2 row-span-2 row-start-1 whitespace-nowrap" to="/profile" variant="secondary">Back to profile</ButtonLink>
    </header>
    <div className="mx-auto grid max-w-7xl gap-4 px-3 py-4 sm:gap-6 sm:px-4 sm:py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-12">
      <aside className="min-w-0"><p className="text-xs font-bold uppercase tracking-widest text-accent">Your seller journey</p>{!compactHeading && <h2 className="mt-4 hidden font-display text-2xl font-semibold lg:block">A little setup.<br />A shop of your own.</h2>}
        <ol aria-label="Seller onboarding progress" className="mt-3 grid grid-cols-5 gap-1 sm:mt-6 sm:gap-2 lg:flex lg:flex-col">{labels.map((label, index) => <li key={label} aria-current={index === milestone ? 'step' : undefined} className={`flex min-w-0 flex-col items-center gap-2 rounded-xl px-1 py-2 text-center text-[10px] leading-tight sm:text-xs lg:flex-row lg:gap-3 lg:p-3 lg:text-left lg:text-sm ${index === milestone ? 'bg-accent-light font-bold text-accent' : 'text-foose-muted'}`}><span className="grid size-7 shrink-0 place-items-center rounded-full border border-foose-border">{index < milestone ? '✓' : index + 1}</span>{label}</li>)}</ol>
      </aside>
      <main className="min-w-0 rounded-2xl border border-foose-border bg-foose-surface">{children}</main>
    </div>
  </div>
}
