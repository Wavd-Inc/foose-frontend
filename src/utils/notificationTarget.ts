import { stripBasePath } from './navigation'
import { resolveRoute } from './routes'

export type NotificationTarget = { kind: 'internal'; href: string } | { kind: 'external'; href: string; domain: string } | { kind: 'details'; unavailable: boolean }

export function notificationTarget(link?: string): NotificationTarget {
  const value = link?.trim()
  if (!value) return { kind: 'details', unavailable: false }
  try {
    if (!value.startsWith('/') && !value.startsWith('#/') && !/^https?:\/\//i.test(value)) return { kind: 'details', unavailable: true }
    const url = new URL(value, window.location.origin)
    if (url.username || url.password) return { kind: 'details', unavailable: true }
    if (url.origin !== window.location.origin) return url.protocol === 'https:' ? { kind: 'external', href: url.href, domain: url.hostname } : { kind: 'details', unavailable: true }
    const route = url.hash.startsWith('#/') ? new URL(url.hash.slice(1), window.location.origin) : url
    const pathname = stripBasePath(route.pathname)
    if (resolveRoute(pathname, route.search) === 'notFound') return { kind: 'details', unavailable: true }
    return { kind: 'internal', href: `${pathname}${route.search}${route.hash}` }
  } catch {
    return { kind: 'details', unavailable: true }
  }
}
