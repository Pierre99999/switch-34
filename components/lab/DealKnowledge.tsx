'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Deal, DealRound } from '@/lib/types'
import { isLegacyDimensions } from '@/lib/types'
import { criteriaOfLayer, gateName } from '@/lib/lab-view'
import { criterionHistory, readingSince } from '@/lib/criterion-history'
import type { Declaration } from '@/lib/voice-credit'
import {
  type PlaybookFit, type FitVerdict, type ActorCoverage, type DealContact,
  FIT_AXIS_LABELS, FIT_AXIS_SOURCE,
} from '@/lib/playbook-fit'

// Same hue per gate as the cards above, so the eye connects the two.
const GATE_TINT: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-500',
  2: 'bg-amber-50 text-amber-500',
  3: 'bg-violet-50 text-violet-500',
  4: 'bg-blue-50 text-blue-500',
}
const GATE_ICON: Record<number, string> = { 1: '◎', 2: '◈', 3: '◆', 4: '◇' }

// What we know about this deal, and on whose word — the dashboard's criteria
// reorganised as knowledge rather than as a grid.
//
// It shows only what the engine already stores. The counts at the top are the
// evidence levels, not a new taxonomy: a fact does not exist as an object of
// its own, and inventing a second classification alongside the criteria would
// guarantee the two drift apart.

const ROLE_LABEL: Record<string, string> = {
  decideur: 'Décideur', champion: 'Champion', acheteur_technique: 'Décideur technique',
  gardien_du_budget: 'Gardien du budget', utilisateur: 'Utilisateur', bloqueur: 'Bloqueur',
  unknown: 'Rôle inconnu',
}

const EVIDENCE_PILL: Record<string, string> = {
  declared: 'text-amber-700 bg-amber-100',
  corroborated: 'text-blue-700 bg-blue-100',
  verified: 'text-emerald-700 bg-emerald-100',
}
const EVIDENCE_LABEL: Record<string, string> = {
  declared: 'Déclaré', corroborated: 'Corroboré', verified: 'Chiffré',
}

const ACTOR_LABEL: Record<string, string> = {
  decision_maker: 'Décideur', champion: 'Champion', reviewer: 'Décideur technique',
  budget_guardian: 'Gardien du budget', user: 'Utilisateur', blocker: 'Bloqueur',
}

const VERDICT: Record<FitVerdict, { dot: string; text: string; label: string }> = {
  aligned: { dot: 'bg-emerald-500', text: 'text-emerald-700', label: 'Aligné' },
  partial: { dot: 'bg-amber-500', text: 'text-amber-700', label: 'Partiel' },
  mismatch: { dot: 'bg-rose-500', text: 'text-rose-700', label: 'Hors cadre' },
  unknown: { dot: 'bg-neutral-300', text: 'text-neutral-500', label: 'Inconnu' },
}

// What was extracted from the prospect's own material, before anyone spoke.
// It belongs here rather than on a separate tab: it is knowledge about the
// prospect, just gathered from a different source than the conversations.
function prospectSections(deal: Deal): { label: string; fields: { label: string; value: string }[] }[] {
  const d = deal.prospect_dimensions
  if (!d) return []
  if (isLegacyDimensions(d)) {
    const legacy = d as unknown as Record<string, Record<string, string>>
    return Object.entries(legacy)
      .map(([section, fields]) => ({
        label: section.replace(/_/g, ' '),
        fields: Object.entries(fields ?? {})
          .filter(([, v]) => typeof v === 'string' && v.trim())
          .map(([k, v]) => ({ label: k.replace(/_/g, ' '), value: v })),
      }))
      .filter(s => s.fields.length > 0)
  }
  return (d.dimensions ?? [])
    .map(dim => ({
      label: dim.label,
      fields: dim.fields.filter(f => (f.value ?? '').trim()).map(f => ({ label: f.label, value: f.value })),
    }))
    .filter(s => s.fields.length > 0)
}

// Heavier than the rule between two rows, on purpose: it separates readings,
// not items.
function SectionBreak() {
  return <div className="h-2.5 bg-neutral-50 border-y border-neutral-200/70" />
}

export default function DealKnowledge({
  deal, round, rounds = [], declarations, contacts, fit, coverage, onClose,
  openContextInitially = false, mobileOpen = false,
}: {
  deal: Deal
  round: DealRound | null
  /** Every round of the deal — a criterion's history is already in them. */
  rounds?: DealRound[]
  declarations: Record<string, Declaration[]>
  contacts: DealContact[]
  fit: PlaybookFit | null
  coverage: ActorCoverage | null
  onClose: () => void
  /** Opened on arrival from the creation flow, where it is what was just built. */
  openContextInitially?: boolean
  /** Below xl the panel has no room beside the deal, so it comes over it. */
  mobileOpen?: boolean
}) {
  const [openLayer, setOpenLayer] = useState<number | null>(1)
  const [openContext, setOpenContext] = useState(openContextInitially)
  const [openFit, setOpenFit] = useState(false)
  const [openHistory, setOpenHistory] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const context = prospectSections(deal)
  const contextFields = context.reduce((n, s) => n + s.fields.length, 0)

  // The panel holds three readings, not eleven rows: what the prospect says of
  // itself, how that reads against the socle, and what the conversations have
  // established. The four gates belong together — the thin rules between them
  // said "same family", but nothing said where one family ended.
  const hasContext = contextFields > 0
  const hasFit = !!(fit || coverage?.applicable)

  const layers = [1, 2, 3, 4].map(l => ({ layer: l, criteria: criteriaOfLayer(round, l) }))

  const all = layers.flatMap(l => l.criteria)
  const counts = {
    known: all.filter(c => c.score !== null).length,
    declared: all.filter(c => c.evidence === 'declared').length,
    corroborated: all.filter(c => c.evidence === 'corroborated').length,
    verified: all.filter(c => c.evidence === 'verified').length,
  }
  const contradictions = Object.values(declarations).flat().filter(d => d.stance === 'contre').length

  const matches = (text: string) => !query.trim() || text.toLowerCase().includes(query.toLowerCase())

  return (
    <aside className={`flex-col bg-white ${
      mobileOpen ? 'fixed inset-0 z-50 flex' : 'hidden'
    } xl:static xl:z-auto xl:flex xl:w-[380px] xl:flex-shrink-0 xl:border-l xl:border-neutral-200 xl:min-h-screen`}>
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Connaissance du deal</div>
        <button onClick={onClose} className="text-neutral-300 hover:text-neutral-600 text-sm">✕</button>
      </div>

      <div className="px-5 py-3 border-b border-neutral-100">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher dans la connaissance…"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400 placeholder:text-neutral-300"
        />
      </div>

      <div className="grid grid-cols-4 divide-x divide-neutral-100 border-b border-neutral-100">
        {[
          { n: counts.known, l: 'Notés' },
          { n: counts.declared, l: 'Déclarés' },
          { n: counts.corroborated + counts.verified, l: 'Preuves' },
          { n: contradictions, l: 'Contre' },
        ].map(s => (
          <div key={s.l} className="px-3 py-3 text-center">
            <div className="text-lg font-bold text-neutral-900">{s.n}</div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wide">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* The prospect's own material, before anyone spoke. */}
        {hasContext && (
          <div className="border-b border-neutral-100">
            <button
              onClick={() => setOpenContext(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className="w-7 h-7 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center text-sm flex-shrink-0">◫</span>
                <span className="text-sm font-medium text-neutral-800 truncate">Contexte prospect</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-neutral-400">{contextFields}</span>
                <span className="text-neutral-300 text-xs">{openContext ? '▲' : '▼'}</span>
              </span>
            </button>

            {openContext && (
              <div className="px-5 pb-4 space-y-3">
                {contacts.length > 0 && (
                  <div className="border border-neutral-200/80 rounded-xl p-3.5">
                    <div className="text-xs font-semibold text-neutral-700 mb-2">Contacts</div>
                    <ul className="space-y-2">
                      {contacts.filter(c => matches(`${c.name} ${(c as { role?: string }).role ?? ''}`)).map((c, i) => {
                        const types = (c.actor_types?.length ? c.actor_types : [c.actor_type ?? 'unknown'])
                          .filter(t => t && t !== 'unknown')
                        return (
                          <li key={i}>
                            <div className="text-xs font-medium text-neutral-800">
                              {c.name}
                              {(c as { role?: string }).role && <span className="text-neutral-400 font-normal"> · {(c as { role?: string }).role}</span>}
                            </div>
                            {types.length > 0 && (
                              <div className="flex gap-1 flex-wrap mt-1">
                                {types.map(t => (
                                  <span key={t} className="text-[10px] font-medium text-blue-600 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                                    {ACTOR_LABEL[t] ?? t}
                                  </span>
                                ))}
                              </div>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}

                {context.map((sec, i) => {
                  const visible = sec.fields.filter(f => matches(`${sec.label} ${f.label} ${f.value}`))
                  if (visible.length === 0) return null
                  return (
                    <div key={i} className="border border-neutral-200/80 rounded-xl p-3.5">
                      <div className="text-xs font-semibold text-neutral-700 mb-2 capitalize">{sec.label}</div>
                      <ul className="space-y-2">
                        {visible.map((f, j) => (
                          <li key={j}>
                            <div className="text-[11px] text-neutral-400 uppercase tracking-wide">{f.label}</div>
                            <p className="text-xs text-neutral-600 leading-relaxed">{f.value}</p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
                <Link href={`/lab/deals/${deal.id}/context`} className="inline-block text-xs font-medium text-blue-500 hover:text-blue-600">
                  Modifier le contexte →
                </Link>
              </div>
            )}
          </div>
        )}

        {hasContext && hasFit && <SectionBreak />}

        {/* How this deal reads against the socle — the second reading, kept
            beside the gates and never inside them. */}
        {hasFit && (
          <div className="border-b border-neutral-100">
            <button
              onClick={() => setOpenFit(o => !o)}
              className="w-full flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors text-left"
            >
              <span className="flex items-center gap-2.5 min-w-0">
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${fit?.avoid_list_hit ? 'bg-rose-50 text-rose-500' : 'bg-indigo-50 text-indigo-500'}`}>◈</span>
                <span className="text-sm font-medium text-neutral-800 truncate">Adéquation au playbook</span>
              </span>
              <span className="flex items-center gap-2 flex-shrink-0">
                {fit && (
                  <span className="flex gap-1">
                    {fit.axes.map(a => <span key={a.key} className={`w-1.5 h-1.5 rounded-full ${VERDICT[a.verdict].dot}`} />)}
                  </span>
                )}
                <span className="text-neutral-300 text-xs">{openFit ? '▲' : '▼'}</span>
              </span>
            </button>

            {openFit && (
              <div className="px-5 pb-4 space-y-3">
                {fit?.avoid_list_hit && (
                  <p className="text-xs text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 leading-relaxed">
                    ⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir.
                  </p>
                )}

                {fit && (
                  <p className="text-[11px] text-neutral-400">
                    {fit.basis === 'context' ? 'Hypothèse, avant conversation' : 'Confirmé en conversation'}
                  </p>
                )}

                {(fit?.axes ?? []).filter(a => matches(`${FIT_AXIS_LABELS[a.key].fr} ${a.summary} ${a.reason ?? ''}`)).map(a => (
                  <div key={a.key} className="border border-neutral-200/80 rounded-xl p-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`w-2 h-2 rounded-full ${VERDICT[a.verdict].dot}`} />
                      <span className="text-xs font-semibold text-neutral-800">{FIT_AXIS_LABELS[a.key].fr}</span>
                      <span className="text-[10px] text-neutral-400">{FIT_AXIS_SOURCE[a.key]}</span>
                      <span className={`text-[11px] font-medium ${VERDICT[a.verdict].text}`}>{VERDICT[a.verdict].label}</span>
                    </div>
                    {a.summary && <p className="text-xs text-neutral-600 leading-relaxed mt-1.5">{a.summary}</p>}
                    {a.reason && <p className={`text-xs leading-relaxed mt-1 ${VERDICT[a.verdict].text}`}>{a.reason}</p>}
                    {a.playbook_ref && (
                      <p className="text-[11px] text-neutral-500 italic mt-1.5 pl-2 border-l-2 border-neutral-200">{a.playbook_ref}</p>
                    )}
                  </div>
                ))}

                {coverage?.applicable && (
                  <div className="border border-neutral-200/80 rounded-xl p-3.5">
                    <div className="text-xs font-semibold text-neutral-700 mb-2">
                      Acteurs nécessaires <span className="text-neutral-400 font-normal">A5 · {coverage.covered}/{coverage.total}</span>
                    </div>
                    <ul className="space-y-1.5">
                      {coverage.requirements.filter(r => r.actor).map((r, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs">
                          <span className={`mt-0.5 w-3.5 h-3.5 rounded-full flex items-center justify-center text-[9px] flex-shrink-0 ${r.covered ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                            {r.covered ? '✓' : '!'}
                          </span>
                          <span className="min-w-0">
                            <span className="font-medium text-neutral-700">{r.label}</span>
                            <span className="text-neutral-400">{r.covered ? ` — ${r.coveredBy.join(', ')}` : ' — absent'}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {!fit && (
                  <p className="text-xs text-neutral-400">
                    Les cinq axes n’ont pas encore été évalués. Lancez l’évaluation depuis le tableau de bord.
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {(hasContext || hasFit) && <SectionBreak />}

        {layers.map(({ layer, criteria }) => {
          const visible = criteria.filter(c => matches(`${c.label} ${c.rationale ?? ''}`))
          if (query.trim() && visible.length === 0) return null
          const open = query.trim() ? true : openLayer === layer
          const scored = criteria.filter(c => c.score !== null).length
          return (
            <div key={layer} className="border-b border-neutral-100">
              <button
                onClick={() => setOpenLayer(o => o === layer ? null : layer)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors text-left"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${GATE_TINT[layer]}`}>{GATE_ICON[layer]}</span>
                  <span className="text-sm font-medium text-neutral-800 truncate">{gateName(layer)}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-neutral-400">{scored}/{criteria.length}</span>
                  <span className="text-neutral-300 text-xs">{open ? '▲' : '▼'}</span>
                </span>
              </button>

              {open && (
                <div className="px-5 pb-4 space-y-3">
                  {visible.map(c => (
                    <div key={c.variable} className="border border-neutral-200/80 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-800 leading-snug">
                          {c.decisive && <span className="text-amber-500 mr-1" title="Critère décisif">⚡</span>}
                          {c.label}
                        </span>
                        <span className="text-sm font-semibold text-neutral-700 flex-shrink-0">
                          {c.score !== null ? `${c.score.toFixed(1)}` : '—'}
                        </span>
                      </div>

                      {c.evidence && (
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${EVIDENCE_PILL[c.evidence]}`}>
                          {EVIDENCE_LABEL[c.evidence]}
                        </span>
                      )}

                      {c.rationale && (
                        <p className="text-xs text-neutral-600 leading-relaxed mt-2">{c.rationale}</p>
                      )}

                      {(() => {
                        const shown = round?.round ?? 0
                        const since = readingSince(rounds, c.variable, shown)
                        const history = criterionHistory(rounds, c.variable, shown)
                        if (since === null) return null
                        const stale = since < shown
                        return (
                          <div className="flex items-center gap-2 mt-2">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${stale ? 'bg-amber-50 text-amber-600' : 'bg-neutral-100 text-neutral-500'}`}
                              title={stale ? `Rien de neuf sur ce critère depuis le round ${since}` : 'Établi lors de ce round'}
                            >
                              {stale ? `inchangé depuis R${since}` : `R${since}`}
                            </span>
                            {history.length > 1 && (
                              <button
                                onClick={() => setOpenHistory(h => h === c.variable ? null : c.variable)}
                                className="text-[10px] font-medium text-neutral-400 hover:text-neutral-700 transition-colors"
                              >
                                {openHistory === c.variable ? 'masquer l’historique' : 'historique →'}
                              </button>
                            )}
                          </div>
                        )
                      })()}

                      {openHistory === c.variable && (
                        <ul className="mt-2 pt-2 border-t border-neutral-100 space-y-2">
                          {criterionHistory(rounds, c.variable, round?.round ?? 0).map(h => (
                            <li key={h.round} className={h.changed ? '' : 'opacity-50'}>
                              <div className="flex items-center gap-2 text-[11px]">
                                <span className="font-semibold text-neutral-600">R{h.round}</span>
                                <span className="font-medium text-neutral-700">{h.score !== null ? h.score.toFixed(1) : '—'}</span>
                                {h.evidence && (
                                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${EVIDENCE_PILL[h.evidence]}`}>
                                    {EVIDENCE_LABEL[h.evidence]}
                                  </span>
                                )}
                                {!h.changed && <span className="text-[10px] text-neutral-400">inchangé</span>}
                              </div>
                              {h.rationale && <p className="text-[11px] text-neutral-500 leading-relaxed mt-0.5">{h.rationale}</p>}
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.declarations.length > 0 && (
                        <ul className="mt-2 space-y-1.5 pt-2 border-t border-neutral-100">
                          {c.declarations.map((d, i) => (
                            <li key={i} className="text-[11px] leading-relaxed">
                              <span className="font-medium text-neutral-700">{d.contact || '?'}</span>
                              <span className="text-neutral-400"> · {ROLE_LABEL[d.role] ?? d.role}</span>
                              {d.stance === 'contre' && <span className="text-rose-600 font-medium"> · contre</span>}
                              {d.quantified && <span className="text-emerald-600 font-medium"> · chiffré</span>}
                              <div className="text-neutral-500 italic">« {d.text} »</div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.score === null && !c.rationale && (
                        <p className="text-xs text-neutral-300 mt-1.5">Rien de capturé sur ce critère.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
