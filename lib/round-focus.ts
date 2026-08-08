// What the round is trying to prove — computed once, printed twice.
//
// The deal screen and Mission Control both answer "what is this round for".
// They used to answer it separately: the deal screen composed an objective out
// of the prescriptions, Mission Control printed the action it had ranked
// first. On the same deal, the same day, one read "Ouvrir problème business
// réel et ouvrir raison impérieuse." and the other "Faire entrer CEO dans la
// boucle" — two truths about one round, and no way for the seller to know
// which one the method meant.
//
// So the sentence lives here. Both screens read it; the action stays what it
// was, underneath, as the way in.

import type { Deal, DealRound } from './types'
import { prescriptions, type DealState } from './scoring'
import { nextStep } from './deal-rounds'
import { criterionLabel, gateName } from './lab-view'
import type { ActorCoverage } from './playbook-fit'

/** Lowercase the first letter so a criterion label reads inside a sentence. */
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export type RoundFocus = {
  /**
   * The bet the briefing engine wrote for this round — particular to the deal,
   * and falsifiable. Null until a briefing exists.
   */
  hypothesis: string | null
  /** What the next conversation owes the deal, when no bet was written. */
  objective: string
  /** What both screens print in the hypothesis slot: the bet, else the objective. */
  headline: string
  /** The one line of reason written with the objective, when there is one. */
  why: string | null
}

/**
 * The aims of the next conversation, as verbs, most blocking first.
 *
 * Actor labels keep the playbook's capitalisation — "faire entrer CEO dans la
 * boucle", not "cEO".
 */
export function roundAims(current: DealRound | null, coverage: ActorCoverage | null): string[] {
  const aims: string[] = []
  for (const p of prescriptions(current).slice(0, 3)) {
    const label = lower(criterionLabel(p.variable))
    aims.push(
      p.kind === 'MANQUANT' ? `ouvrir ${label}`
        : p.kind === 'CORROBORER' ? `corroborer ${label}`
          : p.kind === 'PRECISER' ? `préciser ${label}`
            : `trancher sur ${label}`,
    )
  }
  for (const m of (coverage?.missing ?? []).slice(0, 2)) {
    aims.push(`faire entrer ${m.label} dans la boucle`)
  }
  return aims
}

export type RoundFocusInput = {
  deal: Deal
  rounds: DealRound[]
  current: DealRound | null
  state: DealState
  coverage?: ActorCoverage | null
}

export function roundFocus({ deal, rounds, current, state, coverage = null }: RoundFocusInput): RoundFocus {
  const step = nextStep(deal, rounds)
  const gate = state.gates[state.activeGate]

  // Written by the engine right after it analysed the conversation: an
  // objective, then one line of reason. Composing it from the prescriptions
  // gave mechanical phrasing, so that is only the fallback.
  const written = (current?.focus_objective ?? '').trim()
  const [writtenObjective, writtenWhy] = written ? written.split('\n').map(x => x.trim()) : [null, null]

  const aims = roundAims(current, coverage)
  const objectiveFromAims = (() => {
    if (aims.length === 0) return null
    const [a, b] = aims
    const phrase = b ? `${a} et ${b}` : a
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`
  })()

  // The objective does not become generic because a briefing was produced;
  // that is the moment it is at its most precise.
  const objective = (() => {
    if (step.kind === 'closed') return 'Ce deal est clos.'
    if (step.kind !== 'capture' && writtenObjective) return writtenObjective
    if (rounds.length === 0 && step.kind !== 'capture') return 'Préparer la première conversation.'
    if (objectiveFromAims) return objectiveFromAims
    if (step.kind === 'capture') {
      return current?.briefing_line?.trim() || 'Mener la conversation, puis en importer le transcript.'
    }
    return gate?.lockVariable
      ? `Lever ce qui bloque la porte ${state.activeGate} — ${gateName(state.activeGate)}.`
      : `Préparer la conversation du round ${step.round}.`
  })()

  const hypothesis = (current?.briefing_hypothesis ?? '').trim() || null

  return { hypothesis, objective, headline: hypothesis ?? objective, why: writtenWhy || null }
}
