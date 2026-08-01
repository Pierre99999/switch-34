'use client'

import Link from 'next/link'
import { useState } from 'react'
import {
  type ActorCoverage, type PlaybookFit, type FitVerdict,
  FIT_AXIS_LABELS, FIT_AXIS_SOURCE,
} from '@/lib/playbook-fit'

// The playbook fit, read alongside the gates: not "is this deal healthy?" but
// "is this deal ours to win?". It never touches a gate score.
//
// Two kinds of axis sit here. Actors is a set intersection between A5 and the
// deal's contacts — deterministic, always current. The other five are a model
// reading of the prospect against A1-A4, and carry the basis they were formed
// on: a website is a hypothesis until a conversation confirms it.

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

  const hasAnything = coverage.applicable || fit
  if (!hasAnything && !analyzing && !error) {
    // Nothing in the socle to compare against — say so rather than implying
    // the deal passed a check that never ran.
    return (
      <div className="mb-6 bg-white rounded-2xl border border-dashed border-neutral-200 px-5 py-4">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
          {fr ? 'Adéquation au playbook' : 'Playbook fit'}
        </div>
        <p className="text-sm text-neutral-500">
          {fr
            ? 'Votre Sales Playbook est vide : Switch n’a rien à quoi comparer ce prospect.'
            : 'Your Sales Playbook is empty: Switch has nothing to compare this prospect against.'}
          {' '}
          <Link href="/playbook" className="text-blue-500 hover:text-blue-600 font-medium">
            {fr ? 'Le compléter →' : 'Complete it →'}
          </Link>
        </p>
      </div>
    )
  }

  const offBook = fit?.axes.filter(a => a.verdict === 'mismatch') ?? []
  const aligned = fit?.axes.filter(a => a.verdict === 'aligned').length ?? 0
  const known = fit?.axes.filter(a => a.verdict !== 'unknown').length ?? 0

  const alarming = fit?.avoid_list_hit || offBook.length > 0 || coverage.missing.length > 0
  const tone = fit?.avoid_list_hit
    ? { border: 'border-rose-300', bg: 'bg-rose-50', label: 'text-rose-600' }
    : alarming
      ? { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-600' }
      : { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600' }

  return (
    <div className={`mb-6 rounded-2xl border ${tone.border} ${tone.bg} px-5 py-4`}>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone.label}`}>
          {fr ? 'Adéquation au playbook' : 'Playbook fit'}
          {fit && (
            <span className="ml-2 font-normal normal-case text-neutral-500">
              {fit.basis === 'context'
                ? (fr ? '· hypothèse, avant conversation' : '· hypothesis, before any conversation')
                : (fr ? '· confirmé en conversation' : '· confirmed in conversation')}
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 text-xs font-semibold text-neutral-600">
          {fit && <span>{aligned}/{known} {fr ? 'axes alignés' : 'axes aligned'}</span>}
          {coverage.applicable && <span>{coverage.covered}/{coverage.total} {fr ? 'rôles' : 'roles'}</span>}
        </div>
      </div>

      {/* The single most valuable thing this card can say. */}
      {fit?.avoid_list_hit && (
        <p className="mt-3 text-sm font-medium text-rose-800 bg-white/70 border border-rose-200 rounded-xl px-4 py-3">
          {fr
            ? '⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir. Quitter n’est pas perdre — vérifiez pourquoi vous faites exception.'
            : '⚠ This prospect resembles a segment you decided to avoid. Walking away is not losing — check why you are making an exception.'}
        </p>
      )}

      {/* Summary line per axis */}
      {fit && (
        <ul className="mt-3 space-y-2">
          {fit.axes.map(a => {
            const st = VERDICT_STYLE[a.verdict]
            return (
              <li key={a.key} className="flex items-start gap-2.5">
                <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${st.dot}`} />
                <div className="min-w-0">
                  <span className="text-sm font-medium text-neutral-800">
                    {FIT_AXIS_LABELS[a.key][fr ? 'fr' : 'en']}
                  </span>
                  <span className="text-[10px] text-neutral-400 ml-1.5">{FIT_AXIS_SOURCE[a.key]}</span>
                  <span className={`text-xs font-medium ml-2 ${st.text}`}>{st.label[fr ? 'fr' : 'en']}</span>
                  {open && (
                    <>
                      {a.summary && <p className="text-sm text-neutral-600 mt-0.5 leading-relaxed">{a.summary}</p>}
                      {a.playbook_ref && (
                        <p className="text-xs text-neutral-500 mt-1 pl-2 border-l-2 border-neutral-300 italic leading-relaxed">
                          {fr ? 'Playbook : ' : 'Playbook: '}{a.playbook_ref}
                        </p>
                      )}
                      {a.gap && (
                        <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                          {fr ? 'À vérifier : ' : 'To settle: '}{a.gap}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {/* Actors — deterministic, always shown when A5 says something */}
      {coverage.applicable && (
        <div className={fit ? 'mt-3 pt-3 border-t border-neutral-200/70' : 'mt-3'}>
          <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide mb-2">
            {fr ? 'Acteurs nécessaires' : 'Necessary actors'} <span className="text-neutral-400 font-normal">A5</span>
          </div>
          <ul className="space-y-2">
            {coverage.requirements.filter(r => r.actor).map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[10px] flex-shrink-0 ${r.covered ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                  {r.covered ? '✓' : '!'}
                </span>
                <div className="min-w-0">
                  <span className="text-sm font-medium text-neutral-800">{r.label}</span>
                  {r.covered ? (
                    <span className="text-sm text-neutral-500"> — {r.coveredBy.join(', ')}</span>
                  ) : (
                    <span className="text-sm text-amber-700"> — {fr ? 'absent de ce deal' : 'missing on this deal'}</span>
                  )}
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

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-3 pt-3 border-t border-neutral-200/70 flex items-center gap-4 flex-wrap">
        {fit && (
          <button onClick={() => setOpen(o => !o)} className="text-xs font-medium text-neutral-600 hover:text-neutral-800">
            {open ? (fr ? 'Masquer le détail' : 'Hide detail') : (fr ? 'Voir le détail' : 'See detail')}
          </button>
        )}
        <button
          onClick={onAnalyze}
          disabled={analyzing}
          className="text-xs font-medium text-blue-500 hover:text-blue-600 disabled:opacity-40"
        >
          {analyzing
            ? (fr ? 'Analyse…' : 'Analyzing…')
            : fit
              ? (fr ? 'Réévaluer l’adéquation' : 'Re-evaluate the fit')
              : (fr ? '✦ Évaluer l’adéquation' : '✦ Evaluate the fit')}
        </button>
        <Link href={`/deals/${dealId}/context`} className="text-xs font-medium text-blue-500 hover:text-blue-600">
          {fr ? 'Contacts du deal →' : 'Deal contacts →'}
        </Link>
      </div>
    </div>
  )
}
