import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { OpenShopPage } from './OpenShopPage'

vi.mock('../hooks/useAuth', () => ({ useAuth: () => ({ user: { _id: 'seller', isKycVerified: true, name: 'Ama', phone: '0240000000', location: { city: 'Accra', region: 'Greater Accra' } }, refreshUser: vi.fn() }) }))
vi.mock('../components/forms/useLocalDraft', () => ({ useLocalDraft: () => ({ hasRecoverableDraft: false, clearDraft: vi.fn() }) }))

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

it('validates combined details and advances through payout to optional images', () => {
  render(<OpenShopPage />)
  expect(screen.getByRole('textbox', { name: /City or town/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(screen.getByRole('textbox', { name: /Shop name/ })).toHaveAttribute('aria-invalid', 'true')
  fireEvent.change(screen.getByRole('textbox', { name: /Shop name/ }), { target: { value: 'Ama Finds' } })
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(screen.getByRole('heading', { name: 'Payout details' })).toBeVisible()
  fireEvent.change(screen.getByLabelText(/Account name/), { target: { value: 'Ama' } })
  fireEvent.change(screen.getByLabelText(/Phone number/), { target: { value: '0240000000' } })
  fireEvent.click(screen.getByRole('combobox', { name: /Provider/ }))
  fireEvent.click(screen.getByRole('option', { name: 'MTN' }))
  fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
  expect(screen.getByRole('heading', { name: 'Shop images' })).toBeVisible()
  expect(screen.getByLabelText('Shop logo')).toBeVisible()
  expect(screen.getByRole('button', { name: /Create DigiShop/ })).toBeVisible()
  fireEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(screen.getByRole('combobox', { name: /Provider/ })).toHaveTextContent('MTN')
})
