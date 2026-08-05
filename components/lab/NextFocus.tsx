'use client'

import Link from 'next/link'
import type { Deal, DealRound } from '@/lib/types'
import { VARIABLE_LABELS } from '@/lib/types'
import { prescriptions, type DealState } from '@/lib/scoring'
import { nextStep } from '@/lib/deal-rounds'
import { normalizeFit, FIT_AXIS_LABELS, type ActorCoverage } from '@/lib/playbook-fit'

// The objective, stated as a directive, with what it would take to reach it.
//
// Everything here already exists in the engine — the prescriptions, the gate
// lock, the playbook fit, the post-conversation read. What was missing was
// saying it in one place, as an instruction rather than as four panels to
// cross-reference.

const GATE_NAME: Record<number, string> = {
  1: 'L’opportunité', 2: 'Gagner', 3: 'L’impact', 4: 'Momentum',
}

type Item = { text: string; source: string }

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
  const step = nextStep(deal, rounds)
  const gate = dealState.gates[dealState.activeGate]
  const fit = normalizeFit(deal.playbook_fit)

  // What the next conversation owes this deal, most blocking first.
  const items: Item[] = []

  for (const p of prescriptions(current).slice(0, 3)) {
    const label = VARIABLE_LABELS[p.variable] ?? p.variable
    items.push({
      source: `Porte ${dealState.activeGate}`,
      text: p.kind === 'MANQUANT'
        ? `${label} — rien n’a encore été dit là-dessus. C’est une zone aveugle, pas un score bas.`
        : p.kind === 'CORROBORER'
          ? `${label} — une seule voix pour l’instant. Qui d’autre peut le confirmer, et quel chiffre le prouverait ?`
          : `${label} — le signal est défavorable et corroboré. Il faut trancher, ou partir.`,
    })
  }

  for (const m of (coverage?.missing ?? []).slice(0, 2)) {
    items.push({
      source: 'Playbook A5',
      text: `${m.label} — absent de ce deal.${m.risk ? ` ${m.risk}` : ' Ouvrir un chemin vers cette personne.'}`,
    })
  }

  for (const a of (fit?.axes ?? []).filter(x => x.verdict === 'mismatch' || x.verdict === 'unknown').slice(0, 2)) {
    items.push({
      source: `Adéquation · ${FIT_AXIS_LABELS[a.key].fr}`,
      text: a.gap?.trim() || a.reason?.trim() || 'À trancher lors du prochain échange.',
    })
  }

  const title = (() => {
    if (step.kind === 'closed') return 'Ce deal est clos.'
    if (step.kind === 'capture') return 'Mener la conversation, puis en importer le transcript.'
    if (step.kind === 'brief') {
      return rounds.length === 0
        ? 'Préparer la première conversation.'
        : `Préparer la conversation du round ${step.round}.`
    }
    return gate?.lockMessage
      ? `Lever ce qui bloque la porte ${dealState.activeGate} — ${GATE_NAME[dealState.activeGate]}.`
      : `Ouvrir le round ${step.round}.`
  })()

  const why = (() => {
    if (step.kind === 'capture') {
      return 'Le briefing est prêt. Rien ne bouge tant que la conversation n’est pas capturée : les scores ne se déduisent que de ce qui a été dit, jamais de ce qu’on suppose.'
    }
    if (rounds.length === 0) {
      return 'Aucune conversation n’a encore eu lieu. Le briefing part de votre Sales Playbook et du contexte prospect — les portes se rempliront à partir du premier échange.'
    }
    // The engine's own read of the last round is the best available "why".
    const read = current?.briefing_read?.trim()
    if (read) return read
    if (gate?.lockMessage) return `${gate.lockMessage}. Tant que ce critère reste sous le seuil, la porte ne se franchit pas et les suivantes restent en attente.`
    return 'Le round est capturé et noté. La prochaine conversation peut être préparée.'
  })()

  const action = step.kind === 'closed' ? null
    : step.kind === 'capture' ? { label: '→ Aller capturer la conversation', run: 'capture' as const }
      : step.kind === 'brief' ? { label: '✦ Générer le briefing', run: 'brief' as const }
        : { label: `✦ Créer le briefing du round ${step.round}`, run: 'next_round' as const }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm mb-6">
      <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-2">
        Prochain focus{step.kind !== 'closed' && <span className="text-neutral-300 font-normal normal-case ml-2">Round {step.round}</span>}
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-5">
        <div>
          <h2 className="text-xl font-bold text-neutral-900 leading-snug">{title}</h2>

          {items.length > 0 && (
            <>
              <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wide mt-4 mb-2">
                Ce que cette conversation doit établir
              </div>
              <ul className="space-y-2 mb-4">
                {items.map((it, i) => (
                  <li key={i} className="flex gap-2.5 text-sm">
                    <span className="w-5 h-5 rounded-full bg-neutral-100 text-neutral-500 text-[11px] font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <div className="min-w-0">
                      <span className="text-neutral-700 leading-relaxed">{it.text}</span>
                      <span className="text-[11px] text-neutral-400 ml-1.5 whitespace-nowrap">· {it.source}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          )}

          {action && (
            <div className="flex gap-2 flex-wrap mt-4">
              <button
                onClick={() => onRun(action.run)}
                disabled={busy}
                className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
              >
                {busy ? 'En cours…' : action.label}
              </button>
              {current?.briefing_line && (
                <Link href={`/deals/${dealId}/briefing`} className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 transition-all">
                  Voir le briefing actuel
                </Link>
              )}
            </div>
          )}
          {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
        </div>

        <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4 self-start">
          <div className="text-xs font-semibold text-blue-700 mb-1.5">Pourquoi cet objectif ?</div>
          <p className="text-sm text-neutral-600 leading-relaxed whitespace-pre-wrap">{why}</p>
          {current?.briefing_line && step.kind !== 'capture' && (
            <p className="text-xs text-neutral-500 italic mt-3 pt-3 border-t border-blue-100">
              « {current.briefing_line} »
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
