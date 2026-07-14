'use client'

import { useEffect, useState } from 'react'

// Progressive AI wait indicator. Steps advance on a timer tuned to the
// real ~60-90s generation time so the user always sees movement.
export default function AIProgress({ steps }: { steps: string[] }) {
  const [current, setCurrent] = useState(0)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const tick = setInterval(() => setElapsed(e => e + 1), 1000)
    return () => clearInterval(tick)
  }, [])

  useEffect(() => {
    // Spread the steps over ~75s, but never mark the last one done.
    const stepDuration = 75 / steps.length
    const idx = Math.min(Math.floor(elapsed / stepDuration), steps.length - 1)
    setCurrent(idx)
  }, [elapsed, steps.length])

  const pct = Math.min((elapsed / 90) * 100, 96)

  return (
    <div className="max-w-md mx-auto text-left">
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-5">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-1000" style={{ width: `${pct}%` }} />
      </div>
      <ul className="space-y-2.5">
        {steps.map((step, i) => (
          <li key={step} className="flex items-center gap-2.5 text-sm">
            {i < current ? (
              <span className="w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center flex-shrink-0">✓</span>
            ) : i === current ? (
              <span className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin flex-shrink-0" />
            ) : (
              <span className="w-4 h-4 rounded-full border border-neutral-200 flex-shrink-0" />
            )}
            <span className={i < current ? 'text-neutral-400 line-through' : i === current ? 'text-neutral-800 font-medium' : 'text-neutral-300'}>
              {step}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
