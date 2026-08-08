import type { ReactNode } from 'react'

// The label that opens a section: a small drawn icon in a tinted disc, the
// section's name in the product's blue, and — when there is one — a grey note
// after it.
//
// One component, because the deal screen and Mission Control both open their
// sections this way and two copies of a header diverge in six months. The
// glyphs are drawn, never typed: a character like ◈ carries its own weight and
// renders differently on every machine (see LabSidebar).

export type SectionIcon = 'hypothesis' | 'ask' | 'todo' | 'map'

const ICONS: Record<SectionIcon, ReactNode> = {
  // The diamond of the round's hypothesis — the shape the deal screen has
  // always used for it.
  hypothesis: (
    <>
      <path d="M12 3l9 9-9 9-9-9z" />
      <path d="M12 8.6l3.4 3.4-3.4 3.4-3.4-3.4z" fill="currentColor" stroke="none" />
    </>
  ),
  // A question asked of the portfolio.
  ask: (
    <>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.5 8.5 0 0 1 8 8z" />
    </>
  ),
  // What is to be done, ticked off.
  todo: (
    <>
      <path d="M9 11.5l2.6 2.6L21 4.7" />
      <path d="M20.5 12v7a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h10" />
    </>
  ),
  // The portfolio map itself: two axes and the deals sitting on them.
  map: (
    <>
      <path d="M4 4v16h16" />
      <circle cx="9.5" cy="15" r="1.6" fill="currentColor" stroke="none" />
      <circle cx="14" cy="9.5" r="2.2" fill="currentColor" stroke="none" />
      <circle cx="18.5" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
}

export default function SectionLabel({
  icon, label, note,
}: {
  icon: SectionIcon
  label: string
  note?: string | null
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center flex-shrink-0">
        <svg
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
          strokeLinecap="round" strokeLinejoin="round" aria-hidden
          className="w-[15px] h-[15px]"
        >
          {ICONS[icon]}
        </svg>
      </span>
      <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-[0.08em]">{label}</span>
      {note && <span className="text-[11px] text-neutral-300">{note}</span>}
    </div>
  )
}
