import { fireEvent, render, screen, within } from '@testing-library/react'
import { expect, it, vi } from 'vitest'
import { apiPost } from '../../lib/api'
import { FinspoAccountSuggestions } from './FinspoAccountSuggestions'

vi.mock('../../lib/api', () => ({ apiPost: vi.fn() }))

it('shows Follow back and Friends for mutual follows, then restores Follow back on unfollow', async () => {
  vi.mocked(apiPost).mockResolvedValueOnce({ following: true, followerCount: 2 }).mockResolvedValueOnce({ following: false, followerCount: 1 })
  render(<FinspoAccountSuggestions accounts={[
    { _id: 'ama', name: 'Ama', username: 'ama', finspoCount: 1, hasShop: false, isKycVerified: false, followsYou: true },
    { _id: 'kojo', name: 'Kojo', username: 'kojo', finspoCount: 2, hasShop: false, isKycVerified: false },
  ]} />)
  expect(screen.getByRole('button', { name: 'Follow @kojo' })).toHaveTextContent('Follow')
  fireEvent.click(screen.getByRole('button', { name: 'Follow back @ama' }))
  const friends = await screen.findByRole('button', { name: 'Friends @ama' })
  expect(friends).toHaveTextContent('Friends')
  expect(friends).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(friends)
  const confirmation = screen.getByRole('dialog', { name: 'Unfollow?' })
  expect(confirmation).toHaveAccessibleDescription("Unfollow @ama? You'll no longer be friends.")
  expect(apiPost).toHaveBeenCalledTimes(1)
  fireEvent.click(within(confirmation).getByRole('button', { name: 'Unfollow' }))
  expect(await screen.findByRole('button', { name: 'Follow back @ama' })).toBeVisible()
  expect(apiPost).toHaveBeenCalledWith('/users/ama/follow')
})
