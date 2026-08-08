// What the last conversation actually changed, and what is most dangerous now.
//
// Both are computed from what is already stored — no model call. A deal moves
// between two rounds in ways the four gate scores flatten: a criterion that
// went from one voice to two has changed more than one whose average nudged
// up, and neither shows on a progress bar.

import type { DealRound, EvidenceLevel } from './types'
import { criterionLabel } from './lab-view'
import { prescriptions, DECISIVE_VARS, type DealState } from './scoring'
import { criterionHistory } from './criterion-history'
import type { Declaration } from './voice-credit'
import type { ActorCoverage, PlaybookFit } from './playbook-fit'

const EVIDENCE_RANK: Record<string, number> = { declared: 1, corroborated: 2, verified: 3 }

export type RoundChanges = {
  /** Criteria whose evidence got stronger — a second voice, or a proof. */
  confirmed: string[]
  /** Criteria heard for the first time, still on a single voice. */
  claims: string[]
  /** Criteria where someone speaks against what someone else said. */
  contradictions: string[]
}

/**
 * The difference between the round being looked at and the one before it.
 *
 * "Confirmed" means the evidence level rose, not that the score did. That is
 * the distinction the method rests on: a number moving up because the seller
 * feels better about it is not news, a second person saying the same thing is.
 */
export function roundChanges(rounds: DealRound[], upTo: number): RoundChanges {
  const out: RoundChanges = { confirmed: [], claims: [], contradictions: [] }
  const current = rounds.find(r => r.round === upTo)
  if (!current) return out

  const declarations = (current.declarations ?? {}) as Record<string, Declaration[]>
  const evidence = (current.evidence_levels ?? {}) as Record<string, EvidenceLevel>

  for (const variable of Object.keys(evidence)) {
    const history = criterionHistory(rounds, variable, upTo)
    const now = history[0]
    const before = history[1]
    if (!now || now.round !== upTo) continue

    const rankNow = EVIDENCE_RANK[now.evidence ?? ''] ?? 0
    const rankBefore = EVIDENCE_RANK[before?.evidence ?? ''] ?? 0

    if (!before) {
      if (rankNow >= 2) out.confirmed.push(variable)
      else if (rankNow === 1) out.claims.push(variable)
    } else if (rankNow > rankBefore) {
      out.confirmed.push(variable)
    }
  }

  // A contradiction is two people disagreeing on the same criterion. It is
  // worth surfacing on its own: the engine averages it away, and it is
  // precisely what a next conversation should settle.
  for (const [variable, list] of Object.entries(declarations)) {
    if (!Array.isArray(list)) continue
    const against = list.some(d => d.stance === 'contre')
    const towards = list.some(d => d.stance === 'pour')
    if (against && towards) out.contradictions.push(variable)
  }

  return out
}

export type Risk = { label: string; why: string }

/**
 * The two or three things most likely to lose this deal, named plainly.
 *
 * Ordered by what the method treats as fatal rather than by score: a decisive
 * criterion below its threshold outranks a low average, and a required actor
 * nobody has met outranks both.
 */
export function topRisks(input: {
  dealState: DealState
  current: DealRound | null
  coverage: ActorCoverage | null
  fit: PlaybookFit | null
  changes?: RoundChanges
}): Risk[] {
  const { dealState, current, coverage, fit, changes } = input
  const risks: Risk[] = []

  if (fit?.avoid_list_hit) {
    risks.push({
      label: 'Ce prospect ressemble à un profil à fuir',
      why: 'Votre playbook dit de l’éviter — à trancher avant d’investir un round de plus.',
    })
  }

  for (const m of (coverage?.missing ?? []).slice(0, 2)) {
    risks.push({
      label: `${m.label} n’est toujours pas impliqué`,
      why: m.risk || 'Rôle jugé nécessaire par votre playbook, absent du deal.',
    })
  }

  const decisive = new Set(Object.values(DECISIVE_VARS).flat())
  const presc = prescriptions(current)
  for (const p of presc.filter(x => x.kind === 'NEGATIF').slice(0, 2)) {
    risks.push({
      label: `${criterionLabel(p.variable)} est défavorable`,
      why: 'Signal corroboré sur un critère décisif : il faut trancher, ou partir.',
    })
  }
  for (const p of presc.filter(x => decisive.has(x.variable) && x.kind !== 'NEGATIF').slice(0, 2)) {
    risks.push({
      label: `${criterionLabel(p.variable)} reste faible`,
      why: p.kind === 'MANQUANT'
        ? 'Critère décisif dont rien n’a encore été dit.'
        : p.kind === 'CORROBORER'
          ? 'Critère décisif qui ne repose que sur une voix.'
          : 'Critère décisif corroboré mais encore vague.',
    })
  }

  for (const variable of (changes?.contradictions ?? []).slice(0, 1)) {
    risks.push({
      label: `Désaccord sur ${criterionLabel(variable).toLowerCase()}`,
      why: 'Deux personnes ne disent pas la même chose — la moyenne l’efface, pas la réalité.',
    })
  }

  if (dealState.momentum.stagnant) {
    risks.push({
      label: 'Le momentum ne bouge plus',
      why: 'Le travail avance, la décision non.',
    })
  }

  // Three at most: a list of risks nobody finishes reading protects nothing.
  return risks.slice(0, 3)
}

export const changeLabels = (variables: string[]) => variables.map(v => criterionLabel(v))
