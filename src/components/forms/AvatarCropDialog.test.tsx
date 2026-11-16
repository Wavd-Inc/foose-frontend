import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AvatarCropDialog } from './AvatarCropDialog'

class MockImage {
  naturalHeight = 600
  naturalWidth = 900
  onerror: (() => void) | null = null
  onload: (() => void) | null = null

  set src(_value: string) {
    queueMicrotask(() => this.onload?.())
  }
}

describe('AvatarCropDialog', () => {
  const context = {
    clearRect: vi.fn(),
    fillRect: vi.fn(),
    drawImage: vi.fn(),
    imageSmoothingEnabled: false,
    imageSmoothingQuality: 'low',
  } as unknown as CanvasRenderingContext2D
  const jpegBlob = new Blob(['cropped-avatar'], { type: 'image/jpeg' })

  beforeEach(() => {
    vi.stubGlobal('Image', MockImage)
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:avatar-preview'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => context)
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) => callback(jpegBlob))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('rejects unsupported and oversized image files with an accessible error', () => {
    render(<AvatarCropDialog onApply={vi.fn()} onCancel={vi.fn()} open />)

    const input = screen.getByLabelText('Choose profile photo')
    fireEvent.change(input, { target: { files: [new File(['gif'], 'avatar.gif', { type: 'image/gif' })] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose a JPEG, PNG, or WebP image.')

    const oversized = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'large.jpg', { type: 'image/jpeg' })
    fireEvent.change(input, { target: { files: [oversized] } })
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an image that is 5 MB or smaller.')
  })

  it('creates an exact square JPEG file from the positioned crop', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    const initialFile = new File(['source'], 'portrait.png', { type: 'image/png' })
    render(<AvatarCropDialog onApply={onApply} onCancel={vi.fn()} open />)

    await user.upload(screen.getByLabelText('Choose profile photo'), initialFile)

    const applyButton = await screen.findByRole('button', { name: 'Apply photo' })
    await waitFor(() => expect(applyButton).toBeEnabled())
    const canvas = screen.getByRole('img', { name: 'Profile photo crop area' }) as HTMLCanvasElement
    expect(canvas.width).toBe(512)
    expect(canvas.height).toBe(512)

    fireEvent.change(screen.getByLabelText('Zoom image'), { target: { value: '1.5' } })
    fireEvent.click(applyButton)

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    const output = onApply.mock.calls[0]?.[0]
    expect(output).toBeInstanceOf(File)
    expect(output.type).toBe('image/jpeg')
    expect(output.name).toBe('portrait-avatar.jpg')
    expect(HTMLCanvasElement.prototype.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92)
  })

  it('restores the applied crop from its original source after reopening', async () => {
    const onApply = vi.fn()
    const source = new File(['source'], 'id.png', { type: 'image/png' })
    const view = render(<AvatarCropDialog open initialFile={source} onApply={onApply} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply photo' })).toBeEnabled())
    fireEvent.change(screen.getByLabelText('Zoom image'), { target: { value: '2' } })
    fireEvent.keyDown(screen.getByRole('img', { name: 'Profile photo crop area' }), { key: 'ArrowRight' })
    fireEvent.click(screen.getByRole('button', { name: 'Apply photo' }))
    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    const saved = onApply.mock.calls[0][1]
    expect(saved.sourceFile).toBe(source)
    expect(saved.cropState).toEqual({ pan: { x: 8, y: 0 }, zoom: 2 })
    view.unmount()
    render(<AvatarCropDialog open initialFile={saved.sourceFile} initialCrop={saved.cropState} onApply={vi.fn()} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply photo' })).toBeEnabled())
    expect(screen.getByLabelText('Zoom image')).toHaveValue('2')
    expect(context.drawImage).toHaveBeenLastCalledWith(expect.anything(), -504, -256, 1536, 1024)
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))
    expect(screen.getByLabelText('Zoom image')).toHaveValue('1')
    expect(saved.cropState.zoom).toBe(2)
  })

  it('fits the whole ID into a padded rectangular output', async () => {
    render(<AvatarCropDialog open imageFit="contain" outputWidth={1590} outputHeight={1000} initialFile={new File(['id'], 'id.png', { type: 'image/png' })} onApply={vi.fn()} onCancel={vi.fn()} />)
    await waitFor(() => expect(screen.getByRole('button', { name: 'Apply photo' })).toBeEnabled())
    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 1590, 1000)
    expect(context.drawImage).toHaveBeenLastCalledWith(expect.anything(), 45, 0, 1500, 1000)
  })

  it('creates a wide crop using the requested banner dimensions', async () => {
    const user = userEvent.setup()
    const onApply = vi.fn()
    render(
      <AvatarCropDialog
        actionVerb="Save"
        assetLabel="shop banner"
        cropShape="rectangle"
        onApply={onApply}
        onCancel={vi.fn()}
        open
        outputHeight={600}
        outputNameSuffix="shop-banner"
        outputWidth={1500}
      />,
    )

    await user.upload(screen.getByLabelText('Choose shop banner'), new File(['source'], 'cover.png', { type: 'image/png' }))
    const applyButton = await screen.findByRole('button', { name: 'Save shop banner' })
    await waitFor(() => expect(applyButton).toBeEnabled())
    const canvas = screen.getByRole('img', { name: 'Shop banner crop area' }) as HTMLCanvasElement
    expect(canvas.width).toBe(1500)
    expect(canvas.height).toBe(600)

    fireEvent.click(applyButton)

    await waitFor(() => expect(onApply).toHaveBeenCalledOnce())
    expect(onApply.mock.calls[0]?.[0].name).toBe('cover-shop-banner.jpg')
  })
})
