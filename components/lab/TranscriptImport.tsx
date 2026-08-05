'use client'

import { useState } from 'react'
import type { DealRound, BriefingQuestion } from '@/lib/types'
import { createClient } from '@/lib/supabase/client'
import { scoreUpdateFromSuggestions, type ScoreSuggestion } from '@/lib/deal-rounds'
import AIProgress from '@/components/ui/AIProgress'

// Capturing a conversation, in one step: hand over the transcript and the
// engine does the rest — map it to the briefing questions, attribute who said
// what, score, then rewrite the read and the playbook fit.
//
// The seller retypes nothing. That is the point: a retold conversation carries
// the seller's memory and bias, a transcript carries the prospect's words.

export default function TranscriptImport({
  dealId, round, onDone, onClose,
}: {
  dealId: string
  round: DealRound
  onDone: () => void
  onClose: () => void
}) {
  const [pasted, setPasted] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = [
    'Lecture du transcript',
    'Attribution des propos',
    'Notation des critères',
    'Mise à jour du diagnostic',
  ]

  async function run(payload: { file?: File; text?: string }) {
    setBusy(true); setError(null)
    try {
      const questions = ((round.briefing_questions ?? []) as BriefingQuestion[]).map(q => ({
        key: q.text, variable: q.variable, text: q.text, intent: q.intent,
      }))

      const form = new FormData()
      if (payload.file) form.append('file', payload.file)
      if (payload.text) form.append('text', payload.text)
      if (questions.length) form.append('questions', JSON.stringify(questions))
      form.append('locale', 'fr')

      const parseRes = await fetch('/api/ai/parse-transcript', { method: 'POST', body: form })
      const parsed = await parseRes.json().catch(() => ({}))
      if (!parseRes.ok) throw new Error(parsed.error ?? `Lecture impossible (${parseRes.status})`)

      const notes = (parsed.notes ?? {}) as Record<string, string>
      if (!Object.values(notes).some(v => typeof v === 'string' && v.trim())) {
        throw new Error('Rien d’exploitable n’a été extrait de ce transcript.')
      }

      const supabase = createClient()
      const merged = { ...((round.capture_notes ?? {}) as Record<string, string>) }
      for (const [k, v] of Object.entries(notes)) {
        if (!v?.trim()) continue
        merged[k] = merged[k]?.trim() ? `${merged[k]}\n\n${v}` : v
      }
      const { error: saveErr } = await supabase
        .from('deal_rounds')
        .update({ capture_notes: merged, capture_speakers: parsed.speakers ?? [] })
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
        .update(scoreUpdateFromSuggestions({ ...round, capture_notes: merged }, (scoreData.suggestions ?? {}) as Record<string, ScoreSuggestion>))
        .eq('id', round.id)

      // The read, the knowledge boxes and the fit all follow from the scoring.
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
      setError(e instanceof Error ? e.message : 'Import impossible')
      setBusy(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-10 overflow-y-auto"
      role="dialog" aria-modal="true" onClick={() => !busy && onClose()}
    >
      <div className="w-full max-w-xl bg-white rounded-2xl shadow-xl my-auto p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4 mb-1">
          <h3 className="text-lg font-bold text-neutral-900">Importer le transcript</h3>
          {!busy && <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>}
        </div>
        <p className="text-sm text-neutral-500 mb-5">
          Round {round.round}. Switch le lit, attribue chaque propos à celui qui l’a tenu, note les critères et met à jour le diagnostic.
        </p>

        {busy ? (
          <div className="border border-neutral-200 rounded-2xl p-5">
            <AIProgress steps={steps} durationSec={90} />
            <p className="text-xs text-neutral-400 mt-4 text-center">Environ 90 secondes. Restez sur cette page.</p>
          </div>
        ) : (
          <>
            <label className="flex items-center justify-center gap-2 border-2 border-dashed border-neutral-300 rounded-xl px-4 py-6 cursor-pointer hover:border-violet-400 hover:bg-violet-50/40 transition-all">
              <span>📄</span>
              <span className="text-sm font-medium text-neutral-600">Choisir un fichier — .txt, .pdf, .vtt, .srt</span>
              <input
                type="file"
                accept=".txt,.atxt,.pdf,.md,.vtt,.srt,.docx"
                className="hidden"
                onChange={e => {
                  const f = e.target.files?.[0]
                  if (f) run({ file: f })
                  e.target.value = ''
                }}
              />
            </label>

            <div className="flex items-center gap-3 my-4">
              <div className="flex-1 h-px bg-neutral-100" />
              <span className="text-xs text-neutral-300">ou collez-le</span>
              <div className="flex-1 h-px bg-neutral-100" />
            </div>

            <textarea
              value={pasted}
              onChange={e => setPasted(e.target.value)}
              rows={7}
              placeholder="Collez le transcript. Gardez les noms des intervenants : Switch pondère chaque propos selon le rôle de celui qui l’a dit."
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-violet-400 resize-none placeholder:text-neutral-300"
            />

            <div className="flex items-center gap-3 mt-4">
              <button
                onClick={() => run({ text: pasted.trim() })}
                disabled={pasted.trim().length < 50}
                className="px-5 py-2.5 bg-violet-500 text-white text-sm font-semibold rounded-xl hover:bg-violet-600 shadow-sm shadow-violet-500/20 disabled:opacity-40 transition-all"
              >
                ✦ Analyser la conversation
              </button>
              <a href={`/deals/${dealId}/capture`} className="text-xs text-neutral-400 hover:text-neutral-600">
                Pas de transcript ? Saisir à la main →
              </a>
            </div>
          </>
        )}

        {error && <p className="text-sm text-rose-600 mt-4">{error}</p>}
      </div>
    </div>
  )
}
