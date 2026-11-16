import { useState } from 'react'
import { AdminShell, Badge, ButtonLink, Dialog, Icon, InlineNotice, SafeImage, StatePanel, TextAreaField, useToast } from '../components'
import { FormPageSkeleton } from '../components/operational/OperationalStates'
import { NavigationBackButton } from '../components/navigation'
import { roleLabels } from '../constants/roles'
import { useApiResource } from '../hooks/useApiResource'
import { apiPut } from '../lib/api'
import type { KycRecord, User } from '../types/api'
import { getErrorMessage } from '../utils/errorMessage'
import { formatDateTime, initials } from '../utils/format'
import { getCurrentAppPathname } from '../utils/navigation'

type KycDetail = KycRecord & {
  _id: string
  userId?: User | string
}

const STATUS_TONE = {
  approved: 'success',
  not_submitted: 'neutral',
  pending: 'accent',
  rejected: 'danger',
} as const

function currentKycId() {
  const match = getCurrentAppPathname().match(/^\/admin\/kyc\/([^/]+)/)
  return match ? decodeURIComponent(match[1]).trim() : ''
}

function getUserName(user?: User | string) {
  if (!user) return 'Unknown seller'
  return typeof user === 'string' ? user : user.name
}

function getUserEmail(user?: User | string) {
  return typeof user === 'object' ? user.email : undefined
}

function getUserPhone(user?: User | string) {
  return typeof user === 'object' ? user.phone : undefined
}

function getUserMeta(user?: User | string) {
  if (typeof user !== 'object') return []
  return [user.username ? `@${user.username}` : undefined, ...roleLabels(user.roles, user.role)].filter(Boolean)
}

function DocumentPreview({ title, url }: { title: string; url?: string }) {
  return (
    <article className="kyc-document-card rounded-xl border border-foose-border bg-foose-surface shadow-sm p-4 md:p-5">
      <header>
        <strong>{title}</strong>
        {url && (
          <a href={url} rel="noreferrer" target="_blank">
            Open image
          </a>
        )}
      </header>
      <div className="kyc-document-image overflow-hidden rounded-lg bg-foose-surface-mid [&_img]:h-full [&_img]:w-full [&_img]:object-cover image-frame">
        <SafeImage alt={title} className="h-full min-h-32 w-full object-cover" fallback="No image submitted" fallbackClassName="text-sm" src={url} />
      </div>
    </article>
  )
}

export function AdminKycDetailPage() {
  const kycId = currentKycId()
  const resource = useApiResource<{ kyc: KycDetail }>(kycId ? `/admin/kyc/${kycId}` : null)
  const [actionError, setActionError] = useState('')
  const [busyAction, setBusyAction] = useState('')
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false)
  const [rejectionReason, setRejectionReason] = useState('')
  const [rejectionError, setRejectionError] = useState('')
  const { showToast } = useToast()

  async function approve() {
    if (!kycId) return
    setActionError('')
    setBusyAction('approve')
    try {
      await apiPut(`/admin/kyc/${kycId}/approve`)
      await resource.refetch()
      showToast({ message: 'This identity record is approved.', title: 'KYC approved', tone: 'success' })
    } catch (requestError) {
      setActionError(getErrorMessage(requestError, 'Unable to approve KYC submission'))
    } finally {
      setBusyAction('')
    }
  }

  async function reject() {
    if (!kycId) return
    const reason = rejectionReason.trim()
    if (!reason) {
      setRejectionError('Add a clear reason so the seller knows what to correct.')
      return
    }
    setRejectionError('')
    setBusyAction('reject')
    try {
      await apiPut(`/admin/kyc/${kycId}/reject`, { reason })
      await resource.refetch()
      showToast({ message: 'The rejection reason is available to the seller.', title: 'KYC rejected', tone: 'info' })
      setRejectionDialogOpen(false)
      setRejectionReason('')
    } catch (requestError) {
      setRejectionError(getErrorMessage(requestError, 'Unable to reject KYC submission'))
    } finally {
      setBusyAction('')
    }
  }

  const kyc = resource.data?.kyc
  const sellerName = getUserName(kyc?.userId)
  const userMeta = getUserMeta(kyc?.userId)

  return (
    <AdminShell section="kyc">
      <section className="admin-page p-4 md:p-6 lg:p-8">
        <NavigationBackButton className="mb-6" fallback={{ href: '/admin/kyc', label: 'KYC queue' }} />
        {!kycId && <StatePanel action={<ButtonLink to="/admin/kyc">Return to KYC queue</ButtonLink>} body="Open a KYC record from the admin queue." layout="page" title="KYC record required" tone="unavailable" />}
        {resource.initialLoading && <FormPageSkeleton label="Loading KYC details" media />}
        {resource.error && !resource.data && <StatePanel action={<button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent" onClick={() => void resource.refetch()} type="button">Retry</button>} body={resource.error} layout="page" title="KYC record unavailable" tone="unavailable" />}
        {actionError && <InlineNotice title="Review action failed" tone="error">{actionError}</InlineNotice>}
        {kyc && (
          <>
            <div className="admin-title mb-5 flex flex-col gap-2 md:flex-row md:items-center md:justify-between [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:md:text-4xl [&_p]:text-sm [&_p]:leading-6 [&_p]:text-foose-muted [&_p]:md:text-base max-md:[&_h1]:text-2xl">
              <div>
                <h1>{sellerName}</h1>
                <p>Review identity documents, card number, selfie, and submission history.</p>
              </div>
              <div className="button-row flex flex-wrap items-center gap-3">
                <Badge tone={STATUS_TONE[kyc.status]}>{kyc.status.replace('_', ' ')}</Badge>
                <button className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-primary border-accent bg-accent text-white shadow-md shadow-accent/15 hover:bg-accent-hover" disabled={busyAction === 'approve'} onClick={() => void approve()} type="button">
                  {busyAction === 'approve' ? 'Approving...' : 'Approve'}
                </button>
                <button
                  className="button inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-5 py-2.5 text-center text-sm font-bold transition disabled:pointer-events-none disabled:opacity-50 [&.full]:w-full button-secondary border-foose-border bg-foose-surface text-foose-text hover:border-accent hover:text-accent"
                  disabled={Boolean(busyAction)}
                  onClick={() => {
                    setActionError('')
                    setRejectionError('')
                    setRejectionReason('')
                    setRejectionDialogOpen(true)
                  }}
                  type="button"
                >
                  {busyAction === 'reject' ? 'Rejecting...' : 'Reject'}
                </button>
              </div>
            </div>

            <div className="kyc-detail-grid grid gap-6">
              <section className="form-card rounded-xl border border-foose-border bg-foose-surface shadow-sm p-4 md:p-5 [&_label]:text-sm [&_label]:font-semibold [&_label]:text-foose-text [&_label]:flex [&_label]:flex-col [&_label]:gap-2 [&_input]:w-full [&_input]:px-3 [&_input]:py-3 [&_select]:w-full [&_select]:px-3 [&_select]:py-3 [&_textarea]:w-full [&_textarea]:px-3 [&_textarea]:py-3 max-lg:rounded-lg max-lg:p-3 kyc-identity-card">
                <div className="person-heading">
                  <span className="initials inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-light text-sm font-bold text-accent">{initials(sellerName)}</span>
                  <div>
                    <h2>Seller details</h2>
                    {getUserEmail(kyc.userId) && <p>{getUserEmail(kyc.userId)}</p>}
                  </div>
                </div>
                <dl className="record-grid grid gap-3 sm:grid-cols-2 [&_div]:rounded-lg [&_div]:bg-foose-surface-low [&_div]:p-3 [&_dt]:text-xs [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-widest [&_dt]:text-foose-faint [&_dd]:mt-1 [&_dd]:text-sm [&_dd]:font-semibold [&_dd]:text-foose-text [&_.wide]:sm:col-span-2">
                  <div>
                    <dt>Account</dt>
                    <dd>{userMeta.join(' / ') || 'Not available'}</dd>
                  </div>
                  <div>
                    <dt>Submitted</dt>
                    <dd>{formatDateTime(kyc.submittedAt)}</dd>
                  </div>
                  <div>
                    <dt>Reviewed</dt>
                    <dd>{formatDateTime(kyc.reviewedAt)}</dd>
                  </div>
                  <div>
                    <dt>Submission count</dt>
                    <dd>{kyc.submissionCount || 0}</dd>
                  </div>
                </dl>
              </section>

              <section className="form-card rounded-xl border border-foose-border bg-foose-surface shadow-sm p-4 md:p-5 [&_label]:text-sm [&_label]:font-semibold [&_label]:text-foose-text [&_label]:flex [&_label]:flex-col [&_label]:gap-2 [&_input]:w-full [&_input]:px-3 [&_input]:py-3 [&_select]:w-full [&_select]:px-3 [&_select]:py-3 [&_textarea]:w-full [&_textarea]:px-3 [&_textarea]:py-3 max-lg:rounded-lg max-lg:p-3">
                <h2>
                  <Icon name="shield" /> ID details
                </h2>
                <dl className="record-grid grid gap-3 sm:grid-cols-2 [&_div]:rounded-lg [&_div]:bg-foose-surface-low [&_div]:p-3 [&_dt]:text-xs [&_dt]:font-bold [&_dt]:uppercase [&_dt]:tracking-widest [&_dt]:text-foose-faint [&_dd]:mt-1 [&_dd]:text-sm [&_dd]:font-semibold [&_dd]:text-foose-text [&_.wide]:sm:col-span-2">
                  <div>
                    <dt>ID type</dt>
                    <dd>{kyc.idType || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Card / document number</dt>
                    <dd>{kyc.idNo || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Phone number</dt>
                    <dd>{kyc.phone || getUserPhone(kyc.userId) || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Date of birth</dt>
                    <dd>{kyc.dob || 'Not provided'}</dd>
                  </div>
                  <div>
                    <dt>Reviewer</dt>
                    <dd>{getUserName(kyc.reviewedBy)}</dd>
                  </div>
                  {kyc.rejectionReason && (
                    <div className="wide">
                      <dt>Rejection reason</dt>
                      <dd className="danger-text font-semibold text-foose-danger">{kyc.rejectionReason}</dd>
                    </div>
                  )}
                </dl>
              </section>
            </div>

            <section className="kyc-documents grid gap-6">
              <DocumentPreview title="ID front / photo page" url={kyc.idImgUrl} />
              <DocumentPreview title="ID back" url={kyc.idBackImgUrl} />
              <DocumentPreview title="Submitted selfie" url={kyc.selfieImgUrl} />
            </section>

            <div className="form-actions flex flex-wrap items-center gap-3">
              <ButtonLink to="/admin/kyc" variant="secondary">
                Return to queue
              </ButtonLink>
            </div>

            <Dialog
              description={`Explain what ${sellerName} needs to correct before resubmitting.`}
              dismissible={!busyAction}
              footer={(
                <>
                  <button
                    className="inline-flex min-h-11 items-center justify-center rounded-xl border border-foose-border bg-foose-surface px-5 text-sm font-bold text-foose-text transition hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-50"
                    disabled={Boolean(busyAction)}
                    onClick={() => setRejectionDialogOpen(false)}
                    type="button"
                  >
                    Cancel
                  </button>
                  <button
                    aria-busy={busyAction === 'reject' || undefined}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-foose-danger bg-foose-danger px-5 text-sm font-black text-white transition hover:brightness-95 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foose-danger disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={Boolean(busyAction)}
                    onClick={() => void reject()}
                    type="button"
                  >
                    {busyAction === 'reject' && <span aria-hidden="true" className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent motion-reduce:animate-none" />}
                    {busyAction === 'reject' ? 'Rejecting...' : 'Reject submission'}
                  </button>
                </>
              )}
              onClose={() => {
                if (!busyAction) setRejectionDialogOpen(false)
              }}
              open={rejectionDialogOpen}
              size="sm"
              title="Reject KYC submission?"
            >
              <TextAreaField
                autoFocus
                error={rejectionError}
                hint="This message will be visible to the seller. Be specific and avoid including sensitive information."
                id="admin-kyc-detail-rejection-reason"
                label="Reason for rejection"
                maxLength={500}
                onChange={(event) => {
                  setRejectionReason(event.currentTarget.value)
                  if (rejectionError) setRejectionError('')
                }}
                placeholder="For example: The selfie does not clearly match the submitted ID."
                required
                rows={5}
                value={rejectionReason}
              />
            </Dialog>
          </>
        )}
      </section>
    </AdminShell>
  )
}
