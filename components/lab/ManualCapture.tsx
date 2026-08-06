'use client'

import { useState } from 'react'
import type { DealRound, BriefingQuestion } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { scoreUpdateFromSuggestions, type ScoreSuggestion } from '@/lib/deal-rounds'
import AIProgress from '@/components/ui/AIProgress'
import SellerReadForm from '@/components/deal/SellerReadForm'
import { normalizeSellerRead, type SellerRead } from '@/lib/seller-read'

// Writing the conversation down by hand, when there is no transcript.
//
// The questions of the briefing and nothing else: the four pressing ones, the
// two opportunistic ones, and one box for everything said outside them. The
// sub-questions are not here on purpose — they exist to help the seller probe
// during the conversation, and afterwards they turn a capture screen into
// twenty fields nobody fills.
//
// Same engine as the transcript import: what is written here is scored,
// re-read and re-fitted exactly the same way. The difference is upstream and
// worth remembering — a retold conversation carries the seller's memory, a
// transcript carries the prospect's words.

export default function ManualCapture({
  dealId, round, onDone, onClose,
}: {
  dealId: string
  round: DealRound
  onDone: () => void
  onClose: () => void
}) {
  const questions = (round.briefing_questions ?? []) as BriefingQuestion[]
  const pressing = questions.filter(q => q.priority !== 'opportunistic')
  const opportunistic = questions.filter(q => q.priority === 'opportunistic')
  const existing = (round.capture_notes ?? {}) as Record<string, string>

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    for (const q of questions) init[q.text] = existing[q.text] ?? ''
    return init
  })
  const [free, setFree] = useState(existing.__free__ ?? '')
  const [sellerRead, setSellerRead] = useState<SellerRead>(
    () => normalizeSellerRead((round as unknown as { seller_read?: unknown }).seller_read) ?? {})
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const filled = Object.values(notes).some(v => v.trim()) || free.trim().length > 0

  async function save() {
    setBusy(true); setError(null)
    try {
      const supabase = createClient()
      const capture: Record<string, string> = {}
      for (const [k, v] of Object.entries(notes)) if (v.trim()) capture[k] = v.trim()
      if (free.trim()) capture.__free__ = free.trim()

      const read = normalizeSellerRead(sellerRead)
      const { error: saveErr } = await supabase
        .from('deal_rounds')
        .update({
          capture_notes: capture,
          ...(read ? { seller_read: { ...read, at: new Date().toISOString() } } : {}),
        })
        .eq('id', round.id)
      if (saveErr) throw new Error(saveErr.message)

      const scoresRes = await fetch('/api/ai/suggest-scores', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: round.id, locale: 'fr' }),
      })
      const scoreData = await scoresRes.json().catch(() => ({}))
      if (!scoresRes.ok) throw new Error(scoreData.error ?? 'La notation a échoué')

      await supabase
        .from('deal_rounds')
        .update(scoreUpdateFromSuggestions({ ...round, capture_notes: capture }, (scoreData.suggestions ?? {}) as Record<string, ScoreSuggestion>))
        .eq('id', round.id)

      await Promise.all([
        fetch('/api/ai/read', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, roundId: round.id, locale: 'fr' }),
        }).catch(() => {}),
        fetch('/api/ai/update-boxes', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, roundId: round.id, locale: 'fr' }),
        }).catch(() => {}),
        fetch('/api/ai/playbook-fit', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dealId, locale: 'fr' }),
        }).catch(() => {}),
      ])

      onDone()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Enregistrement impossible')
      setBusy(false)
    }
  }

  const field = (q: BriefingQuestion) => (
    <label key={q.text} className="block">
      <span className="text-sm font-medium text-neutral-700 leading-snug">{q.text}</span>
      <textarea
        value={notes[q.text] ?? ''}
        onChange={e => setNotes(n => ({ ...n, [q.text]: e.target.value }))}
        rows={2}
        placeholder="Ce qui a été dit — leurs mots, pas votre résumé."
        className="mt-1.5 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none placeholder:text-neutral-300"
      />
    </label>
  )

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-10 overflow-y-auto"
      role="dialog" aria-modal="true" onClick={() => !busy && onClose()}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl my-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-1">
          <h3 className="text-lg font-bold text-neutral-900">Saisir la conversation</h3>
          {!busy && <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>}
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          Round {round.round}. Laissez vide ce qui n’a pas été abordé — un blanc est une information, une réponse inventée n’en est pas une.
        </p>

        {busy ? (
          <div className="border border-neutral-200 rounded-2xl p-5">
            <AIProgress steps={['Lecture de vos notes', 'Notation des critères', 'Mise à jour du diagnostic']} durationSec={70} />
            <p className="text-xs text-neutral-400 mt-4 text-center">Restez sur cette page.</p>
          </div>
        ) : (
          <>
            {questions.length === 0 && (
              <p className="text-sm text-neutral-400 mb-4">
                Ce round n’a pas de briefing : notez ce qui a été dit dans le champ ci-dessous.
              </p>
            )}

            <div className="space-y-4">{pressing.map(field)}</div>

            {opportunistic.length > 0 && (
              <>
                <div className="flex items-center gap-3 my-5">
                  <div className="flex-1 h-px bg-neutral-100" />
                  <span className="text-xs text-neutral-300">si la conversation s’y est prêtée</span>
                  <div className="flex-1 h-px bg-neutral-100" />
                </div>
                <div className="space-y-4">{opportunistic.map(field)}</div>
              </>
            )}

            <label className="block mt-5">
              <span className="text-sm font-medium text-neutral-700">Ce qui a été dit en plus</span>
              <textarea
                value={free} onChange={e => setFree(e.target.value)} rows={3}
                placeholder="Objections, noms, budget, calendrier, concurrence, politique interne…"
                className="mt-1.5 w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none placeholder:text-neutral-300"
              />
            </label>

            <div className="mt-5 border-t border-neutral-100 pt-4">
              <SellerReadForm value={sellerRead} onChange={setSellerRead} locale="fr" />
            </div>

            <button
              onClick={save}
              disabled={!filled}
              className="mt-5 w-full px-5 py-2.5 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 shadow-sm shadow-violet-500/20 disabled:opacity-40 transition-all"
            >
              ✦ Analyser la conversation
            </button>
          </>
        )}

        {error && <p className="text-sm text-rose-600 mt-4">{error}</p>}
      </div>
    </div>
  )
}
