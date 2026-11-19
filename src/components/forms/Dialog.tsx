import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../icons/Icon'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export type DialogProps = {
  children?: ReactNode
  className?: string
  closeLabel?: string
  description?: ReactNode
  dismissible?: boolean
  footer?: ReactNode
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  size?: 'sm' | 'md' | 'lg'
  title: ReactNode
}

export function Dialog({
  children,
  className = '',
  closeLabel = 'Close dialog',
  description,
  dismissible = true,
  footer,
  initialFocusRef,
  onClose,
  open,
  size = 'md',
  title,
}: DialogProps) {
  const generatedId = useId()
  const titleId = `dialog-${generatedId}-title`
  const descriptionId = `dialog-${generatedId}-description`
  const panelRef = useRef<HTMLDivElement | null>(null)
  const dismissibleRef = useRef(dismissible)
  const onCloseRef = useRef(onClose)

  useEffect(() => {
    dismissibleRef.current = dismissible
    onCloseRef.current = onClose
  }, [dismissible, onClose])

  useEffect(() => {
    if (!open) return undefined

    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const focusTimer = window.setTimeout(() => {
      const firstFocusable = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)
      ;(initialFocusRef?.current || firstFocusable || panelRef.current)?.focus()
    }, 0)

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape' && event.key !== 'Tab') return
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]')
      if (dialogs[dialogs.length - 1] !== panelRef.current) return

      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault()
        onCloseRef.current()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        .filter((element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true')
      if (!focusable.length) {
        event.preventDefault()
        panelRef.current.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panelRef.current)) {
        event.preventDefault()
        last?.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first?.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => previouslyFocused?.focus())
    }
  }, [initialFocusRef, open])

  if (!open || typeof document === 'undefined') return null

  const sizeClass = size === 'sm' ? 'sm:max-w-md' : size === 'lg' ? 'sm:max-w-3xl' : 'sm:max-w-xl'

  return createPortal(
    <div
      className="fixed inset-0 z-[1400] flex items-end justify-center bg-black/45 px-0 pt-12 backdrop-blur-[2px] sm:items-center sm:p-5"
      onMouseDown={(event) => {
        if (dismissible && event.target === event.currentTarget) onClose()
      }}
    >
      <div
        aria-describedby={description ? descriptionId : undefined}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`flex max-h-[min(92dvh,52rem)] min-w-0 w-full flex-col overflow-hidden rounded-t-2xl border border-foose-border bg-foose-surface shadow-2xl sm:max-h-[min(90dvh,52rem)] sm:rounded-3xl ${sizeClass} ${className}`}
        ref={panelRef}
        role="dialog"
        tabIndex={-1}
      >
        <header className="flex items-start justify-between gap-3 border-b border-foose-border/70 px-4 py-3.5 sm:gap-4 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold leading-tight text-foose-text min-[380px]:text-xl sm:text-2xl" id={titleId}>{title}</h2>
            {description && <div className="mt-1 text-sm leading-6 text-foose-muted" id={descriptionId}>{description}</div>}
          </div>
          {dismissible && (
            <button
              aria-label={closeLabel}
              className="-mr-2 grid min-h-11 min-w-11 shrink-0 place-items-center rounded-full text-foose-muted transition hover:bg-foose-surface-low hover:text-foose-text focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
              onClick={onClose}
              type="button"
            >
              <Icon name="close" size={20} />
            </button>
          )}
        </header>
        {children && <div className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-y-auto px-4 py-4 [scrollbar-width:thin] sm:px-6 sm:py-5">{children}</div>}
        {footer && <footer className="flex flex-col-reverse gap-2 border-t border-foose-border/70 bg-foose-surface-low/45 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 sm:flex-row sm:justify-end sm:px-6 sm:py-4 [&_button]:min-h-11 [&_button]:w-full sm:[&_button]:w-auto">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  busy = false,
  cancelLabel = 'Cancel',
  confirmLabel = 'Confirm',
  description,
  iconInTitle = false,
  onCancel,
  onConfirm,
  open,
  title,
  tone = 'default',
}: {
  busy?: boolean
  cancelLabel?: string
  confirmLabel?: string
  description: ReactNode
  iconInTitle?: boolean
  onCancel: () => void
  onConfirm: () => void
  open: boolean
  title: ReactNode
  tone?: 'default' | 'destructive'
}) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)
  const confirmRef = useRef<HTMLButtonElement | null>(null)
  const showWarning = tone === 'destructive'
  return (
    <Dialog
      description={description}
      dismissible={!busy}
      footer={(
        <>
          <button
            className="rounded-xl border border-foose-border bg-foose-surface px-5 py-2.5 text-sm font-bold text-foose-text transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
            disabled={busy}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            aria-busy={busy || undefined}
            className={`inline-flex items-center justify-center gap-2 rounded-xl border px-5 py-2.5 text-sm font-black text-white transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${tone === 'destructive' ? 'border-foose-danger bg-foose-danger hover:brightness-95 focus-visible:outline-foose-danger' : 'border-accent bg-accent hover:bg-accent-hover focus-visible:outline-accent'}`}
            disabled={busy}
            onClick={onConfirm}
            ref={confirmRef}
            type="button"
          >
            {busy && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
            {busy ? 'Please wait…' : confirmLabel}
          </button>
        </>
      )}
      initialFocusRef={tone === 'destructive' ? cancelRef : confirmRef}
      onClose={onCancel}
      open={open}
      size="sm"
      title={showWarning && iconInTitle ? (
        <span className="inline-flex items-center gap-2 [&>svg]:shrink-0 [&>svg]:text-foose-danger">
          <Icon name="alert" size={24} />
          {title}
        </span>
      ) : title}
    >
      {showWarning && !iconInTitle && (
        <div aria-hidden="true" className="grid size-12 place-items-center rounded-full bg-foose-danger-bg text-foose-danger">
          <Icon name="alert" size={24} />
        </div>
      )}
    </Dialog>
  )
}
