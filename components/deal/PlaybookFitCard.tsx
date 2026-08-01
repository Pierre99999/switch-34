'use client'

import Link from 'next/link'
import type { ActorCoverage } from '@/lib/playbook-fit'

// The playbook fit, read alongside the gates: not "is this deal healthy?" but
// "is this deal ours to win?". It never touches a gate score.
//
// Only the deterministic axis for now — actor coverage, a set intersection
// between A5 and the deal's mapped contacts.
export default function PlaybookFitCard({
  coverage, locale, dealId,
}: {
  coverage: ActorCoverage
  locale: string
  dealId: string
}) {
  const fr = locale === 'fr'

  // Nothing in A5 means nothing to compare against — say so rather than
  // implying the deal passed a check that never ran.
  if (!coverage.applicable) {
    return (
      <div className="mb-6 bg-white rounded-2xl border border-dashed border-neutral-200 px-5 py-4">
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mb-1">
          {fr ? 'Adéquation au playbook' : 'Playbook fit'}
        </div>
        <p className="text-sm text-neutral-500">
          {fr
            ? 'Renseignez A5 · Les acteurs nécessaires dans votre Sales Playbook pour que Switch vérifie qui manque sur ce deal.'
            : 'Fill in A5 · The necessary actors in your Sales Playbook so Switch can check who is missing on this deal.'}
          {' '}
          <Link href="/playbook" className="text-blue-500 hover:text-blue-600 font-medium">
            {fr ? 'Compléter le playbook →' : 'Complete the playbook →'}
          </Link>
        </p>
      </div>
    )
  }

  const allCovered = coverage.missing.length === 0
  const tone = allCovered
    ? { border: 'border-emerald-200', bg: 'bg-emerald-50', label: 'text-emerald-600' }
    : { border: 'border-amber-200', bg: 'bg-amber-50', label: 'text-amber-600' }

  return (
    <div className={`mb-6 rounded-2xl border ${tone.border} ${tone.bg} px-5 py-4`}>
      <div className="flex items-center justify-between gap-4 mb-3">
        <div className={`text-[11px] font-semibold uppercase tracking-wide ${tone.label}`}>
          {fr ? 'Adéquation au playbook · Acteurs' : 'Playbook fit · Actors'}
        </div>
        <div className="text-xs font-semibold text-neutral-600">
          {coverage.covered}/{coverage.total} {fr ? 'rôles couverts' : 'roles covered'}
        </div>
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
              {!r.covered && r.risk && (
                <p className="text-xs text-amber-700/90 mt-0.5 leading-relaxed">{r.risk}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {coverage.unmatched.length > 0 && (
        <p className="text-xs text-neutral-500 mt-3 pt-3 border-t border-neutral-200/70">
          {fr ? 'Rôles du playbook non reconnus automatiquement, à vérifier à la main : ' : 'Playbook roles not recognised automatically, check by hand: '}
          {coverage.unmatched.map(r => r.label).join(', ')}
        </p>
      )}

      <Link
        href={`/deals/${dealId}/context`}
        className="inline-block mt-3 text-xs font-medium text-blue-500 hover:text-blue-600"
      >
        {fr ? 'Gérer les contacts du deal →' : 'Manage the deal contacts →'}
      </Link>
    </div>
  )
}
