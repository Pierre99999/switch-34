// The portfolio, read the way the method reads a single deal.
//
// Two things a list of rows cannot say: what to do first this week, and where
// each deal actually sits. Both are computed here, from what is stored — no
// model call, so the screen is instant and says the same thing twice.
//
// One thing deliberately NOT computed: a predicted gain. A mockup can promise
// "+0,8 sur Momentum" for an action; nothing in the engine knows that, and the
// method's own rule is that the outcome is never predicted. What each line
// carries instead is the hypothesis the round is testing — particular to the
// deal, and true.

import type { Deal, DealRound } from './types'
import { computeDealState, dealScore, gateScore, prescriptions, DECISIVE_VARS } from './scoring'
import { nextStep, hasCapture } from './deal-rounds'
import { criterionLabel } from './lab-view'
import { normalizeFit, type ActorCoverage } from './playbook-fit'

export type ActionKind = 'exit' | 'settle' | 'capture' | 'brief' | 'actor' | 'revive' | 'next_round'

export type PortfolioAction = {
  dealId: string
  prospect: string
  kind: ActionKind
  /**
   * The bet the current round is making. This is what the seller reads: it is
   * particular to the deal, where an action title ("faire entrer le CEO dans
   * la boucle") comes out identical on three deals at once and stops being
   * read by the second one.
   */
  hypothesis: string | null
  /** What to do, in one line. Shown when there is no hypothesis yet. */
  title: string
  /** Why now — the state of the deal that produced it. */
  why: string
  severity: 'high' | 'medium' | 'low'
}

const DAY = 24 * 60 * 60 * 1000

/** Days since anything was captured on this deal. */
export function daysSinceActivity(rounds: DealRound[], now: number): number | null {
  const stamps = rounds
    .filter(hasCapture)
    .map(r => Date.parse((r as unknown as { updated_at?: string }).updated_at ?? ''))
    .filter(t => Number.isFinite(t))
  if (stamps.length === 0) return null
  return Math.floor((now - Math.max(...stamps)) / DAY)
}

export type PortfolioInput = {
  deals: Deal[]
  roundsByDeal: Record<string, DealRound[]>
  coverageByDeal?: Record<string, ActorCoverage | null>
  /** Passed in rather than read, so the ranking is testable. */
  now: number
}

/**
 * What to do this week, hardest decision first.
 *
 * The order is the method's, not the pipeline's: walking away from a deal that
 * cannot be won comes before advancing one that can, because it is the
 * cheapest decision available and the one a seller avoids longest.
 */
export function portfolioActions(input: PortfolioInput): PortfolioAction[] {
  const { deals, roundsByDeal, coverageByDeal = {}, now } = input
  const out: PortfolioAction[] = []

  for (const deal of deals) {
    if (deal.status && deal.status !== 'active') continue
    const rounds = roundsByDeal[deal.id] ?? []
    const state = computeDealState(rounds, deal.current_round)
    const current = rounds.find(r => r.round === deal.current_round) ?? null
    const step = nextStep(deal, rounds)
    const fit = normalizeFit(deal.playbook_fit)
    const presc = prescriptions(current)
    const decisive = new Set(Object.values(DECISIVE_VARS).flat())
    const idle = daysSinceActivity(rounds, now)

    const hypothesis = (current?.briefing_hypothesis ?? '').trim() || null

    const add = (a: Omit<PortfolioAction, 'dealId' | 'prospect' | 'hypothesis'>) =>
      out.push({ dealId: deal.id, prospect: deal.prospect_name, hypothesis, ...a })

    if (fit?.avoid_list_hit) {
      add({
        kind: 'exit', severity: 'high',
        title: 'Trancher : ce prospect ressemble à un profil à fuir',
        why: 'Votre playbook dit de l’éviter.',
      })
      continue
    }

    const negative = presc.find(p => p.kind === 'NEGATIF')
    if (negative) {
      add({
        kind: 'settle', severity: 'high',
        title: `Trancher sur ${criterionLabel(negative.variable).toLowerCase()}`,
        why: 'Signal défavorable et corroboré sur un critère décisif.',
      })
      continue
    }

    if (step.kind === 'capture') {
      add({
        kind: 'capture', severity: 'medium',
        title: `Importer le transcript du round ${step.round}`,
        why: 'Le briefing est prêt, la conversation n’est pas capturée.',
      })
      continue
    }

    const missing = coverageByDeal[deal.id]?.missing?.[0]
    if (missing) {
      add({
        kind: 'actor', severity: 'high',
        title: `Faire entrer ${missing.label} dans la boucle`,
        why: missing.risk || 'Rôle jugé nécessaire par votre playbook, absent du deal.',
      })
      continue
    }

    if (idle !== null && idle >= 12) {
      add({
        kind: 'revive', severity: 'medium',
        title: `Relancer — aucun échange depuis ${idle} jours`,
        why: 'Un deal sans conversation ne se dégrade pas dans le diagnostic, seulement dans la réalité.',
      })
      continue
    }

    const decisiveWeak = presc.find(p => decisive.has(p.variable))
    if (step.kind === 'brief' || step.kind === 'next_round') {
      add({
        kind: step.kind === 'brief' ? 'brief' : 'next_round', severity: 'low',
        title: step.kind === 'brief'
          ? `Préparer le briefing du round ${step.round}`
          : `Ouvrir le round ${step.round}`,
        why: decisiveWeak
          ? `${criterionLabel(decisiveWeak.variable)} reste le point dur.`
          : `Porte ${state.activeGate} en construction.`,
      })
    }
  }

  const rank: Record<ActionKind, number> = {
    exit: 0, settle: 1, actor: 2, capture: 3, revive: 4, brief: 5, next_round: 6,
  }
  return out.sort((a, b) => rank[a.kind] - rank[b.kind])
}

// ── The map ──────────────────────────────────────────────────

export type PortfolioPosition = {
  dealId: string
  prospect: string
  /** 0 → 1: how far the sequential gates have been carried. */
  advancement: number
  /** The momentum score, 0–5, or null when nothing is captured. */
  momentum: number | null
  /** The deal score, for the label. Not a probability. */
  score: number | null
  revenue: number | null
  risk: 'low' | 'medium' | 'high'
  alert: boolean
}

/**
 * Where each deal sits: how far the gates are carried, against momentum.
 *
 * Advancement counts passed gates, not rounds — a deal on its fifth
 * conversation with gate 1 still open has not advanced, and the pipeline is
 * the one place that lie is comfortable.
 */
export function portfolioPositions(input: Omit<PortfolioInput, 'coverageByDeal'>): PortfolioPosition[] {
  const { deals, roundsByDeal, now } = input
  return deals
    .filter(d => !d.status || d.status === 'active')
    .map(deal => {
      const rounds = roundsByDeal[deal.id] ?? []
      const state = computeDealState(rounds, deal.current_round)
      const current = rounds.find(r => r.round === deal.current_round) ?? null
      const passed = [1, 2, 3].filter(g => state.gates[g]?.status === 'FRANCHIE').length

      // Within the active gate, the fraction already earned — so a deal moves
      // between gates instead of jumping.
      const partial = Math.min(Math.max((gateScore(current, state.activeGate) ?? 0) / 5, 0), 1)
      const advancement = Math.min((passed + (passed < 3 ? partial : 0)) / 3, 1)

      const atRisk = [1, 2, 3].some(g => state.gates[g]?.status === 'A_RISQUE')
      const fit = normalizeFit(deal.playbook_fit)
      const idle = daysSinceActivity(rounds, now)
      const stale = idle !== null && idle >= 21

      const risk: PortfolioPosition['risk'] =
        atRisk || fit?.avoid_list_hit ? 'high'
          : state.momentum.stagnant || stale || state.momentum.status === 'EN_PANNE' ? 'medium'
            : 'low'

      return {
        dealId: deal.id,
        prospect: deal.prospect_name,
        advancement,
        momentum: state.momentum.score,
        score: dealScore(current),
        revenue: deal.potential_revenue,
        risk,
        alert: atRisk || !!fit?.avoid_list_hit,
      }
    })
}
