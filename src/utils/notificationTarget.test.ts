import { describe, expect, it, vi } from 'vitest'
import { notificationTarget } from './notificationTarget'
vi.mock('./navigation', () => ({ stripBasePath: (path: string) => path.replace(/^\/foose(?=\/|$)/, '') || '/' }))

describe('notification destinations', () => {
  it.each(['/orders/order-1', '/profile/ama', '/shops/ama', '/kyc', '/account/kyc', '/community/finspo/post-1?comments=1&comment=reply-1'])('opens %s directly', (href) => {
    expect(notificationTarget(href)).toEqual({ kind: 'internal', href })
  })
  it('supports same-origin links, base paths and hash routes', () => {
    expect(notificationTarget(`${window.location.origin}/foose/orders/one?tab=details#receipt`)).toEqual({ kind: 'internal', href: '/orders/one?tab=details#receipt' })
    expect(notificationTarget('#/account/kyc')).toEqual({ kind: 'internal', href: '/account/kyc' })
  })
  it('keeps announcements and external websites in details', () => {
    expect(notificationTarget()).toEqual({ kind: 'details', unavailable: false })
    expect(notificationTarget('https://example.com/news')).toEqual({ kind: 'external', href: 'https://example.com/news', domain: 'example.com' })
  })
  it.each(['javascript:alert(1)', 'data:text/html,test', 'http://example.com', 'https://user:pass@example.com', '/not-a-foose-page', 'not a url'])('rejects %s', (href) => {
    expect(notificationTarget(href)).toEqual({ kind: 'details', unavailable: true })
  })
})
