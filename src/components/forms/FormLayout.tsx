import type { HTMLAttributes, ReactNode } from 'react'

export function FormPage({
  actions,
  aside,
  children,
  className = '',
  description,
  eyebrow,
  title,
  width = 'standard',
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  actions?: ReactNode
  aside?: ReactNode
  description?: ReactNode
  eyebrow?: ReactNode
  title?: ReactNode
  width?: 'compact' | 'standard' | 'wide'
}) {
  const widthClass = width === 'compact' ? 'max-w-2xl' : width === 'wide' ? 'max-w-7xl' : 'max-w-5xl'

  return (
    <div {...props} className={`mx-auto w-full min-w-0 ${widthClass} px-3 py-4 min-[380px]:px-4 sm:px-6 sm:py-7 lg:px-8 lg:py-8 ${className}`}>
      {(title || description || eyebrow || actions) && (
        <header className="mb-5 flex flex-col gap-3 border-b border-foose-border/70 pb-5 sm:mb-7 sm:flex-row sm:items-end sm:justify-between sm:gap-4 sm:pb-6">
          <div className="min-w-0 max-w-3xl">
            {eyebrow && <p className="mb-2 text-xs font-black uppercase tracking-[0.18em] text-accent">{eyebrow}</p>}
            {title && <h1 className="font-display text-2xl font-semibold leading-tight text-foose-text min-[380px]:text-3xl sm:text-4xl">{title}</h1>}
            {description && <div className="mt-2 max-w-2xl text-sm leading-6 text-foose-muted sm:text-base">{description}</div>}
          </div>
          {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&_a]:min-h-11 [&_a]:flex-1 [&_button]:min-h-11 [&_button]:flex-1 sm:[&_a]:flex-none sm:[&_button]:flex-none">{actions}</div>}
        </header>
      )}
      <div className={aside ? 'grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-6' : ''}>
        <div className="min-w-0 space-y-4 sm:space-y-6">{children}</div>
        {aside && <aside className="min-w-0 lg:sticky lg:top-24">{aside}</aside>}
      </div>
    </div>
  )
}

export function FormSection({
  actions,
  children,
  className = '',
  columns = 1,
  description,
  title,
  ...props
}: HTMLAttributes<HTMLElement> & {
  actions?: ReactNode
  columns?: 1 | 2
  description?: ReactNode
  title?: ReactNode
}) {
  return (
    <section {...props} className={`min-w-0 rounded-xl border border-foose-border/80 bg-foose-surface p-3.5 shadow-sm shadow-black/[0.025] min-[380px]:p-4 sm:rounded-2xl sm:p-5 lg:p-6 ${className}`}>
      {(title || description || actions) && (
        <div className="mb-4 flex flex-col gap-2.5 border-b border-foose-border/60 pb-3.5 sm:mb-5 sm:flex-row sm:items-start sm:justify-between sm:gap-3 sm:pb-4">
          <div className="min-w-0">
            {title && <h2 className="font-display text-lg font-semibold leading-snug text-foose-text sm:text-xl lg:text-2xl">{title}</h2>}
            {description && <div className="mt-1 text-sm leading-6 text-foose-muted">{description}</div>}
          </div>
          {actions && <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto [&_button]:min-h-11 [&_button]:flex-1 sm:[&_button]:flex-none">{actions}</div>}
        </div>
      )}
      <div className={`grid min-w-0 items-start gap-4 sm:gap-5 ${columns === 2 ? 'sm:grid-cols-2 sm:[&_.form-field-wide]:col-span-2' : ''}`}>{children}</div>
    </section>
  )
}

export function FormActions({
  bottomNavInset = true,
  children,
  className = '',
  pageInset = false,
  sticky = false,
  fixed = false,
}: {
  bottomNavInset?: boolean
  children: ReactNode
  className?: string
  pageInset?: boolean
  sticky?: boolean
  fixed?: boolean
}) {
  const mobileInset = pageInset
    ? '-mx-3 px-3 md:-mx-6 md:px-6'
    : '-mx-4 px-4 sm:-mx-6 sm:px-6'
  // Pages that render their own full-screen header outside AppShell (KycPage, etc.) have
  // no bottom tab bar, so the sticky bar should sit flush at the true bottom of the screen
  // instead of leaving a gap for a bottom nav that isn't rendered there.
  const stickyOffset = bottomNavInset
    ? 'bottom-[var(--foose-bottom-nav-inset)] py-3'
    : 'bottom-0 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3'

  return (
    <div className={`${fixed ? `fixed inset-x-0 bottom-0 z-20 border-t border-foose-border bg-foose-surface px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgba(26,27,37,0.06)] sm:px-6` : sticky ? `sticky ${stickyOffset} z-20 border-t border-foose-border bg-foose-surface/95 shadow-[0_-8px_24px_rgba(26,27,37,0.06)] backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:px-0 lg:py-0 lg:shadow-none ${mobileInset}` : 'pt-2'} flex min-w-0 flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end [&_a]:min-h-11 [&_a]:w-full [&_button]:min-h-11 [&_button]:w-full sm:[&_a]:w-auto sm:[&_button]:w-auto ${className}`}>
      {children}
    </div>
  )
}
