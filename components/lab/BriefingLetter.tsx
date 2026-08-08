'use client'

import { useState } from 'react'
import type { DealRound } from '@/lib/types'
import { briefingToText } from '@/lib/briefing-letter'
import BriefingBody from '@/components/briefing/BriefingBody'
import { normalizeAttendees, attendeesSummary } from '@/lib/attendees'

// The briefing read as a letter, not filled in as a form. Same content as the
// briefing page, rendered for someone about to pick up the phone.
//
// What follows the reading is four doors onto the same thing: the text in the
// clipboard, the sheet on a phone, the sheet on paper, and a link to the sheet
// for a device that never signed in. Email was dropped — a mailto capped at
// ~1500 characters delivered a truncated briefing, which is worse than none.

export default function BriefingLetter({
  round, prospectName, onClose,
}: {
  round: DealRound
  prospectName: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // The link is minted on demand and reused afterwards: one briefing, one
  // link, so revoking it means something.
  async function shareUrl(): Promise<string> {
    const res = await fetch('/api/briefing/share', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roundId: round.id }),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Lien impossible à créer')
    return `${window.location.origin}/b/${data.token}`
  }

  async function withLink(what: string, then: (url: string) => void) {
    setBusy(what); setError(null)
    try { then(await shareUrl()) } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    }
    setBusy(null)
  }

  const secondary = 'px-4 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 disabled:opacity-40 transition-all'

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Briefing · {prospectName}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Round {round.round} — à lire avant la conversation
              {attendeesSummary(normalizeAttendees((round as unknown as { briefing_attendees?: unknown }).briefing_attendees))
                ? ` · avec ${attendeesSummary(normalizeAttendees((round as unknown as { briefing_attendees?: unknown }).briefing_attendees))}`
                : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>
        </div>

        <div className="px-6 py-6">
          <BriefingBody round={round} />
        </div>

        <div className="border-t border-neutral-100 px-6 py-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => {
                navigator.clipboard.writeText(briefingToText(round, prospectName))
                setCopied(true)
                setTimeout(() => setCopied(false), 2000)
              }}
              className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
            >
              {copied ? 'Copié !' : 'Copier le briefing'}
            </button>

            <button
              disabled={busy !== null}
              onClick={() => withLink('mobile', url => window.open(url, '_blank', 'noopener'))}
              className={secondary}
            >
              {busy === 'mobile' ? '…' : 'Ouvrir en mode mobile'}
            </button>

            <button
              disabled={busy !== null}
              onClick={() => withLink('print', url => window.open(`${url}?print=1`, '_blank', 'noopener'))}
              className={secondary}
            >
              {busy === 'print' ? '…' : 'Imprimer / PDF'}
            </button>

            <button
              disabled={busy !== null}
              onClick={() => withLink('link', url => {
                navigator.clipboard.writeText(url)
                setLinkCopied(true)
                setTimeout(() => setLinkCopied(false), 3000)
              })}
              className={secondary}
            >
              {busy === 'link' ? '…' : linkCopied ? 'Lien copié !' : 'Créer un lien privé'}
            </button>
          </div>

          <p className="text-[11px] text-neutral-400 mt-3 leading-relaxed">
            Le lien privé ouvre ce briefing seul, sans connexion — sur un téléphone, une tablette,
            n’importe quel ordinateur. Il ne donne accès ni aux scores ni aux conversations passées.
            Toute personne qui l’a peut le lire.
          </p>

          {error && <p className="text-sm text-rose-600 mt-2">{error}</p>}
        </div>
      </div>
    </div>
  )
}
