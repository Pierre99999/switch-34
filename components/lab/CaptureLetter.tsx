'use client'

import type { BriefingQuestion, DealRound, TranscriptSpeaker } from '@/lib/types'
import {
  normalizeSellerRead, ENGAGEMENT_LEVELS, TONE_LEVELS, CONFIDENCE_LEVELS,
} from '@/lib/seller-read'

// The conversation, read back. Same shape as the briefing letter: what was
// asked, and under it what was said — in the words that were captured.
//
// The timeline used to link to the old app's capture page, which opens a form
// on the CURRENT round and therefore showed nothing of the round you clicked.
// A past conversation is something you read, not a form you reopen.
//
// Questions left unanswered are shown, greyed: a blank is information — it
// says the zone was not opened — and hiding it would make every capture look
// complete.

function levelLabel(levels: readonly { value: number; fr: string }[], v?: number) {
  return levels.find(l => l.value === v)?.fr ?? null
}

function Answer({ question, said }: { question: string; said: string }) {
  return (
    <div>
      <div className="text-sm font-medium text-neutral-800 leading-snug">{question}</div>
      {said ? (
        <p className="text-sm text-neutral-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{said}</p>
      ) : (
        <p className="text-sm text-neutral-300 mt-1.5">Pas abordé.</p>
      )}
    </div>
  )
}

export default function CaptureLetter({
  round, prospectName, onClose,
}: {
  round: DealRound
  prospectName: string
  onClose: () => void
}) {
  const questions = (round.briefing_questions ?? []) as BriefingQuestion[]
  const notes = (round.capture_notes ?? {}) as Record<string, string>
  const said = (text: string) => (notes[text] ?? '').trim()

  const pressing = questions.filter(q => q.priority !== 'opportunistic')
  const opportunistic = questions.filter(q => q.priority === 'opportunistic')

  // Notes whose question no longer exists on the round — a briefing regenerated
  // after the capture, or a capture written before the questions were. They are
  // what was said too; dropping them would lose it.
  const asked = new Set(questions.map(q => q.text))
  const orphans = Object.entries(notes)
    .filter(([k, v]) => k !== '__free__' && !asked.has(k) && typeof v === 'string' && v.trim())

  const free = (notes.__free__ ?? '').trim()
  const speakers = ((round.capture_speakers ?? []) as TranscriptSpeaker[])
    .filter(s => typeof s?.name === 'string' && s.name.trim())
  const read = normalizeSellerRead(round.seller_read)

  const when = round.updated_at ?? round.created_at
  const date = when
    ? new Date(when).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Conversation · {prospectName}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">
              Round {round.round}{date ? ` — ${date}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>
        </div>

        <div className="px-6 py-6 space-y-5">
          {speakers.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {speakers.map((s, i) => (
                <span
                  key={i}
                  className={`text-xs px-2.5 py-1 rounded-full ${
                    s.side === 'seller' ? 'bg-neutral-100 text-neutral-500' : 'bg-violet-50 text-violet-600'
                  }`}
                >
                  {s.name}{s.title ? ` · ${s.title}` : ''}
                </span>
              ))}
            </div>
          )}

          {pressing.length > 0 && (
            <div className="space-y-4">
              {pressing.map(q => <Answer key={q.text} question={q.text} said={said(q.text)} />)}
            </div>
          )}

          {opportunistic.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-neutral-100" />
                <span className="text-xs text-neutral-300">si la conversation s’y est prêtée</span>
                <div className="flex-1 h-px bg-neutral-100" />
              </div>
              <div className="space-y-4">
                {opportunistic.map(q => <Answer key={q.text} question={q.text} said={said(q.text)} />)}
              </div>
            </>
          )}

          {orphans.length > 0 && (
            <div className="space-y-4">
              {orphans.map(([k, v]) => <Answer key={k} question={k} said={v.trim()} />)}
            </div>
          )}

          {free && (
            <div className="border-t border-neutral-100 pt-5">
              <div className="text-sm font-medium text-neutral-800">Ce qui a été dit en plus</div>
              <p className="text-sm text-neutral-600 mt-1.5 whitespace-pre-wrap leading-relaxed">{free}</p>
            </div>
          )}

          {questions.length === 0 && orphans.length === 0 && !free && (
            <p className="text-sm text-neutral-400">Aucune note n’a été capturée sur ce round.</p>
          )}

          {read && (
            <div className="border-t border-neutral-100 pt-5">
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                Votre ressenti après l’échange
              </div>
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-neutral-600">
                {levelLabel(ENGAGEMENT_LEVELS, read.engagement) && (
                  <span>Engagement : {levelLabel(ENGAGEMENT_LEVELS, read.engagement)}</span>
                )}
                {levelLabel(TONE_LEVELS, read.tone) && (
                  <span>Tonalité : {levelLabel(TONE_LEVELS, read.tone)}</span>
                )}
                {levelLabel(CONFIDENCE_LEVELS, read.confidence) && (
                  <span>Ça se signe : {levelLabel(CONFIDENCE_LEVELS, read.confidence)}</span>
                )}
              </div>
              {read.note && (
                <p className="text-sm text-neutral-600 mt-2 whitespace-pre-wrap leading-relaxed">{read.note}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
