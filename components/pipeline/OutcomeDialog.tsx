'use client'

import { useState } from 'react'
import { reasonsFor, todayISO, type CloseReasonKey, type DealOutcome } from '@/lib/deal-outcome'

// Three fields, asked once, at the only moment they can be answered honestly.
// Deliberately not skippable: a closed deal with no reason is a deal that
// teaches nothing, and this is the one thing that cannot be reconstructed
// afterwards. The note stays optional — the reason is what makes a corpus.

export default function OutcomeDialog({
  prospectName, status, currentRound, onCancel, onConfirm,
}: {
  prospectName: string
  status: 'won' | 'lost'
  currentRound: number
  onCancel: () => void
  onConfirm: (outcome: DealOutcome) => void
}) {
  const [reason, setReason] = useState<CloseReasonKey | null>(null)
  const [round, setRound] = useState(Math.max(currentRound, 1))
  const [closedAt, setClosedAt] = useState(todayISO())
  const [note, setNote] = useState('')

  const won = status === 'won'
  // Written out rather than interpolated: Tailwind only keeps class names it
  // can see literally in the source.
  const chip = won ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
  const picked = won
    ? 'border-emerald-300 bg-emerald-50 text-neutral-900 font-medium'
    : 'border-rose-300 bg-rose-50 text-neutral-900 font-medium'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-neutral-900/25 backdrop-blur-[2px]" onClick={onCancel} />
      <div className="relative bg-white rounded-3xl shadow-xl max-w-lg w-full p-7 max-h-[90vh] overflow-y-auto">
        <div className={`inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] px-2.5 py-1 rounded-full ${chip}`}>
          {won ? 'Deal gagné' : 'Deal perdu'}
        </div>
        <h2 className="text-xl font-bold text-neutral-900 mt-3">{prospectName}</h2>
        <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
          {won
            ? 'Qu’est-ce qui a emporté la décision ? C’est la seule chose qu’on ne pourra pas retrouver plus tard.'
            : 'Qu’est-ce qui a cédé ? C’est la seule chose qu’on ne pourra pas retrouver plus tard.'}
        </p>

        <div className="mt-5 space-y-1.5">
          {reasonsFor(status).map(r => (
            <button
              key={r.key}
              onClick={() => setReason(r.key)}
              className={`w-full text-left text-sm rounded-xl px-3.5 py-2.5 border transition-colors ${
                reason === r.key ? picked : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              {r.fr}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mt-5">
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Round</span>
            <input
              type="number" min={1} value={round}
              onChange={e => setRound(Math.max(1, Number(e.target.value) || 1))}
              className="mt-1 w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">Date</span>
            <input
              type="date" value={closedAt}
              onChange={e => setClosedAt(e.target.value)}
              className="mt-1 w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
            />
          </label>
        </div>

        <label className="block mt-4">
          <span className="text-[11px] font-medium uppercase tracking-wide text-neutral-400">En une phrase (optionnel)</span>
          <textarea
            value={note} onChange={e => setNote(e.target.value)} rows={2}
            placeholder="Ce que vous retiendrez de ce deal dans six mois."
            className="mt-1 w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm resize-none focus:outline-none focus:border-neutral-400"
          />
        </label>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="flex-1 text-sm font-medium text-neutral-500 rounded-xl py-2.5 hover:bg-neutral-50 transition-colors">
            Annuler
          </button>
          <button
            disabled={!reason}
            onClick={() => reason && onConfirm({ reason, round, closed_at: closedAt, note: note || null })}
            className="flex-1 bg-neutral-900 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-neutral-800 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
          >
            {won ? 'Enregistrer la victoire' : 'Enregistrer la perte'}
          </button>
        </div>
      </div>
    </div>
  )
}
