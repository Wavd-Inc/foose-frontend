import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { ImageReorderHandle } from './ImageReorderHandle'

afterEach(() => vi.restoreAllMocks())

function pointer(element: HTMLElement, type: string, x = 0) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { button: 0, pointerId: 1, clientX: x, clientY: 20 })
  fireEvent(element, event)
}

it('drops an image at the target position and clears its highlight', () => {
  const onMove = vi.fn()
  render(<><ImageReorderHandle src="photo.jpg" group="photos" index={0} count={3} onMove={onMove} /><div data-testid="target" data-image-reorder-group="photos" data-image-reorder-index="2" /></>)
  const handle = screen.getByRole('button', { name: 'Reorder image 1' })
  const target = screen.getByTestId('target')
  handle.setPointerCapture = vi.fn()
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => target) })
  pointer(handle, 'pointerdown')
  expect(screen.getByTestId('image-drag-preview').querySelector('img')).toHaveAttribute('src', 'photo.jpg')
  pointer(handle, 'pointermove', 100)
  expect(screen.getByTestId('image-drag-preview')).toHaveStyle({ left: '116px', top: '36px' })
  expect(target).toHaveAttribute('data-image-drop-target')
  expect(onMove).not.toHaveBeenCalled()
  pointer(handle, 'pointerup', 100)
  expect(onMove).toHaveBeenCalledWith(0, 2)
  expect(screen.queryByTestId('image-drag-preview')).not.toBeInTheDocument()
  expect(target).not.toHaveAttribute('data-image-drop-target')
})

it('ignores drops in another image group and cancelled gestures', () => {
  const onMove = vi.fn()
  render(<><ImageReorderHandle src="photo.jpg" group="photos" index={0} count={2} onMove={onMove} /><div data-testid="other" data-image-reorder-group="other" data-image-reorder-index="1" /></>)
  const handle = screen.getByRole('button', { name: 'Reorder image 1' })
  handle.setPointerCapture = vi.fn()
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => screen.getByTestId('other')) })
  pointer(handle, 'pointerdown')
  pointer(handle, 'pointerup')
  pointer(handle, 'pointerdown')
  pointer(handle, 'pointercancel')
  expect(screen.queryByTestId('image-drag-preview')).not.toBeInTheDocument()
  pointer(handle, 'pointerup')
  expect(onMove).not.toHaveBeenCalled()
})

it('supports keyboard movement without moving beyond the first image', () => {
  const onMove = vi.fn()
  render(<ImageReorderHandle src="photo.jpg" group="photos" index={0} count={2} onMove={onMove} />)
  const handle = screen.getByRole('button', { name: 'Reorder image 1' })
  fireEvent.keyDown(handle, { key: 'ArrowLeft' })
  expect(onMove).not.toHaveBeenCalled()
  fireEvent.keyDown(handle, { key: 'ArrowRight' })
  expect(onMove).toHaveBeenCalledWith(0, 1)
})
