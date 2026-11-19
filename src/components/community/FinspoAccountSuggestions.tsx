import { useState } from 'react'
import { MdVerified } from 'react-icons/md'
import { InlineNotice, LoadingRegion, SkeletonBlock } from '../feedback'
import { ConfirmDialog } from '../forms/Dialog'
import { apiPost } from '../../lib/api'
import type { FinspoAccountSuggestion } from '../../types/api'
import { getErrorMessage } from '../../utils/errorMessage'
import { initials } from '../../utils/format'
import { withBasePath } from '../../utils/navigation'

type FinspoAccountSuggestionsProps = {
  accounts: FinspoAccountSuggestion[]
  onFollowingChanged?: () => void | Promise<void>
  personalized?: boolean
}

function SuggestionAvatar({ account }: { account: FinspoAccountSuggestion }) {
  return account.profilePhoto ? (
    <img alt="" className="size-12 rounded-full object-cover" src={account.profilePhoto} />
  ) : (
    <span aria-hidden className="inline-flex size-12 items-center justify-center rounded-full bg-accent-light text-sm font-black text-accent">
      {initials(account.name)}
    </span>
  )
}

export function FinspoAccountSuggestions({ accounts, onFollowingChanged, personalized = false }: FinspoAccountSuggestionsProps) {
  const [pendingUnfollow, setPendingUnfollow] = useState<FinspoAccountSuggestion | null>(null)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [followingIds, setFollowingIds] = useState<Set<string>>(() => new Set())
  const [announcement, setAnnouncement] = useState('')

  async function toggleFollow(account: FinspoAccountSuggestion) {
    if (busyId) return

    setBusyId(account._id)
    setError('')
    try {
      const result = await apiPost<{ followerCount: number; following: boolean }>(`/users/${account.username}/follow`)
      setFollowingIds((current) => {
        const next = new Set(current)
        if (result.following) next.add(account._id)
        else next.delete(account._id)
        return next
      })
      setAnnouncement(result.following ? `You are now following @${account.username}` : `You unfollowed @${account.username}`)
      await onFollowingChanged?.()
    } catch (requestError) {
      setError(getErrorMessage(requestError, `Could not follow @${account.username}`))
    } finally {
      setPendingUnfollow(null)
      setBusyId('')
    }
  }

  return (
    <section className="mb-6 rounded-2xl border border-foose-border bg-foose-surface p-4 shadow-sm sm:p-5" aria-labelledby="finspo-account-suggestions-title">
      <span aria-live="polite" className="sr-only">{announcement}</span>
      <div className="mb-4">
        <p className="text-xs font-black uppercase tracking-[0.16em] text-accent">Build your Following feed</p>
        <h2 className="mt-1 text-xl font-black text-foose-text sm:text-2xl" id="finspo-account-suggestions-title">People to follow</h2>
        <p className="mt-1 text-sm leading-6 text-foose-muted">
          {personalized
            ? 'Picked from the styles and Finspo creators you engage with, with fresh accounts mixed in.'
            : 'Here is a fresh mix of active Finspo creators to get you started.'}
        </p>
      </div>

      {error && <InlineNotice className="mb-3" title="Follow status did not update" tone="error">{error}</InlineNotice>}

      <div className="grid gap-2.5 sm:grid-cols-2">
        {accounts.map((account) => {
          const following = followingIds.has(account._id)
          const followLabel = account.followsYou ? (following ? 'Friends' : 'Follow back') : (following ? 'Following' : 'Follow')
          const busy = busyId === account._id
          const profileHref = withBasePath(`/profile/${account.username}`)

          return (
            <article className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-foose-border bg-foose-surface-low p-3" key={account._id}>
              <a aria-label={`View @${account.username}'s profile`} className="shrink-0" href={profileHref}>
                <SuggestionAvatar account={account} />
              </a>
              <a className="min-w-0" href={profileHref}>
                <span className="flex min-w-0 items-center gap-1 text-sm font-black text-foose-text">
                  <span className="truncate">{account.name}</span>
                  {account.isKycVerified && <MdVerified aria-label="Verified profile" className="shrink-0 text-accent" />}
                </span>
                <span className="block truncate text-xs font-semibold text-foose-muted">@{account.username}</span>
                <span className="mt-0.5 block text-[11px] text-foose-faint">{account.finspoCount} Finspo {account.finspoCount === 1 ? 'post' : 'posts'}</span>
              </a>
              <button
                aria-label={`${account.followsYou ? followLabel : following ? 'Unfollow' : 'Follow'} @${account.username}`}
                className={`inline-flex min-h-10 min-w-20 shrink-0 items-center justify-center rounded-xl border px-3 text-xs font-black transition disabled:pointer-events-none disabled:opacity-60 ${following ? 'border-accent/25 bg-accent-light text-accent' : 'border-accent bg-accent text-white shadow-sm hover:bg-accent-hover'}`}
                title={following ? 'Unfollow' : undefined}
                aria-pressed={following}
                disabled={Boolean(busyId)}
                onClick={() => following && account.followsYou ? setPendingUnfollow(account) : void toggleFollow(account)}
                type="button"
              >
                {busy ? 'Saving...' : followLabel}
              </button>
            </article>
          )
        })}
      </div>
      <ConfirmDialog
        busy={Boolean(busyId)}
        confirmLabel="Unfollow"
        description={pendingUnfollow ? `Unfollow @${pendingUnfollow.username}? You'll no longer be friends.` : ''}
        iconInTitle
        onCancel={() => setPendingUnfollow(null)}
        onConfirm={() => { if (pendingUnfollow) void toggleFollow(pendingUnfollow) }}
        open={Boolean(pendingUnfollow)}
        title="Unfollow?"
        tone="destructive"
      />
    </section>
  )
}

export function FinspoAccountSuggestionsSkeleton() {
  return (
    <LoadingRegion className="mb-6 rounded-2xl border border-foose-border bg-foose-surface p-4 shadow-sm sm:p-5" label="Finding people to follow" layout="section">
      <div className="mb-4 space-y-2">
        <SkeletonBlock className="h-3 w-40 rounded-full" />
        <SkeletonBlock className="h-6 w-48 rounded-full" />
        <SkeletonBlock className="h-4 w-full max-w-lg rounded-full" />
      </div>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {Array.from({ length: 10 }).map((_, index) => (
          <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-foose-border bg-foose-surface-low p-3" key={index}>
            <SkeletonBlock className="size-12 rounded-full" />
            <span className="space-y-2">
              <SkeletonBlock className="h-3 w-3/4 rounded-full" />
              <SkeletonBlock className="h-3 w-1/2 rounded-full" />
            </span>
            <SkeletonBlock className="h-10 w-20 rounded-xl" />
          </div>
        ))}
      </div>
    </LoadingRegion>
  )
}
