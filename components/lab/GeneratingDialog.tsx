'use client'

import { useEffect } from 'react'
import AIProgress from '@/components/ui/AIProgress'

// The wait, made visible and made to hold the screen.
//
// A disabled button labelled "En cours…" says nothing about what is happening
// and lets you wander off mid-generation; the request keeps running, and you
// come back to a briefing you did not watch being built. This is the same
// sequence the live app shows, in a box you cannot click away from — the only
// way out is the generation finishing, or failing.

export default function GeneratingDialog({
  title, steps, durationSec = 75, error, onDismiss,
}: {
  title: string
  steps: string[]
  durationSec?: number
  error?: string | null
  onDismiss: () => void
}) {
  // Leaving the tab mid-generation is the one thing worth warning about: the
  // round is written server-side, so a reload lands on a half-built state.
  useEffect(() => {
    if (error) return
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault() }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [error])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/25 backdrop-blur-[2px]" />
      <div className="relative bg-white rounded-3xl shadow-xl max-w-md w-full p-7">
        <h2 className="text-lg font-bold text-neutral-900 mb-1">{title}</h2>

        {error ? (
          <>
            <p className="text-sm text-rose-600 mt-3 leading-relaxed">{error}</p>
            <button
              onClick={onDismiss}
              className="mt-6 w-full bg-neutral-900 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-neutral-800 transition-colors"
            >
              Fermer
            </button>
          </>
        ) : (
          <>
            <p className="text-sm text-neutral-400 mb-5">Ne quittez pas cette page.</p>
            <AIProgress steps={steps} durationSec={durationSec} />
          </>
        )}
      </div>
    </div>
  )
}
