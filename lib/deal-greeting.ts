// What Switch says to the seller when they open a deal.
//
// The request was a conversational greeting — "beau boulot, tu y es presque".
// The trap is obvious: a product that congratulates you whatever the state of
// the deal is a product you stop reading after three days, and it would say
// the exact opposite of the method, which refuses a verdict without evidence.
//
// So the greeting is warm but it is never free. It is derived from the same
// state as everything else, it names what it is talking about, and it only
// congratulates when something was actually established. When the deal is
// thin, it says so — kindly, and with the next move attached.
//
// Deterministic on purpose: no model call, no wait, no drift on opening.

import type { DealRound } from './types'
import { gateScore, type DealState } from './scoring'
import { gateName } from './lab-view'
import { nextStep } from './deal-rounds'
import { normalizeFit, type PlaybookFit, type ActorCoverage } from './playbook-fit'

export type GreetingTone = 'good' | 'neutral' | 'warn'

export type Greeting = {
  key: string
  tone: GreetingTone
  headline: string
  body: string
  /** The one move that follows, when there is one. */
  action: string | null
  /** Changes when the deal moves, so the greeting comes back only then. */
  signature: string
}

export type GreetingInput = {
  deal: { current_round: number; status?: string | null; playbook_fit?: unknown; prospect_name?: string | null }
  rounds: DealRound[]
  current: DealRound | null
  dealState: DealState
  coverage: ActorCoverage | null
}

const NEXT_LABEL: Record<string, string> = {
  brief: 'Prépare le briefing du round',
  capture: 'Importe le transcript de la conversation',
  next_round: 'Ouvre le round suivant',
  closed: 'Ce deal est clos',
}

function passedGates(state: DealState): number[] {
  return [1, 2, 3].filter(g => state.gates[g]?.status === 'FRANCHIE')
}

/** Movement on the active gate between the last two captured rounds. */
function progressOnActiveGate(rounds: DealRound[], state: DealState): number | null {
  const ordered = [...rounds].sort((a, b) => a.round - b.round)
  if (ordered.length < 2) return null
  const now = gateScore(ordered[ordered.length - 1], state.activeGate)
  const before = gateScore(ordered[ordered.length - 2], state.activeGate)
  if (now === null || before === null) return null
  return Math.round((now - before) * 10) / 10
}

export function dealGreeting(input: GreetingInput): Greeting {
  const { deal, rounds, current, dealState, coverage } = input
  const fit: PlaybookFit | null = normalizeFit(deal.playbook_fit)
  const step = nextStep(deal as { current_round: number; status?: string | null }, rounds)
  const action = step.kind === 'closed' ? null : `${NEXT_LABEL[step.kind]} ${step.round}`
  const passed = passedGates(dealState)
  const gate = dealState.gates[dealState.activeGate]
  const captured = rounds.filter(r => Object.keys(r.capture_notes ?? {}).length > 0).length

  // The signature is what makes this a greeting and not a nag: it comes back
  // when the deal has actually changed, not on every visit.
  const signature = [
    step.kind, step.round, passed.join(''), dealState.activeGate,
    // Every gate, not only the active one: a deal can move on gate 2 while
    // gate 1 is still what blocks it, and that is still movement.
    [1, 2, 3].map(g => dealState.gates[g]?.score ?? '-').join(','),
    dealState.momentum.score ?? '-', dealState.momentum.status, captured,
  ].join('|')

  const make = (key: string, tone: GreetingTone, headline: string, body: string): Greeting =>
    ({ key, tone, headline, body, action, signature })

  if (step.kind === 'closed') {
    return make('closed', 'neutral', 'Ce deal est clos.',
      'Il reste consultable — les rounds, les preuves et ce qui a été dit sont intacts.')
  }

  // Nothing yet. Say that plainly rather than pretend.
  if (rounds.length === 0 || captured === 0) {
    return make('start', 'neutral', 'On part d’une page blanche.',
      'Rien n’a encore été capturé sur ce deal, donc rien n’est établi. La première conversation vaut plus que toutes les hypothèses qu’on pourrait faire d’ici là.')
  }

  // The cheapest decision available comes first, even if it is unwelcome.
  if (fit?.avoid_list_hit) {
    return make('avoid', 'warn', 'Un doute sérieux avant d’aller plus loin.',
      'Ce prospect ressemble à un profil que votre playbook dit d’éviter. Ce n’est pas rédhibitoire, mais ça mérite d’être tranché maintenant plutôt qu’après trois rendez-vous.')
  }

  if (dealState.gates[1]?.status === 'A_RISQUE') {
    return make('gate1-risk', 'warn', 'L’opportunité elle-même n’est pas établie.',
      'Plusieurs conditions de la première porte sont basses. Tant qu’elle ne tient pas, tout ce qui est construit au-dessus repose sur du vide — c’est là qu’il faut mettre l’effort, pas ailleurs.')
  }

  if (passed.length === 3) {
    return make('all-passed', 'good', 'Les trois portes sont franchies. C’est du solide.',
      `Vous avez établi l’opportunité, la capacité à gagner et l’impact. Ce qui décide maintenant, c’est le momentum : ${dealState.momentum.score !== null ? `${dealState.momentum.score}/5` : 'pas encore mesuré'}. Une décision se construit-elle vraiment ?`)
  }

  if (dealState.momentum.stagnant && captured >= 3) {
    return make('stalled', 'warn', 'Le travail avance, la décision non.',
      `Trois conversations, et le momentum ne bouge pas. Ce n’est pas un problème d’effort — c’est le signe qu’il se passe quelque chose chez eux qu’on n’a pas encore vu.`)
  }

  const delta = progressOnActiveGate(rounds, dealState)
  if (delta !== null && delta >= 0.3) {
    return make('progress', 'good', 'Ça avance, et ça se voit.',
      `${gateName(dealState.activeGate)} a gagné ${delta.toFixed(1)} point${delta >= 2 ? 's' : ''} depuis le round précédent. ${gate?.lockMessage ? 'Il reste un point dur, mais la direction est la bonne.' : 'Continuez comme ça.'}`)
  }

  const missing = coverage?.missing?.[0]
  if (missing) {
    return make('actor', 'neutral', 'Bon travail — mais il manque quelqu’un.',
      `Ce qui a été capturé tient, sauf qu’un rôle que votre playbook juge nécessaire n’est pas dans la boucle : ${missing.label}. C’est souvent ce qui fait sauter un deal en fin de cycle.`)
  }

  if (passed.length >= 1) {
    return make('one-gate', 'good', `${passed.length === 1 ? 'Une porte franchie' : `${passed.length} portes franchies`}, on y est presque.`,
      `${gateName(dealState.activeGate)} est la prochaine. ${gate?.lockMessage ? 'Un point la retient encore.' : 'Rien ne la bloque, il faut juste de la matière.'}`)
  }

  return make('building', 'neutral', 'Le deal se construit.',
    `${gateName(dealState.activeGate)} est en construction${gate?.score !== null && gate?.score !== undefined ? ` (${gate.score}/5)` : ''}. Rien n’est joué, dans un sens comme dans l’autre — la prochaine conversation compte.`)
}
