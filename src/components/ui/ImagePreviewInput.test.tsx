import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useImagePreviewStore } from '../../stores/imagePreviewStore'
import { ImagePreviewInput } from './ImagePreviewInput'

describe('ImagePreviewInput', () => {
  beforeEach(() => {
    useImagePreviewStore.getState().closePreview()
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((file: File) => `blob:${file.name}`),
      revokeObjectURL: vi.fn(),
    })
  })

  it('renders a labelled dropzone and validates type and size', () => {
    render(<ImagePreviewInput accept="image/png" label="Listing photos" maxBytes={10} maxFiles={2} multiple name="photos" />)
    const input = screen.getByLabelText(/listing photos/i)
    fireEvent.change(input, { target: { files: [new File(['not-an-image'], 'notes.txt', { type: 'text/plain' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('not an accepted image type')

    fireEvent.change(input, { target: { files: [new File(['this is too large'], 'large.png', { type: 'image/png' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('larger than 10 B')
  })

  it('shows file metadata and accessible preview controls', () => {
    render(<ImagePreviewInput accept="image/*" label="Photo" maxBytes={1024} maxFiles={1} name="photo" />)
    fireEvent.change(screen.getByLabelText('Photo'), {
      target: { files: [new File(['image'], 'jacket.png', { type: 'image/png' })] },
    })
    expect(screen.getByText('jacket.png')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Remove selected upload 1' })).toHaveClass('min-h-11')
    expect(screen.getByText('Maximum of 1 image reached.')).toBeVisible()
  })

  it('publishes reordered listing files and keeps preview order in sync', () => {
    const onFilesChange = vi.fn()
    render(<ImagePreviewInput label="Listing images" multiple maxFiles={6} name="images" presentation="strip" onFilesChange={onFilesChange} />)
    const files = ['one', 'two'].map((name) => new File(['image'], `${name}.png`, { type: 'image/png' }))
    fireEvent.change(screen.getByLabelText('Listing images'), { target: { files } })
    fireEvent.keyDown(screen.getByRole('button', { name: 'Reorder image 1' }), { key: 'ArrowRight' })
    expect(onFilesChange).toHaveBeenLastCalledWith([files[1], files[0]])
    expect(screen.getAllByRole('button', { name: /^Open / }).map((button) => button.getAttribute('aria-label'))).toEqual(['Open two.png', 'Open one.png'])
    expect(screen.getByText('Drag to reorder.')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Remove selected upload 1' }))
    expect(onFilesChange).toHaveBeenLastCalledWith([files[0]])
    expect(screen.queryByText('Drag to reorder.')).not.toBeInTheDocument()
  })

  it('renders listing images in one six-slot FIFO strip and hides the add tile at the limit', () => {
    render(<ImagePreviewInput accept="image/*" label="Listing images" maxFiles={6} multiple name="images" presentation="strip" />)
    const input = screen.getByLabelText('Listing images')
    const firstBatch = ['one', 'two', 'three'].map((name) => new File(['image'], `${name}.png`, { type: 'image/png' }))
    const secondBatch = ['four', 'five', 'six'].map((name) => new File(['image'], `${name}.png`, { type: 'image/png' }))

    fireEvent.change(input, { target: { files: firstBatch } })
    fireEvent.change(input, { target: { files: secondBatch } })

    const strip = screen.getByTestId('image-preview-strip')
    expect(strip).toHaveClass('grid-cols-6')
    expect(screen.queryByRole('button', { name: 'Add listing images' })).not.toBeInTheDocument()
    const previews = screen.getAllByRole('button', { name: /^Open / })
    expect(previews.map((preview) => preview.getAttribute('aria-label'))).toEqual([
      'Open one.png',
      'Open two.png',
      'Open three.png',
      'Open four.png',
      'Open five.png',
      'Open six.png',
    ])

    fireEvent.click(previews[2])
    expect(useImagePreviewStore.getState().index).toBe(2)
    expect(useImagePreviewStore.getState().items).toHaveLength(6)

    fireEvent.click(screen.getByRole('button', { name: 'Remove selected upload 1' }))
    expect(screen.getByRole('button', { name: 'Add listing images' })).toBeVisible()
    expect(strip.lastElementChild).toBe(screen.getByRole('button', { name: 'Add listing images' }))
  })
})
