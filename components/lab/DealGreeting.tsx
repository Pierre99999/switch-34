'use client'

import { useEffect, useState } from 'react'
import { dealGreeting, type GreetingInput } from '@/lib/deal-greeting'

// Switch says one thing when you open a deal. It appears once per state of the
// deal, not once per visit — a message you have already read and acted on is
// noise the third time, and a product that pops the same box every morning is
// a product you learn to click through without reading.

const TONE = {
  good: { ring: 'ring-emerald-200', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-600', icon: '✓' },
  neutral: { ring: 'ring-blue-200', dot: 'bg-blue-500', chip: 'bg-blue-50 text-blue-600', icon: '→' },
  warn: { ring: 'ring-amber-200', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-600', icon: '!' },
}

const seenKey = (dealId: string) => `switch.greeting.${dealId}`

export default function DealGreeting({ dealId, input }: { dealId: string; input: GreetingInput }) {
  const greeting = dealGreeting(input)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // localStorage rather than the database: this is a reading state, personal
    // to the browser, and losing it costs one extra box.
    let seen: string | null = null
    try { seen = window.localStorage.getItem(seenKey(dealId)) } catch { /* private mode */ }
    if (seen !== greeting.signature) setOpen(true)
  }, [dealId, greeting.signature])

  function close() {
    try { window.localStorage.setItem(seenKey(dealId), greeting.signature) } catch { /* private mode */ }
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!open) return null
  const tone = TONE[greeting.tone]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/20 backdrop-blur-[2px]" onClick={close} />
      <div className={`relative bg-white rounded-3xl shadow-xl ring-1 ${tone.ring} max-w-md w-full p-7`}>
        <div className="flex items-center gap-2.5 mb-4">
          <span className={`w-7 h-7 rounded-full text-white text-sm flex items-center justify-center ${tone.dot}`}>{tone.icon}</span>
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-400">Switch</span>
        </div>

        <h2 className="text-xl font-bold text-neutral-900 leading-snug">{greeting.headline}</h2>
        <p className="text-sm text-neutral-500 leading-relaxed mt-2.5">{greeting.body}</p>

        {greeting.action && (
          <div className={`mt-5 rounded-xl px-3.5 py-2.5 text-sm font-medium ${tone.chip}`}>
            {greeting.action}
          </div>
        )}

        <button
          onClick={close}
          className="mt-6 w-full bg-neutral-900 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-neutral-800 transition-colors"
        >
          Au travail
        </button>
      </div>
    </div>
  )
}
