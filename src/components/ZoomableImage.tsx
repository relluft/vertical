import { X } from 'lucide-react'
import { useCallback, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ImgHTMLAttributes, MouseEvent, PointerEvent } from 'react'

interface ZoomableImageProps
  extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'alt' | 'onClick' | 'onMouseEnter' | 'onMouseLeave' | 'onMouseMove' | 'src'> {
  alt: string
  src: string
}

interface ImageZoomState {
  height: number
  left: number
  pinned: boolean
  top: number
  width: number
}

const zoomScale = 4
const viewportInset = 12
const cursorOffset = 14

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

type ZoomImageEvent = MouseEvent<HTMLImageElement> | PointerEvent<HTMLImageElement>

function getZoomState(event: ZoomImageEvent, image: HTMLImageElement, pinned: boolean): ImageZoomState {
  const rect = image.getBoundingClientRect()
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const desiredWidth = Math.max(1, rect.width * zoomScale)
  const desiredHeight = Math.max(1, rect.height * zoomScale)
  const maxWidth = Math.max(1, viewportWidth - viewportInset * 2)
  const maxHeight = Math.max(1, viewportHeight - viewportInset * 2)
  const fitScale = Math.min(1, maxWidth / desiredWidth, maxHeight / desiredHeight)
  const width = Math.round(desiredWidth * fitScale)
  const height = Math.round(desiredHeight * fitScale)
  const rightSideLeft = event.clientX + cursorOffset
  const leftSideLeft = event.clientX - width - cursorOffset
  const bottomSideTop = event.clientY + cursorOffset
  const topSideTop = event.clientY - height - cursorOffset
  const left = rightSideLeft + width <= viewportWidth - viewportInset ? rightSideLeft : leftSideLeft
  const top = bottomSideTop + height <= viewportHeight - viewportInset ? bottomSideTop : topSideTop

  return {
    height,
    left: clamp(left, viewportInset, viewportWidth - width - viewportInset),
    pinned,
    top: clamp(top, viewportInset, viewportHeight - height - viewportInset),
    width,
  }
}

export function ZoomableImage({ alt, className, src, ...imageProps }: ZoomableImageProps) {
  const imageRef = useRef<HTMLImageElement | null>(null)
  const [zoom, setZoom] = useState<ImageZoomState | null>(null)

  const closeZoom = useCallback(() => {
    setZoom(null)
  }, [])

  const openZoom = useCallback((event: ZoomImageEvent, pinned: boolean) => {
    if (!imageRef.current || typeof window === 'undefined') {
      return
    }

    setZoom(getZoomState(event, imageRef.current, pinned))
  }, [])

  const zoomNode =
    zoom && typeof document !== 'undefined'
      ? createPortal(
          <>
            {zoom.pinned ? <div className="image-zoom-backdrop" onClick={closeZoom} /> : null}
            <div
              className={`image-zoom-popover ${zoom.pinned ? 'is-pinned' : ''}`.trim()}
              style={
                {
                  '--image-zoom-height': `${zoom.height}px`,
                  '--image-zoom-left': `${zoom.left}px`,
                  '--image-zoom-top': `${zoom.top}px`,
                  '--image-zoom-width': `${zoom.width}px`,
                } as CSSProperties
              }
              role={zoom.pinned ? 'dialog' : 'presentation'}
              aria-modal={zoom.pinned ? true : undefined}
              onClick={(event) => event.stopPropagation()}
            >
              <img src={src} alt={alt} draggable={false} />
              {zoom.pinned ? (
                <button type="button" className="image-zoom-close" aria-label="Закрыть изображение" onClick={closeZoom}>
                  <X size={16} />
                </button>
              ) : null}
            </div>
          </>,
          document.body,
        )
      : null

  return (
    <>
      <img
        {...imageProps}
        ref={imageRef}
        className={[className, 'zoomable-image-trigger'].filter(Boolean).join(' ')}
        src={src}
        alt={alt}
        onPointerEnter={(event) => openZoom(event, false)}
        onPointerMove={(event) => {
          if (zoom && !zoom.pinned) {
            openZoom(event, false)
          }
        }}
        onPointerLeave={() => {
          setZoom((current) => (current?.pinned ? current : null))
        }}
        onClick={(event) => {
          event.stopPropagation()
          openZoom(event, true)
        }}
      />
      {zoomNode}
    </>
  )
}
