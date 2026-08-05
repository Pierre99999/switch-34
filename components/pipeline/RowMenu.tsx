'use client'

import { useLayoutEffect, useRef, useState } from 'react'

// The "···" menu on a pipeline row.
//
// It positions itself with `fixed` rather than `absolute` because the table it
// lives in scrolls horizontally, and an element that scrolls on one axis clips
// on both: an absolutely-positioned menu on the first row was cut off at the
// top of the container, leaving only its last item visible. `fixed` escapes
// the clipping entirely, so the menu is placed from the button's screen
// position and flipped upward only when there is no room below.

export type RowMenuItem = { label: string; onClick: () => void }

const WIDTH = 190

export default function RowMenu({
  open, onToggle, onClose, items,
}: {
  open: boolean
  onToggle: () => void
  onClose: () => void
  items: RowMenuItem[]
}) {
  const btn = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)

  useLayoutEffect(() => {
    if (!open || !btn.current) { setPos(null); return }
    const place = () => {
      const r = btn.current?.getBoundingClientRect()
      if (!r) return
      const height = items.length * 42 + 8
      const below = window.innerHeight - r.bottom
      setPos({
        top: below > height + 8 ? r.bottom + 4 : Math.max(8, r.top - height - 4),
        left: Math.max(8, Math.min(r.right - WIDTH, window.innerWidth - WIDTH - 8)),
      })
    }
    place()
    // Scrolling or resizing while it is open would leave it behind.
    window.addEventListener('scroll', onClose, true)
    window.addEventListener('resize', onClose)
    return () => {
      window.removeEventListener('scroll', onClose, true)
      window.removeEventListener('resize', onClose)
    }
  }, [open, items.length, onClose])

  return (
    <>
      <button
        ref={btn}
        onClick={onToggle}
        aria-label="Actions"
        className="text-neutral-300 hover:text-neutral-500 transition-colors text-lg leading-none px-1"
      >
        ···
      </button>
      {open && pos && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            className="fixed bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-50"
            style={{ top: pos.top, left: pos.left, width: WIDTH }}
          >
            {items.map(item => (
              <button
                key={item.label}
                onClick={() => { onClose(); item.onClick() }}
                className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
    </>
  )
}
