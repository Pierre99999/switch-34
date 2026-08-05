'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { Deal, DealRound } from '@/lib/types'
import { criterionLabel } from '@/lib/lab-view'
import { prescriptions, type DealState } from '@/lib/scoring'
import { nextStep } from '@/lib/deal-rounds'
import { normalizeFit, FIT_AXIS_LABELS, type ActorCoverage } from '@/lib/playbook-fit'

// The objective, stated as something to go and do, with what it would take.
//
// Everything here already exists in the engine — the prescriptions, the gate
// lock, the playbook fit, the post-conversation read. What was missing was
// saying it in one place, as an instruction rather than as four panels to
// cross-reference.

const GATE_NAME: Record<number, string> = {
  1: 'L’opportunité', 2: 'Gagner', 3: 'L’impact', 4: 'Momentum',
}

type Item = { text: string; source: string; tint: string }

// Lowercase the first letter so a criterion label reads inside a sentence.
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export default function NextFocus({
  deal, rounds, current, dealState, coverage, busy, error, onRun, dealId,
}: {
  deal: Deal
  rounds: DealRound[]
  current: DealRound | null
  dealState: DealState
  coverage: ActorCoverage | null
  busy: boolean
  error: string | null
  onRun: (kind: 'brief' | 'capture' | 'next_round') => void
  dealId: string
}) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const step = nextStep(deal, rounds)
  const gate = dealState.gates[dealState.activeGate]
  const fit = normalizeFit(deal.playbook_fit)

  // What the next conversation owes this deal, most blocking first.
  const items: Item[] = []
  // The same list as verbs, to compose the objective sentence.
  const aims: string[] = []

  for (const p of prescriptions(current).slice(0, 3)) {
    const label = criterionLabel(p.variable)
    items.push({
      source: `Porte ${dealState.activeGate}`,
      tint: 'bg-neutral-100 text-neutral-500',
      text: p.kind === 'MANQUANT'
        ? `${label} — rien n’a encore été dit là-dessus. C’est une zone aveugle, pas un score bas.`
        : p.kind === 'CORROBORER'
          ? `${label} — une seule voix pour l’instant. Qui d’autre peut le confirmer, et quel chiffre le prouverait ?`
          : `${label} — le signal est défavorable et corroboré. Il faut trancher, ou partir.`,
    })
    aims.push(
      p.kind === 'MANQUANT' ? `ouvrir ${lower(label)}`
        : p.kind === 'CORROBORER' ? `corroborer ${lower(label)}`
          : `trancher sur ${lower(label)}`,
    )
  }

  for (const m of (coverage?.missing ?? []).slice(0, 2)) {
    items.push({
      source: 'Playbook A5',
      tint: 'bg-amber-50 text-amber-600',
      text: `${m.label} — absent de ce deal.${m.risk ? ` ${m.risk}` : ' Ouvrir un chemin vers cette personne.'}`,
    })
    aims.push(`faire entrer ${lower(m.label)} dans la boucle`)
  }

  for (const a of (fit?.axes ?? []).filter(x => x.verdict === 'mismatch' || x.verdict === 'unknown').slice(0, 2)) {
    items.push({
      source: `Adéquation · ${FIT_AXIS_LABELS[a.key].fr}`,
      tint: 'bg-violet-50 text-violet-600',
      text: a.gap?.trim() || a.reason?.trim() || 'À trancher lors du prochain échange.',
    })
  }

  // An objective reads better as an action than as a state.
  const title = (() => {
    if (step.kind === 'closed') return 'Ce deal est clos.'
    if (step.kind === 'capture') return 'Mener la conversation, puis en importer le transcript.'
    if (rounds.length === 0) return 'Préparer la première conversation.'
    if (aims.length === 0) {
      return gate?.lockMessage
        ? `Lever ce qui bloque la porte ${dealState.activeGate} — ${GATE_NAME[dealState.activeGate]}.`
        : `Préparer la conversation du round ${step.round}.`
    }
    const [a, b] = aims
    const phrase = b ? `${a} et ${b}` : a
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`
  })()

  const subtitle = step.kind === 'closed' ? null
    : step.kind === 'capture' ? `Le briefing du round ${step.round} est prêt`
      : `Porte ${dealState.activeGate} · ${GATE_NAME[dealState.activeGate]}${gate?.lockMessage ? ` — ${gate.lockMessage}` : ''}`

  // The full engine read, and the short version shown on the card.
  const fullWhy = (() => {
    if (step.kind === 'capture') {
      return 'Le briefing est prêt. Rien ne bouge tant que la conversation n’est pas capturée : les scores ne se déduisent que de ce qui a été dit, jamais de ce qu’on suppose.'
    }
    if (rounds.length === 0) {
      return 'Aucune conversation n’a encore eu lieu. Le briefing part de votre Sales Playbook et du contexte prospect — les portes se rempliront à partir du premier échange.'
    }
    const read = current?.briefing_read?.trim()
    if (read) return read
    if (gate?.lockMessage) return `${gate.lockMessage}. Tant que ce critère reste sous le seuil, la porte ne se franchit pas et les suivantes restent en attente.`
    return 'Le round est capturé et noté. La prochaine conversation peut être préparée.'
  })()

  // First two sentences, so the card stays a glance rather than a page.
  const shortWhy = (() => {
    const sentences = fullWhy.match(/[^.!?]+[.!?]+/g) ?? [fullWhy]
    const head = sentences.slice(0, 2).join(' ').trim()
    return head.length > 20 ? head : fullWhy.slice(0, 220)
  })()
  const truncated = shortWhy.length < fullWhy.trim().length

  const action = step.kind === 'closed' ? null
    : step.kind === 'capture' ? { label: '→ Aller capturer la conversation', run: 'capture' as const }
      : step.kind === 'brief' ? { label: '✦ Générer le briefing', run: 'brief' as const }
        : { label: `✦ Créer le briefing du round ${step.round}`, run: 'next_round' as const }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm">◈</span>
          <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-[0.08em]">Prochain focus</span>
          {step.kind !== 'closed' && <span className="text-[11px] text-neutral-300">Round {step.round}</span>}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div>
            <h2 className="text-[26px] leading-[1.25] font-bold text-neutral-900 tracking-tight">{title}</h2>
            {subtitle && <p className="text-sm text-neutral-400 mt-1.5">{subtitle}</p>}

            {items.length > 0 && (
              <>
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mt-5 mb-3">
                  Ce que cette conversation doit établir
                </div>
                <ul className="space-y-3">
                  {items.map((it, i) => (
                    <li key={i} className="flex gap-3">
                      <span className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5 ${it.tint}`}>
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[15px] text-neutral-700 leading-relaxed">{it.text}</p>
                        <span className="text-[11px] text-neutral-400">{it.source}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {action && (
              <div className="flex gap-2 flex-wrap mt-6">
                <button
                  onClick={() => onRun(action.run)}
                  disabled={busy}
                  className="px-5 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/25 disabled:opacity-40 transition-all"
                >
                  {busy ? 'En cours…' : action.label}
                </button>
                {current?.briefing_line && (
                  <Link href={`/deals/${dealId}/briefing`} className="px-5 py-3 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 transition-all">
                    Voir le briefing actuel
                  </Link>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 self-start">
            <div className="text-sm font-semibold text-blue-800 mb-2">Pourquoi cet objectif ?</div>
            <p className="text-[15px] text-neutral-600 leading-relaxed">{shortWhy}</p>
            {truncated && (
              <button
                onClick={() => setShowAnalysis(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-3"
              >
                Voir l’analyse →
              </button>
            )}
          </div>
        </div>
      </div>

      {showAnalysis && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-10 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAnalysis(false)}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">L’analyse du round {current?.round ?? step.round}</h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  Lecture produite après la conversation, à partir des scores et de ce qui a été dit.
                </p>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>
            </div>
            <div className="px-6 py-5">
              {current?.briefing_line && (
                <p className="text-base font-medium text-neutral-800 leading-relaxed mb-4 pb-4 border-b border-neutral-100">
                  {current.briefing_line}
                </p>
              )}
              <p className="text-[15px] text-neutral-700 leading-[1.75] whitespace-pre-wrap">{fullWhy}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
