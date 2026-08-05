'use client'

import { useState } from 'react'
import type { DealRound, BriefingQuestion, BriefingObjection } from '@/lib/types'
import { briefingToText, briefingToMailBody, briefingSubject } from '@/lib/briefing-letter'

// The briefing read as a letter, not filled in as a form. Same content as the
// briefing page, rendered for someone about to pick up the phone.

function Questions({ list, title }: { list: BriefingQuestion[]; title: string }) {
  if (list.length === 0) return null
  return (
    <section className="mb-6">
      <h4 className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mb-3">{title}</h4>
      <ol className="space-y-4">
        {list.map((q, i) => (
          <li key={i} className="flex gap-3">
            <span className="w-6 h-6 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] text-neutral-800 leading-relaxed font-medium">{q.text}</p>
              {q.intent && <p className="text-xs text-neutral-400 mt-1">{q.intent}</p>}
              {(q.sub_questions ?? []).length > 0 && (
                <ul className="mt-2 space-y-1">
                  {q.sub_questions.map((s, j) => (
                    <li key={j} className="text-sm text-neutral-600 leading-relaxed pl-3 border-l-2 border-neutral-100">{s}</li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

export default function BriefingLetter({
  round, prospectName, onClose,
}: {
  round: DealRound
  prospectName: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)

  const questions = (round.briefing_questions ?? []) as BriefingQuestion[]
  const objections = (round.briefing_objections ?? []) as BriefingObjection[]
  const doNot = (round.briefing_do_not ?? []) as string[]

  const mailHref = `mailto:?subject=${encodeURIComponent(briefingSubject(prospectName, round.round))}&body=${encodeURIComponent(briefingToMailBody(round))}`

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto"
      role="dialog" aria-modal="true" onClick={onClose}
    >
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-neutral-100 px-6 py-4 flex items-start justify-between gap-4 rounded-t-2xl">
          <div>
            <h3 className="text-lg font-bold text-neutral-900">Briefing · {prospectName}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">Round {round.round} — à lire avant la conversation</p>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>
        </div>

        <div className="px-6 py-6">
          {round.briefing_line && (
            <p className="text-base font-medium text-neutral-800 leading-relaxed mb-6 pb-6 border-b border-neutral-100">
              {round.briefing_line}
            </p>
          )}

          {round.briefing_angle && (
            <section className="mb-6">
              <h4 className="text-[11px] font-semibold text-blue-500 uppercase tracking-[0.08em] mb-2">L’angle</h4>
              <p className="text-[15px] text-neutral-700 leading-relaxed whitespace-pre-wrap">{round.briefing_angle}</p>
            </section>
          )}

          <Questions list={questions.filter(q => q.priority !== 'opportunistic')} title="Les questions à poser" />
          <Questions list={questions.filter(q => q.priority === 'opportunistic')} title="Si la conversation s’ouvre" />

          {objections.length > 0 && (
            <section className="mb-6">
              <h4 className="text-[11px] font-semibold text-amber-600 uppercase tracking-[0.08em] mb-3">Les objections probables</h4>
              <ul className="space-y-3">
                {objections.map((o, i) => (
                  <li key={i} className="bg-amber-50/60 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-sm font-medium text-neutral-800 leading-relaxed">« {o.likely} »</p>
                    {o.frame && <p className="text-sm text-neutral-600 leading-relaxed mt-1.5">{o.frame}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {doNot.length > 0 && (
            <section className="mb-6">
              <h4 className="text-[11px] font-semibold text-rose-500 uppercase tracking-[0.08em] mb-3">À ne pas faire</h4>
              <ul className="space-y-1.5">
                {doNot.map((d, i) => (
                  <li key={i} className="text-sm text-neutral-700 leading-relaxed flex gap-2">
                    <span className="text-rose-400 flex-shrink-0">✕</span>{d}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {round.briefing_win_condition && (
            <section className="bg-emerald-50/60 border border-emerald-100 rounded-xl px-4 py-3">
              <h4 className="text-[11px] font-semibold text-emerald-600 uppercase tracking-[0.08em] mb-1.5">La condition de victoire</h4>
              <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{round.briefing_win_condition}</p>
            </section>
          )}
        </div>

        <div className="border-t border-neutral-100 px-6 py-4 flex items-center gap-3 flex-wrap">
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
          <a
            href={mailHref}
            className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 transition-all"
          >
            Ouvrir dans mon email
          </a>
          <span className="text-[11px] text-neutral-400">
            L’email reprend l’angle, les questions et la condition de victoire. Pour le briefing entier, utilisez Copier.
          </span>
        </div>
      </div>
    </div>
  )
}
