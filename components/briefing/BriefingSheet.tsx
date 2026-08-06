'use client'

import { useEffect } from 'react'
import type { DealRound } from '@/lib/types'
import BriefingBody from './BriefingBody'
import { normalizeAttendees, attendeesSummary } from '@/lib/attendees'

// The briefing on its own page: one column, readable at arm's length on a
// phone during the call, and printable as it stands.
//
// Nothing here is interactive. It is a sheet of paper that happens to be a
// URL — which is what makes it work on a device that has never signed in.

export default function BriefingSheet({
  round, prospectName, autoPrint = false,
}: {
  round: DealRound
  prospectName: string
  autoPrint?: boolean
}) {
  useEffect(() => {
    if (!autoPrint) return
    // One frame for the fonts and the layout to settle, or the first page
    // prints half-styled.
    const t = setTimeout(() => window.print(), 400)
    return () => clearTimeout(t)
  }, [autoPrint])

  return (
    <div className="min-h-screen bg-neutral-50 print:bg-white">
      <div className="max-w-[38rem] mx-auto px-5 py-8 print:px-0 print:py-0 print:max-w-none">
        <header className="mb-6 pb-5 border-b border-neutral-200">
          <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em]">
            Briefing · round {round.round}
          </p>
          <h1 className="text-2xl font-bold text-neutral-900 mt-1 leading-tight">{prospectName}</h1>
          <p className="text-xs text-neutral-400 mt-1">À lire avant la conversation.</p>
          {attendeesSummary(normalizeAttendees((round as unknown as { briefing_attendees?: unknown }).briefing_attendees)) && (
            <p className="text-sm text-neutral-500 mt-2">
              Avec {attendeesSummary(normalizeAttendees((round as unknown as { briefing_attendees?: unknown }).briefing_attendees))}
            </p>
          )}
        </header>

        <BriefingBody round={round} />

        <footer className="mt-8 pt-4 border-t border-neutral-100 flex items-center justify-between gap-4">
          <span className="text-[11px] text-neutral-300">Switch</span>
          <button
            onClick={() => window.print()}
            className="print:hidden text-xs font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
          >
            Imprimer / PDF
          </button>
        </footer>
      </div>
    </div>
  )
}
