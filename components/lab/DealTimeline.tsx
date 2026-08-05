'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Deal, DealRound } from '@/lib/types'
import { hasCapture } from '@/lib/deal-rounds'

// The story of the deal, in one thread: created, context, briefing, call.
// The current app has this information but never assembles it — you have to
// walk five tabs to reconstruct what happened and when.

type Entry = {
  at: string
  icon: string
  tint: string
  title: string
  detail?: string
  href?: string
  hrefLabel?: string
}

function fmt(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1)
  if (sameDay) return { day: "Aujourd'hui", time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  if (d.toDateString() === yesterday.toDateString()) return { day: 'Hier', time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) }
  return {
    day: d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' }),
    time: d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
  }
}

function buildEntries(deal: Deal, rounds: DealRound[], dealId: string): Entry[] {
  const out: Entry[] = []

  for (const r of rounds) {
    if (hasCapture(r)) {
      const notes = (r.capture_notes ?? {}) as Record<string, string>
      const speakers = ((r as unknown as { capture_speakers?: { name: string; side: string }[] }).capture_speakers ?? [])
        .filter(s => s.side !== 'seller').map(s => s.name)
      out.push({
        at: r.updated_at ?? r.created_at,
        icon: '🎧', tint: 'bg-violet-100 text-violet-600',
        title: `Conversation du round ${r.round}${speakers.length ? ` · ${speakers.join(', ')}` : ''}`,
        detail: `${Object.values(notes).filter(v => typeof v === 'string' && v.trim()).length} réponses capturées`,
        href: `/deals/${dealId}/capture`, hrefLabel: 'Voir la capture',
      })
    }
    if (r.briefing_line) {
      out.push({
        at: r.created_at,
        icon: '✦', tint: 'bg-emerald-100 text-emerald-600',
        title: `Briefing du round ${r.round} généré`,
        href: `/deals/${dealId}/briefing`, hrefLabel: 'Voir le briefing',
      })
    }
  }

  const dims = deal.prospect_dimensions
  const filled = dims && '_dynamic' in dims
    ? (dims.dimensions ?? []).reduce((n, d) => n + d.fields.filter(f => (f.value ?? '').trim()).length, 0)
    : 0
  if (filled > 0) {
    out.push({
      at: deal.created_at,
      icon: '◫', tint: 'bg-blue-100 text-blue-600',
      title: 'Contexte prospect enrichi',
      detail: `${filled} éléments extraits`,
      href: `/deals/${dealId}/context`, hrefLabel: 'Voir le contexte',
    })
  }

  out.push({
    at: deal.created_at,
    icon: '◐', tint: 'bg-neutral-100 text-neutral-500',
    title: 'Deal créé',
  })

  return out.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''))
}

export default function DealTimeline({ deal, rounds, dealId }: { deal: Deal; rounds: DealRound[]; dealId: string }) {
  const [showAll, setShowAll] = useState(false)
  const [query, setQuery] = useState('')

  const all = buildEntries(deal, rounds, dealId)
  const filtered = query.trim()
    ? all.filter(e => `${e.title} ${e.detail ?? ''}`.toLowerCase().includes(query.toLowerCase()))
    : all
  const shown = showAll || query.trim() ? filtered : filtered.slice(0, 4)

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide">Historique &amp; conversation</div>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher dans l’historique…"
          className="text-sm bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-1.5 w-56 focus:outline-none focus:border-neutral-400"
        />
      </div>

      {shown.length === 0 && <p className="text-sm text-neutral-400">Rien à afficher.</p>}

      <ul className="space-y-4">
        {shown.map((e, i) => {
          const d = fmt(e.at)
          return (
            <li key={i} className="flex gap-3">
              <div className="flex flex-col items-center flex-shrink-0">
                <span className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${e.tint}`}>{e.icon}</span>
                {i < shown.length - 1 && <span className="w-px flex-1 bg-neutral-100 mt-1" />}
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-medium text-neutral-500">{d.day}</span>
                  <span className="text-xs text-neutral-300">{d.time}</span>
                </div>
                <div className="text-sm font-semibold text-neutral-800 mt-0.5">{e.title}</div>
                {e.detail && <div className="text-xs text-neutral-500 mt-0.5">{e.detail}</div>}
                {e.href && (
                  <Link href={e.href} className="inline-block text-xs font-medium text-blue-500 hover:text-blue-600 mt-1.5">
                    {e.hrefLabel} →
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {!query.trim() && filtered.length > 4 && (
        <button onClick={() => setShowAll(v => !v)} className="w-full text-center text-xs font-medium text-neutral-500 hover:text-neutral-700 mt-4 pt-3 border-t border-neutral-100">
          {showAll ? 'Réduire' : `Afficher tout l’historique (${filtered.length})`}
        </button>
      )}
    </div>
  )
}
