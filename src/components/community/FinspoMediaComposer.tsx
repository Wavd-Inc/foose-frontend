import { ImageReorderHandle } from '../ui/ImageReorderHandle'
import { useId, useRef, useState, type ChangeEvent } from 'react'
import { Icon } from '../icons/Icon'

const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024

export type FinspoComposerMedia = {
  file?: File
  id: string
  kind: 'existing' | 'new'
  url: string
}

type FinspoMediaComposerProps = {
  items: FinspoComposerMedia[]
  onChange: (items: FinspoComposerMedia[]) => void
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item) next.splice(to, 0, item)
  return next
}

export function FinspoMediaComposer({ items, onChange }: FinspoMediaComposerProps) {
  const reorderGroup = useId()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [activeId, setActiveId] = useState(items[0]?.id || '')
  const [errors, setErrors] = useState<string[]>([])
  const [ratios, setRatios] = useState<Record<string, number>>({})
  const resolvedActiveId = items.some((item) => item.id === activeId) ? activeId : items[0]?.id || ''
  const activeItem = items.find((item) => item.id === resolvedActiveId)
  const remaining = Math.max(8 - items.length, 0)

  function addFiles(event: ChangeEvent<HTMLInputElement>) {
    const incoming = Array.from(event.target.files || [])
    const nextErrors: string[] = []
    const accepted: FinspoComposerMedia[] = []

    incoming.slice(0, remaining).forEach((file, index) => {
      if (!ACCEPTED_TYPES.has(file.type)) {
        nextErrors.push(`${file.name} must be a JPEG, PNG, or WebP image.`)
        return
      }
      if (file.size > MAX_BYTES) {
        nextErrors.push(`${file.name} is larger than 5 MB.`)
        return
      }
      accepted.push({
        file,
        id: `new-${file.name}-${file.lastModified}-${file.size}-${Date.now()}-${index}`,
        kind: 'new',
        url: URL.createObjectURL(file),
      })
    })
    if (incoming.length > remaining) nextErrors.push(`Only ${remaining} more image${remaining === 1 ? '' : 's'} can be added.`)
    const next = [...items, ...accepted]
    onChange(next)
    if (!resolvedActiveId && accepted[0]) setActiveId(accepted[0].id)
    setErrors(nextErrors)
    event.target.value = ''
  }

  function removeItem(id: string) {
    const item = items.find((candidate) => candidate.id === id)
    if (item?.kind === 'new') URL.revokeObjectURL(item.url)
    onChange(items.filter((candidate) => candidate.id !== id))
    setErrors([])
  }

  function reorder(index: number, nextIndex: number) {
    onChange(moveItem(items, index, nextIndex))
  }

  return (
    <div className="space-y-4">
      <input accept="image/jpeg,image/png,image/webp" className="sr-only" multiple onChange={addFiles} ref={inputRef} type="file" />
      {activeItem ? (
        <div className="max-h-[58dvh] overflow-hidden rounded-2xl border border-foose-border bg-foose-surface-mid" style={{ aspectRatio: ratios[resolvedActiveId] || 4 / 5 }}>
          <img
            alt="Selected Finspo preview"
            className="h-full w-full object-contain"
            onLoad={(event) => {
              const image = event.currentTarget
              const ratio = image.naturalWidth / image.naturalHeight
              if (Number.isFinite(ratio) && ratio > 0) {
                setRatios((current) => current[resolvedActiveId] === ratio ? current : { ...current, [resolvedActiveId]: ratio })
              }
            }}
            src={activeItem.url}
          />
        </div>
      ) : (
        <button className="flex min-h-72 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-foose-border bg-foose-surface-low px-5 text-center transition hover:border-accent hover:bg-accent-light/30" onClick={() => inputRef.current?.click()} type="button">
          <span aria-hidden className="mb-3 grid size-12 place-items-center rounded-full bg-accent-light text-accent"><Icon name="upload" size={24} /></span>
          <strong>Choose photos</strong>
          <span className="mt-1 text-sm text-foose-muted">Select up to 8 JPEG, PNG, or WebP images.</span>
        </button>
      )}

      {!!items.length && (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-8" aria-label="Selected Finspo images">
          {items.map((item, index) => (
            <article data-image-reorder-group={reorderGroup} data-image-reorder-index={index} className={`relative data-[image-drop-target]:ring-2 data-[image-drop-target]:ring-accent overflow-hidden rounded-xl border-2 bg-foose-surface-mid ${activeItem?.id === item.id ? 'border-accent' : 'border-transparent'}`} key={item.id}>
              <button aria-label={`Preview image ${index + 1}`} className="block aspect-square w-full" onClick={() => setActiveId(item.id)} type="button">
                <img alt="" className="h-full w-full object-cover" src={item.url} />
              </button>
              <span className="absolute left-1 top-1 grid size-6 place-items-center rounded-full bg-black/70 text-[10px] font-black text-white">{index + 1}</span>
              <button aria-label={`Remove image ${index + 1}`} className="absolute right-1 top-1 grid size-7 place-items-center rounded-full bg-black/70 text-white hover:bg-foose-danger" onClick={() => removeItem(item.id)} type="button"><Icon name="close" size={14} /></button>
              {items.length > 1 && <ImageReorderHandle src={item.url} group={reorderGroup} index={index} count={items.length} onMove={reorder} />}
            </article>
          ))}
        </div>
      )}

      {items.length > 1 && <p className="text-xs text-foose-muted">Drag to reorder.</p>}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-semibold text-foose-muted">{items.length}/8 images selected · 5 MB maximum each</p>
        {remaining > 0 && <button className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-foose-border bg-foose-surface px-4 text-sm font-bold text-foose-text transition hover:border-accent hover:text-accent" onClick={() => inputRef.current?.click()} type="button"><Icon name="plus" size={17} /> Add photos</button>}
      </div>
      {!!errors.length && <div className="rounded-xl border border-foose-danger/30 bg-foose-danger-bg/35 px-4 py-3 text-sm font-semibold text-foose-danger" role="alert">{errors.map((error) => <p key={error}>{error}</p>)}</div>}
    </div>
  )
}
