import type { ReactNode } from 'react'
import { ButtonLink } from '../index'

export function SellerOnboardingLayout({ children, milestone = 0 }: { children: ReactNode; milestone?: number }) {
  const labels = ['Verify identity', 'Approval', 'Shop details', 'Payout', 'Brand & launch']
  return <div className="min-h-dvh bg-foose-bg text-foose-text">
    <header className="flex min-h-20 items-center justify-between border-b border-foose-border bg-foose-surface px-6 md:px-12">
      <a href="/" className="font-display text-3xl font-semibold text-accent">foose</a>
      <span className="text-xs text-foose-muted">Seller onboarding</span>
      <ButtonLink to="/profile" variant="secondary">Back to profile</ButtonLink>
    </header>
    <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-12">
      <aside><p className="text-xs font-bold uppercase tracking-widest text-accent">Your seller journey</p><h2 className="mt-4 hidden font-display text-2xl font-semibold lg:block">A little setup.<br />A shop of your own.</h2>
        <ol aria-label="Seller onboarding progress" className="mt-6 flex gap-2 overflow-x-auto lg:flex-col">{labels.map((label, index) => <li key={label} aria-current={index === milestone ? 'step' : undefined} className={`flex min-w-28 items-center gap-3 rounded-xl p-3 text-xs lg:text-sm ${index === milestone ? 'bg-accent-light font-bold text-accent' : 'text-foose-muted'}`}><span className="grid size-7 shrink-0 place-items-center rounded-full border border-foose-border">{index < milestone ? '✓' : index + 1}</span>{label}</li>)}</ol>
      </aside>
      <main className="min-w-0 rounded-2xl border border-foose-border bg-foose-surface">{children}</main>
    </div>
  </div>
}
