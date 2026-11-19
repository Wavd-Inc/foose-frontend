import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FinspoMediaComposer, type FinspoComposerMedia } from './FinspoMediaComposer'

function existing(index: number): FinspoComposerMedia {
  return { id: `existing-${index}`, kind: 'existing', url: `${index}.jpg` }
}

describe('FinspoMediaComposer', () => {
  beforeEach(() => {
    vi.spyOn(URL, 'createObjectURL').mockImplementation((file) => `blob:${(file as File).name}`)
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined)
  })

  it('publishes the requested order when an author moves an image', () => {
    const onChange = vi.fn()
    render(<FinspoMediaComposer items={[existing(1), existing(2)]} onChange={onChange} />)

    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder image 1' }), { key: 'ArrowRight' })

    expect(onChange).toHaveBeenCalledWith([existing(2), existing(1)])
  })

  it('caps device selection at eight total images', () => {
    const onChange = vi.fn()
    const { container } = render(
      <FinspoMediaComposer items={Array.from({ length: 7 }, (_, index) => existing(index))} onChange={onChange} />,
    )
    const input = container.querySelector('input[type="file"]') as HTMLInputElement
    const first = new File(['one'], 'one.jpg', { type: 'image/jpeg' })
    const second = new File(['two'], 'two.jpg', { type: 'image/jpeg' })

    fireEvent.change(input, { target: { files: [first, second] } })

    expect(onChange.mock.calls[0][0]).toHaveLength(8)
    expect(screen.getByRole('alert')).toHaveTextContent('Only 1 more image can be added.')
  })
})
