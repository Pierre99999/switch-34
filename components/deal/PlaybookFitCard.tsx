'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  type ActorCoverage, type PlaybookFit, type FitVerdict,
  FIT_AXIS_LABELS, FIT_AXIS_SOURCE, FIT_AXIS_QUESTION, VERDICT_MEANING,
} from '@/lib/playbook-fit'

// The playbook fit, read alongside the gates: not "is this deal healthy?" but
// "is this deal ours to win?". It never touches a gate score.
//
// The dashboard shows only a headline button — the full reading is long, and
// six axes of prose above the gates buried the thing they sit next to. The
// one exception is the avoid-list alarm, which is worth interrupting for.

const VERDICT_STYLE: Record<FitVerdict, { dot: string; text: string; label: { fr: string; en: string } }> = {
  aligned: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: { fr: 'Aligné', en: 'Aligned' } },
  partial: { dot: 'bg-amber-500', text: 'text-amber-700', label: { fr: 'Partiel', en: 'Partial' } },
  mismatch: { dot: 'bg-rose-500', text: 'text-rose-700', label: { fr: 'Hors cadre', en: 'Off-book' } },
  unknown: { dot: 'bg-neutral-300', text: 'text-neutral-500', label: { fr: 'Inconnu', en: 'Unknown' } },
}

export default function PlaybookFitCard({
  coverage, fit, locale, dealId, onAnalyze, analyzing, error,
}: {
  coverage: ActorCoverage
  fit: PlaybookFit | null
  locale: string
  dealId: string
  onAnalyze: () => void
  analyzing: boolean
  error: string | null
}) {
  const fr = locale === 'fr'
  const [open, setOpen] = useState(false)

  // Nothing in the socle to compare against — say so rather than implying the
  // deal passed a check that never ran.
  if (!coverage.applicable && !fit && !analyzing) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-dashed border-neutral-200 px-5 py-4">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
          {fr ? 'Adéquation au playbook' : 'Playbook fit'}
        </div>
        <p className="text-sm text-neutral-500">
          {fr
            ? 'Votre Sales Playbook est vide : Switch n’a rien à quoi comparer ce prospect.'
            : 'Your Sales Playbook is empty: Switch has nothing to compare this prospect against.'}{' '}
          <Link href="/playbook" className="text-blue-500 hover:text-blue-600 font-medium">
            {fr ? 'Le compléter →' : 'Complete it →'}
          </Link>
        </p>
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </div>
    )
  }

  const aligned = fit?.axes.filter(a => a.verdict === 'aligned').length ?? 0
  const known = fit?.axes.filter(a => a.verdict !== 'unknown').length ?? 0
  const offBook = fit?.axes.some(a => a.verdict === 'mismatch') ?? false
  const alarming = fit?.avoid_list_hit || offBook || coverage.missing.length > 0

  const tone = fit?.avoid_list_hit
    ? 'border-rose-300 bg-rose-50 hover:bg-rose-100/70'
    : alarming
      ? 'border-amber-200 bg-amber-50 hover:bg-amber-100/60'
      : 'border-emerald-200 bg-emerald-50 hover:bg-emerald-100/60'

  return (
    <>
      {/* The headline: one line, clickable. */}
      <button
        onClick={() => setOpen(true)}
        className={`w-full mb-6 rounded-2xl border ${tone} px-5 py-4 text-left transition-colors`}
      >
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-neutral-800">
              {fr ? 'Adéquation au playbook' : 'Playbook fit'}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">
              {fit
                ? <>
                  {aligned}/{known} {fr ? 'axes alignés' : 'axes aligned'}
                  {coverage.applicable && <> · {coverage.covered}/{coverage.total} {fr ? 'rôles couverts' : 'roles covered'}</>}
                  {' · '}
                  {fit.basis === 'context'
                    ? (fr ? 'hypothèse, avant conversation' : 'hypothesis, before any conversation')
                    : (fr ? 'confirmé en conversation' : 'confirmed in conversation')}
                </>
                : (fr ? 'Pas encore évaluée' : 'Not evaluated yet')}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {fit && (
              <div className="flex gap-1">
                {fit.axes.map(a => (
                  <span key={a.key} className={`w-2 h-2 rounded-full ${VERDICT_STYLE[a.verdict].dot}`} />
                ))}
              </div>
            )}
            <span className="text-xs font-medium text-neutral-500">
              {analyzing ? (fr ? 'Analyse…' : 'Analyzing…') : (fr ? 'Voir l’analyse →' : 'See the analysis →')}
            </span>
          </div>
        </div>

        {/* Worth interrupting for, without a click. */}
        {fit?.avoid_list_hit && (
          <p className="mt-3 text-sm font-medium text-rose-800 bg-white/70 border border-rose-200 rounded-xl px-4 py-2.5">
            {fr
              ? '⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir.'
              : '⚠ This prospect resembles a segment you decided to avoid.'}
          </p>
        )}
        {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
      </button>

      {/* The full reading */}
      {open && (
        <div className="fixed inset-0 z-50 bg-neutral-900/40 backdrop-blur-sm overflow-y-auto" onClick={() => setOpen(false)}>
          <div
            className="min-h-full flex items-start justify-center p-4 sm:p-8"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl my-auto">
              <div className="sticky top-0 bg-white/95 backdrop-blur-sm border-b border-neutral-200 px-6 py-4 flex items-center justify-between rounded-t-2xl">
                <div>
                  <h2 className="text-lg font-semibold text-neutral-900">
                    {fr ? 'Adéquation au playbook' : 'Playbook fit'}
                  </h2>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {fr
                      ? 'Ce prospect ressemble-t-il aux deals que vous gagnez ? Cette lecture n’entre jamais dans le score des portes.'
                      : 'Does this prospect look like the deals you win? This reading never enters the gate scores.'}
                  </p>
                </div>
                <button onClick={() => setOpen(false)} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-2">✕</button>
              </div>

              <div className="px-6 py-5 space-y-6">
                {fit?.avoid_list_hit && (
                  <p className="text-sm font-medium text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                    {fr
                      ? '⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir. Quitter n’est pas perdre — vérifiez pourquoi vous faites exception.'
                      : '⚠ This prospect resembles a segment you decided to avoid. Walking away is not losing — check why you are making an exception.'}
                  </p>
                )}

                {fit && (
                  <div className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-3">
                    {fit.basis === 'context'
                      ? (fr
                        ? 'Lecture formée à partir du site du prospect, avant toute conversation : c’est une hypothèse, pas un constat. Elle se confirmera après votre prochaine capture.'
                        : 'Read from the prospect’s website, before any conversation: this is a hypothesis, not a finding. It firms up after your next capture.')
                      : (fr
                        ? 'Lecture appuyée sur ce que le prospect a réellement dit en conversation.'
                        : 'Read from what the prospect actually said in conversation.')}
                  </div>
                )}

                {/* Semantic axes */}
                {fit ? (
                  <div className="space-y-4">
                    {fit.axes.map(a => {
                      const st = VERDICT_STYLE[a.verdict]
                      return (
                        <div key={a.key} className="border border-neutral-200 rounded-xl px-4 py-3.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`w-2.5 h-2.5 rounded-full ${st.dot}`} />
                            <span className="text-sm font-semibold text-neutral-800">
                              {FIT_AXIS_LABELS[a.key][fr ? 'fr' : 'en']}
                            </span>
                            <span className="text-[10px] text-neutral-400">{FIT_AXIS_SOURCE[a.key]}</span>
                            <span className={`text-xs font-semibold ${st.text}`}>{st.label[fr ? 'fr' : 'en']}</span>
                          </div>
                          <p className="text-xs text-neutral-400 mt-1">{FIT_AXIS_QUESTION[a.key][fr ? 'fr' : 'en']}</p>

                          {a.summary && (
                            <p className="text-sm text-neutral-700 mt-2 leading-relaxed">
                              <span className="text-neutral-400">{fr ? 'Ce prospect : ' : 'This prospect: '}</span>
                              {a.summary}
                            </p>
                          )}
                          {a.reason && (
                            <p className={`text-sm mt-1.5 leading-relaxed ${st.text}`}>
                              <span className="opacity-60">{fr ? 'Pourquoi ce verdict : ' : 'Why this verdict: '}</span>
                              {a.reason}
                            </p>
                          )}
                          {a.playbook_ref && (
                            <p className="text-xs text-neutral-500 mt-2 pl-3 border-l-2 border-neutral-300 italic leading-relaxed">
                              {fr ? 'Votre playbook : ' : 'Your playbook: '}{a.playbook_ref}
                            </p>
                          )}
                          {a.gap && (
                            <p className="text-xs text-amber-700 mt-2 leading-relaxed">
                              {fr ? 'À trancher : ' : 'To settle: '}{a.gap}
                            </p>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-neutral-500">
                    {fr
                      ? 'Les cinq axes n’ont pas encore été évalués pour ce deal.'
                      : 'The five axes have not been evaluated for this deal yet.'}
                  </p>
                )}

                {/* Actors — deterministic */}
                {coverage.applicable && (
                  <div>
                    <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-1">
                      {fr ? 'Acteurs nécessaires' : 'Necessary actors'} <span className="text-neutral-400 font-normal">A5</span>
                    </div>
                    <p className="text-xs text-neutral-400 mb-3">
                      {fr
                        ? 'Comparaison directe entre les rôles de votre A5 et les contacts de ce deal — aucune interprétation.'
                        : 'A direct comparison between your A5 roles and this deal’s contacts — no interpretation involved.'}
                    </p>
                    <ul className="space-y-2">
                      {coverage.requirements.filter(r => r.actor).map((r, i) => (
                        <li key={i} className="flex items-start gap-2.5">
                          <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${r.covered ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {r.covered ? '✓' : '!'}
                          </span>
                          <div className="min-w-0">
                            <span className="text-sm font-medium text-neutral-800">{r.label}</span>
                            {r.covered
                              ? <span className="text-sm text-neutral-500"> — {r.coveredBy.join(', ')}</span>
                              : <span className="text-sm text-amber-700"> — {fr ? 'absent de ce deal' : 'missing on this deal'}</span>}
                            {!r.covered && r.risk && <p className="text-xs text-amber-700/90 mt-0.5 leading-relaxed">{r.risk}</p>}
                          </div>
                        </li>
                      ))}
                    </ul>
                    {coverage.unmatched.length > 0 && (
                      <p className="text-xs text-neutral-500 mt-2">
                        {fr ? 'Rôles non reconnus automatiquement, à vérifier à la main : ' : 'Roles not recognised automatically, check by hand: '}
                        {coverage.unmatched.map(r => r.label).join(', ')}
                      </p>
                    )}
                  </div>
                )}

                {/* Legend — a colour without a key is a puzzle */}
                <div className="border-t border-neutral-100 pt-4">
                  <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-2">
                    {fr ? 'Lecture des couleurs' : 'Reading the colours'}
                  </div>
                  <ul className="space-y-1.5">
                    {(['aligned', 'partial', 'mismatch', 'unknown'] as FitVerdict[]).map(v => (
                      <li key={v} className="flex items-start gap-2 text-xs text-neutral-600">
                        <span className={`mt-1 w-2 h-2 rounded-full flex-shrink-0 ${VERDICT_STYLE[v].dot}`} />
                        <span><span className="font-medium">{VERDICT_STYLE[v].label[fr ? 'fr' : 'en']}</span> — {VERDICT_MEANING[v][fr ? 'fr' : 'en']}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {error && <p className="text-sm text-rose-600">{error}</p>}
              </div>

              <div className="border-t border-neutral-200 px-6 py-4 flex items-center gap-4 flex-wrap">
                <button
                  onClick={onAnalyze}
                  disabled={analyzing}
                  className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
                >
                  {analyzing
                    ? (fr ? 'Analyse…' : 'Analyzing…')
                    : fit
                      ? (fr ? 'Réévaluer l’adéquation' : 'Re-evaluate the fit')
                      : (fr ? '✦ Évaluer l’adéquation' : '✦ Evaluate the fit')}
                </button>
                <Link href="/playbook" className="text-sm font-medium text-blue-500 hover:text-blue-600">
                  {fr ? 'Sales Playbook →' : 'Sales Playbook →'}
                </Link>
                <Link href={`/deals/${dealId}/context`} className="text-sm font-medium text-blue-500 hover:text-blue-600">
                  {fr ? 'Contacts du deal →' : 'Deal contacts →'}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
