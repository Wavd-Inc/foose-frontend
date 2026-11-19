import { ImageReorderHandle } from './ImageReorderHandle'
import { useEffect, useId, useMemo, useRef, useState, type CSSProperties, type DragEvent } from 'react'
import { FormField } from '../forms/FormField'
import { fieldDescriptionIds } from '../forms/formUtils'
import { Icon } from '../icons/Icon'
import { LightboxImage } from './LightboxImage'

const DEFAULT_MAX_BYTES = 5 * 1024 * 1024

type PreviewFile = {
  file: File
  id: string
  name: string
  url: string
}

export type ImagePreviewInputProps = {
  accept?: string
  aspect?: 'square' | 'wide' | 'original' | string
  error?: string
  existingImages?: string[]
  hint?: string
  id?: string
  keptName?: string
  keptTouchedName?: string
  label?: string
  maxBytes?: number
  maxFiles?: number
  multiple?: boolean
  name: string
  onFilesChange?: (files: File[]) => void
  presentation?: 'dropzone' | 'strip' | 'preview'
  required?: boolean
}

function fileId(file: File, index: number) {
  return `${file.name}-${file.lastModified}-${file.size}-${Date.now()}-${index}`
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(bytes % (1024 * 1024) === 0 ? 0 : 1)} MB`
}

function acceptsFile(file: File, accept: string) {
  const rules = accept.split(',').map((rule) => rule.trim().toLowerCase()).filter(Boolean)
  if (!rules.length) return true
  const fileName = file.name.toLowerCase()
  const mime = file.type.toLowerCase()
  return rules.some((rule) => {
    if (rule.startsWith('.')) return fileName.endsWith(rule)
    if (rule.endsWith('/*')) return mime.startsWith(rule.slice(0, -1))
    return mime === rule
  })
}

function moveItem<T>(items: T[], from: number, to: number) {
  const next = [...items]
  const [item] = next.splice(from, 1)
  if (item !== undefined) next.splice(to, 0, item)
  return next
}

export function ImagePreviewInput({
  accept = 'image/*',
  aspect = 'square',
  error,
  existingImages = [],
  hint,
  id,
  keptName,
  keptTouchedName,
  label,
  maxBytes = DEFAULT_MAX_BYTES,
  maxFiles,
  multiple = false,
  name,
  onFilesChange,
  presentation = 'dropzone',
  required = false,
}: ImagePreviewInputProps) {
  const generatedId = useId()
  const inputId = id || `upload-${generatedId}`
  const existingImagesKey = existingImages.join('\n')
  const [files, setFiles] = useState<PreviewFile[]>([])
  const [keptImages, setKeptImages] = useState(() => (existingImagesKey ? existingImagesKey.split('\n') : []))
  const [localErrors, setLocalErrors] = useState<string[]>([])
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const filesRef = useRef<PreviewFile[]>([])
  const dragDepthRef = useRef(0)
  const hasExistingImages = Boolean(existingImagesKey)
  const visibleFiles = useMemo(() => (maxFiles ? files.slice(0, maxFiles) : files), [files, maxFiles])
  const effectiveLimit = maxFiles ?? (multiple ? Number.POSITIVE_INFINITY : 1)
  const remainingSlots = Math.max(effectiveLimit - keptImages.length - visibleFiles.length, 0)
  const describedBy = [fieldDescriptionIds(inputId, hint, error), localErrors.length ? `${inputId}-upload-errors` : ''].filter(Boolean).join(' ') || undefined
  const previewItems = useMemo(
    () => [
      ...keptImages.map((image, index) => ({ alt: `Current upload ${index + 1}`, src: image })),
      ...visibleFiles.map((file, index) => ({ alt: file.name || `Selected upload ${index + 1}`, src: file.url })),
    ],
    [keptImages, visibleFiles],
  )
  const aspectStyle: CSSProperties | undefined = !['square', 'wide', 'original'].includes(aspect)
    ? { aspectRatio: aspect }
    : undefined
  const aspectClass = aspect === 'original' ? '' : aspect === 'wide' ? 'aspect-[16/9]' : aspect === 'square' ? 'aspect-square' : 'aspect-square'
  const stripPresentation = presentation === 'strip'
  // Opt-in only: callers using this must read files via `onFilesChange` state, not native
  // form-collected `input.files` — once an image is chosen, the file input unmounts.
  const previewPresentation = presentation === 'preview'
  const hasAnyImage = keptImages.length > 0 || visibleFiles.length > 0
  const showCompactPreview = previewPresentation && hasAnyImage

  function syncInputFiles(nextFiles: PreviewFile[]) {
    const input = inputRef.current
    if (!input || typeof DataTransfer === 'undefined') return
    const transfer = new DataTransfer()
    nextFiles.forEach((item) => transfer.items.add(item.file))
    input.files = transfer.files
  }

  function publishFiles(nextFiles: PreviewFile[]) {
    syncInputFiles(nextFiles)
    onFilesChange?.(nextFiles.map((item) => item.file))
    return nextFiles
  }

  useEffect(() => {
    const nextExistingImages = existingImagesKey ? existingImagesKey.split('\n') : []
    const timer = window.setTimeout(() => setKeptImages(nextExistingImages), 0)
    return () => window.clearTimeout(timer)
  }, [existingImagesKey])

  useEffect(() => {
    filesRef.current = files
  }, [files])

  useEffect(() => () => {
    filesRef.current.forEach((file) => URL.revokeObjectURL(file.url))
  }, [])

  function addFiles(fileList: FileList | File[] | null) {
    const incoming = Array.from(fileList || [])
    const errors: string[] = []
    const acceptedFiles = incoming.filter((file) => {
      if (!acceptsFile(file, accept)) {
        errors.push(`${file.name} is not an accepted image type.`)
        return false
      }
      if (maxBytes > 0 && file.size > maxBytes) {
        errors.push(`${file.name} is larger than ${formatBytes(maxBytes)}.`)
        return false
      }
      return true
    })

    const available = Math.max(effectiveLimit - keptImages.length - files.length, 0)
    if (acceptedFiles.length > available) {
      errors.push(`You can add ${available || 'no'} more image${available === 1 ? '' : 's'}.`)
    }
    const selected = acceptedFiles.slice(0, available).map((file, index) => ({
      file,
      id: fileId(file, index),
      name: file.name,
      url: URL.createObjectURL(file),
    }))
    setLocalErrors(Array.from(new Set(errors)))
    if (!selected.length) return

    const nextFiles = [...filesRef.current, ...selected].slice(0, Math.max(effectiveLimit - keptImages.length, 0))
    filesRef.current = nextFiles
    setFiles(nextFiles)
    publishFiles(nextFiles)
  }

  function removeSelectedFile(idToRemove: string) {
    const nextFiles = filesRef.current.filter((file) => {
      if (file.id !== idToRemove) return true
      URL.revokeObjectURL(file.url)
      return false
    })
    filesRef.current = nextFiles
    setFiles(nextFiles)
    setLocalErrors([])
    publishFiles(nextFiles)
  }

  function reorderSelected(from: number, to: number) {
    const nextFiles = moveItem(filesRef.current, from, to)
    filesRef.current = nextFiles
    setFiles(nextFiles)
    publishFiles(nextFiles)
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    dragDepthRef.current = 0
    setDragging(false)
    addFiles(event.dataTransfer.files)
  }

  const uploader = (
    <>
      {stripPresentation && (
        <div
          className="grid w-full grid-cols-6 gap-1.5 sm:gap-2.5"
          data-testid="image-preview-strip"
          onDragEnter={(event) => {
            event.preventDefault()
            dragDepthRef.current += 1
            setDragging(true)
          }}
          onDragLeave={(event) => {
            event.preventDefault()
            dragDepthRef.current -= 1
            if (dragDepthRef.current <= 0) setDragging(false)
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={drop}
        >
          <input
            accept={accept}
            aria-describedby={describedBy}
            aria-invalid={Boolean(error || localErrors.length) || undefined}
            className="sr-only"
            id={inputId}
            multiple={multiple}
            name={name}
            onChange={(event) => addFiles(event.target.files)}
            ref={inputRef}
            required={required && !keptImages.length && !visibleFiles.length}
            type="file"
          />
          {keptImages.map((image, index) => (
            <div data-image-reorder-group={`${inputId}-current`} data-image-reorder-index={index} className="data-[image-drop-target]:ring-2 data-[image-drop-target]:ring-accent group relative aspect-square min-w-0 overflow-hidden rounded-lg border border-foose-border bg-foose-surface-mid sm:rounded-xl" key={`${image}-${index}`}>
              {keptImages.length > 1 && <ImageReorderHandle src={image} group={`${inputId}-current`} index={index} count={keptImages.length} onMove={(from, to) => setKeptImages((images) => moveItem(images, from, to))} />}
              <LightboxImage alt={`Current upload ${index + 1}`} className="h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover" index={index} items={previewItems} src={image} />
              <button
                aria-label={`Remove current upload ${index + 1}`}
                className="absolute right-0.5 top-0.5 grid size-7 place-items-center rounded-full bg-black/65 text-white shadow-sm transition hover:bg-foose-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:right-1 sm:top-1 sm:size-8"
                onClick={() => {
                  setKeptImages((images) => images.filter((_, imageIndex) => imageIndex !== index))
                  setLocalErrors([])
                }}
                type="button"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {visibleFiles.map((file, index) => (
            <div data-image-reorder-group={`${inputId}-selected`} data-image-reorder-index={index} className="data-[image-drop-target]:ring-2 data-[image-drop-target]:ring-accent group relative aspect-square min-w-0 overflow-hidden rounded-lg border border-foose-border bg-foose-surface-mid sm:rounded-xl" key={file.id}>
              {visibleFiles.length > 1 && <ImageReorderHandle src={file.url} group={`${inputId}-selected`} index={index} count={visibleFiles.length} onMove={reorderSelected} />}
              <LightboxImage alt={file.name || `Selected upload ${index + 1}`} className="h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover" index={keptImages.length + index} items={previewItems} src={file.url} />
              <button
                aria-label={`Remove selected upload ${index + 1}`}
                className="absolute right-0.5 top-0.5 grid size-7 place-items-center rounded-full bg-black/65 text-white shadow-sm transition hover:bg-foose-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white sm:right-1 sm:top-1 sm:size-8"
                onClick={() => removeSelectedFile(file.id)}
                type="button"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
          ))}
          {remainingSlots > 0 && (
            <button
              aria-label={`Add listing ${multiple ? 'images' : 'image'}`}
              className={`grid aspect-square min-w-0 place-items-center rounded-lg border border-dashed text-foose-muted transition hover:border-accent hover:bg-accent-light hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:rounded-xl ${dragging ? 'border-accent bg-accent-light text-accent' : 'border-foose-border bg-foose-surface-low'}`}
              onClick={() => inputRef.current?.click()}
              type="button"
            >
              <Icon name="plus" size={22} />
            </button>
          )}
        </div>
      )}

      {!stripPresentation && !showCompactPreview && <div
        className={`relative flex min-h-36 flex-col items-center justify-center rounded-2xl border-2 border-dashed px-5 py-6 text-center transition ${dragging ? 'border-accent bg-accent-light/65 shadow-inner' : 'border-foose-border bg-foose-surface-low/60 hover:border-accent/60 hover:bg-accent-light/25'} ${remainingSlots <= 0 ? 'opacity-70' : ''}`}
        onDragEnter={(event) => {
          event.preventDefault()
          dragDepthRef.current += 1
          setDragging(true)
        }}
        onDragLeave={(event) => {
          event.preventDefault()
          dragDepthRef.current -= 1
          if (dragDepthRef.current <= 0) setDragging(false)
        }}
        onDragOver={(event) => event.preventDefault()}
        onDrop={drop}
      >
        <input
          accept={accept}
          aria-describedby={describedBy}
          aria-invalid={Boolean(error || localErrors.length) || undefined}
          className="sr-only"
          id={inputId}
          multiple={multiple}
          name={name}
          onChange={(event) => addFiles(event.target.files)}
          ref={inputRef}
          required={required && !keptImages.length && !visibleFiles.length}
          type="file"
        />
        <span aria-hidden="true" className="mb-3 grid size-11 place-items-center rounded-full bg-accent-light text-accent"><Icon name="upload" size={22} /></span>
        <p className="text-sm font-black text-foose-text">Drop {multiple ? 'images' : 'an image'} here</p>
        <p className="mt-1 text-xs leading-5 text-foose-muted">or choose from your device</p>
        <button
          className="mt-3 inline-flex min-h-11 items-center justify-center rounded-xl border border-accent bg-foose-surface px-4 py-2 text-sm font-black text-accent transition hover:bg-accent-light focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:border-foose-border disabled:text-foose-faint"
          disabled={remainingSlots <= 0}
          onClick={() => inputRef.current?.click()}
          type="button"
        >
          Choose {multiple ? 'images' : 'image'}
        </button>
        <p className="mt-3 text-xs font-semibold text-foose-faint">
          Up to {formatBytes(maxBytes)}{maxFiles ? ` · ${maxFiles} image${maxFiles === 1 ? '' : 's'} maximum` : ''}
        </p>
      </div>}

      {showCompactPreview && (
        <div className="relative z-10 mx-auto w-full max-w-[240px]">
          {keptImages.map((image, index) => (
            <div className={`group relative overflow-hidden rounded-2xl ${aspectClass}`} key={`${image}-${index}`} style={aspectStyle}>
              <LightboxImage alt={`Current upload ${index + 1}`} className={`h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${aspect === 'original' ? '[&_img]:h-auto' : ''}`} index={index} items={previewItems} src={image} />
              <button
                aria-label={`Remove current upload ${index + 1}`}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 text-white shadow-sm transition hover:bg-foose-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                onClick={() => {
                  setKeptImages((images) => images.filter((_, imageIndex) => imageIndex !== index))
                  setLocalErrors([])
                }}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
          {visibleFiles.map((file, index) => (
            <div className={`group relative overflow-hidden rounded-2xl ${aspectClass}`} key={file.id} style={aspectStyle}>
              <LightboxImage alt={file.name || `Selected upload ${index + 1}`} className={`h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${aspect === 'original' ? '[&_img]:h-auto' : ''}`} index={keptImages.length + index} items={previewItems} src={file.url} />
              <button
                aria-label={`Remove selected upload ${index + 1}`}
                className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/65 text-white shadow-sm transition hover:bg-foose-danger focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
                onClick={() => removeSelectedFile(file.id)}
                type="button"
              >
                <Icon name="close" size={16} />
              </button>
            </div>
          ))}
        </div>
      )}

      {keptName && keptImages.map((image) => <input key={image} name={keptName} type="hidden" value={image} />)}
      {keptTouchedName && hasExistingImages && <input name={keptTouchedName} type="hidden" value="1" />}

      {!stripPresentation && !previewPresentation && (keptImages.length > 0 || visibleFiles.length > 0) && (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3" data-testid="image-preview-grid">
          {keptImages.map((image, index) => (
            <article data-image-reorder-group={`${inputId}-current`} data-image-reorder-index={index} className="data-[image-drop-target]:ring-2 data-[image-drop-target]:ring-accent relative overflow-hidden rounded-xl border border-foose-border bg-foose-surface" key={`${image}-${index}`}>
              <div className={`overflow-hidden bg-foose-surface-mid ${aspectClass}`} style={aspectStyle}>
                <LightboxImage alt={`Current upload ${index + 1}`} className={`h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${aspect === 'original' ? '[&_img]:h-auto' : ''}`} index={index} items={previewItems} src={image} />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-bold text-foose-text">Current image {index + 1}</p>
                <div className="mt-2 flex justify-end gap-1">
                  {keptImages.length > 1 && <ImageReorderHandle src={image} group={`${inputId}-current`} index={index} count={keptImages.length} onMove={(from, to) => setKeptImages((images) => moveItem(images, from, to))} />}
                  <button
                    aria-label={`Remove current upload ${index + 1}`}
                    className="grid min-h-11 min-w-11 place-items-center rounded-lg text-foose-danger transition hover:bg-foose-danger-bg focus-visible:outline-2 focus-visible:outline-foose-danger"
                    onClick={() => {
                      setKeptImages((images) => images.filter((_, imageIndex) => imageIndex !== index))
                      setLocalErrors([])
                    }}
                    type="button"
                  >
                    <Icon name="trash" size={18} />
                  </button>
                </div>
              </div>
            </article>
          ))}
          {visibleFiles.map((file, index) => (
            <article data-image-reorder-group={`${inputId}-selected`} data-image-reorder-index={index} className="data-[image-drop-target]:ring-2 data-[image-drop-target]:ring-accent relative overflow-hidden rounded-xl border border-foose-border bg-foose-surface" key={file.id}>
              <div className={`overflow-hidden bg-foose-surface-mid ${aspectClass}`} style={aspectStyle}>
                <LightboxImage alt={file.name || `Selected upload ${index + 1}`} className={`h-full [&_img]:h-full [&_img]:w-full [&_img]:object-cover ${aspect === 'original' ? '[&_img]:h-auto' : ''}`} index={keptImages.length + index} items={previewItems} src={file.url} />
              </div>
              <div className="p-2">
                <p className="truncate text-xs font-bold text-foose-text" title={file.name}>{file.name}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-foose-faint">{formatBytes(file.file.size)}</p>
                <div className="mt-2 flex justify-end gap-1">
                  {visibleFiles.length > 1 && <ImageReorderHandle src={file.url} group={`${inputId}-selected`} index={index} count={visibleFiles.length} onMove={reorderSelected} />}
                  <button aria-label={`Remove selected upload ${index + 1}`} className="grid min-h-11 min-w-11 place-items-center rounded-lg text-foose-danger transition hover:bg-foose-danger-bg focus-visible:outline-2 focus-visible:outline-foose-danger" onClick={() => removeSelectedFile(file.id)} type="button"><Icon name="trash" size={18} /></button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {(keptImages.length > 1 || visibleFiles.length > 1) && <p className="mt-2 text-xs text-foose-muted">Drag to reorder.</p>}

      {localErrors.length > 0 && (
        <div className="mt-3 rounded-xl border border-foose-danger/30 bg-foose-danger-bg/35 px-4 py-3 text-sm font-semibold text-foose-danger" id={`${inputId}-upload-errors`} role="alert">
          {localErrors.map((message) => <p key={message}>{message}</p>)}
        </div>
      )}
      {maxFiles && !localErrors.length && !showCompactPreview && (
        <p className="mt-2 text-sm leading-6 text-foose-muted">
          {remainingSlots > 0 ? `${remainingSlots} image slot${remainingSlots === 1 ? '' : 's'} remaining.` : `Maximum of ${maxFiles} image${maxFiles === 1 ? '' : 's'} reached.`}
        </p>
      )}
    </>
  )

  return label ? (
    <FormField error={error} hint={hint} htmlFor={inputId} label={label} required={required}>{uploader}</FormField>
  ) : uploader
}
