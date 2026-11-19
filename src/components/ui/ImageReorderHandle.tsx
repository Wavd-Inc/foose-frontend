import { createPortal } from 'react-dom'
import { useRef, useState } from 'react'

type ImageReorderHandleProps = {
  src: string
  group: string
  index: number
  count: number
  onMove: (from: number, to: number) => void
}

/** Pointer capture keeps dragging available on touchscreens as well as with a mouse. */
export function ImageReorderHandle({ src, group, index, count, onMove }: ImageReorderHandleProps) {
  const start = useRef<number | null>(null)
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const dragging = position !== null

  function clearTarget() {
    document.querySelectorAll('[data-image-drop-target]').forEach((element) => {
      element.removeAttribute('data-image-drop-target')
    })
  }

  function targetAt(x: number, y: number) {
    const target = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-image-reorder-group]')
    return target?.dataset.imageReorderGroup === group ? target : null
  }

  return <>
  <button
    aria-label={`Reorder image ${index + 1}`}
    aria-description="Drag to reorder, or use the arrow keys."
    className={`absolute z-10 bottom-1 left-1 grid min-h-8 min-w-8 touch-none select-none place-items-center rounded-lg bg-black/65 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${dragging ? 'cursor-grabbing' : 'cursor-grab'}`}
    onKeyDown={(event) => {
      const offset = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : 0
      if (!offset) return
      event.preventDefault()
      const next = index + offset
      if (next >= 0 && next < count) onMove(index, next)
    }}
    onPointerDown={(event) => {
      if (event.button !== 0) return
      start.current = index
      event.currentTarget.setPointerCapture(event.pointerId)
      setPosition({ x: event.clientX, y: event.clientY })
    }}
    onPointerMove={(event) => {
      if (start.current === null) return
      setPosition({ x: event.clientX, y: event.clientY })
      clearTarget()
      targetAt(event.clientX, event.clientY)?.setAttribute('data-image-drop-target', '')
    }}
    onPointerUp={(event) => {
      const from = start.current
      start.current = null
      setPosition(null)
      clearTarget()
      if (from === null) return
      const target = targetAt(event.clientX, event.clientY)
      const to = Number(target?.dataset.imageReorderIndex)
      if (target && Number.isInteger(to) && to !== from) onMove(from, to)
    }}
    onLostPointerCapture={() => { start.current = null; setPosition(null); clearTarget() }}
    onPointerCancel={() => { start.current = null; setPosition(null); clearTarget() }}
    type="button"
  ><span aria-hidden="true" className="text-lg leading-none">⠿</span></button>
  {position && createPortal(
    <div
      aria-hidden="true"
      data-testid="image-drag-preview"
      className="pointer-events-none fixed z-[10000] size-24 overflow-hidden rounded-xl border-2 border-accent bg-foose-surface shadow-xl sm:size-28"
      style={{ left: position.x + 16, top: position.y + 16 }}
    >
      <img alt="" draggable={false} className="h-full w-full object-cover" src={src} />
    </div>,
    document.body,
  )}
  </>
}
