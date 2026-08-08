import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roundFocus, roundAims } from './round-focus'
import { computeDealState } from './scoring'
import { portfolioActions } from './mission-control'
import type { Deal, DealRound } from './types'
import type { ActorCoverage } from './playbook-fit'

const NOW = Date.parse('2026-08-06T09:00:00Z')

function deal(over: Partial<Deal> & { id: string }): Deal {
  return {
    prospect_name: over.id, current_round: 1, status: 'active',
    potential_revenue: 10000, playbook_fit: null,
    ...over,
  } as unknown as Deal
}

function round(n: number, over: Record<string, unknown> = {}): DealRound {
  return {
    id: `r${n}`, round: n,
    evidence_levels: {}, rationales: {}, declarations: {},
    capture_notes: { q: 'said' }, briefing_line: 'x',
    updated_at: new Date(NOW).toISOString(),
    ...over,
  } as unknown as DealRound
}

const coverageMissing = (label: string): ActorCoverage => ({
  applicable: true, requirements: [], covered: 0, total: 1, unmatched: [],
  missing: [{ label, why: '', risk: 'Rien ne se signe sans lui.', actor: 'decision_maker', covered: false, coveredBy: [] }],
} as unknown as ActorCoverage)

const focusOf = (d: Deal, rounds: DealRound[], coverage: ActorCoverage | null = null) =>
  roundFocus({ deal: d, rounds, current: rounds.find(r => r.round === d.current_round) ?? null, state: computeDealState(rounds, d.current_round), coverage })

test('the written bet wins over anything composed', () => {
  const d = deal({ id: 'a' })
  const f = focusOf(d, [round(1, { briefing_hypothesis: 'Si Nelson reconnaît un problème de gouvernance, notre offre devient pertinente.' })])
  assert.match(f.headline, /^Si Nelson/)
  assert.equal(f.hypothesis, f.headline)
})

test('without a bet the headline is the objective, never left empty', () => {
  const d = deal({ id: 'a' })
  const f = focusOf(d, [round(1)])
  assert.equal(f.hypothesis, null)
  assert.ok(f.headline.length > 10, f.headline)
  assert.equal(f.headline, f.objective)
})

test('Mission Control prints the sentence the deal screen prints', () => {
  // The bug: the deal read « Ouvrir problème business réel et ouvrir raison
  // impérieuse. » while the week's list read « Faire entrer CEO dans la
  // boucle » — one round, two answers to what it was for.
  const d = deal({ id: 'a' })
  const rounds = [round(1)]
  const coverage = coverageMissing('CEO')
  const [action] = portfolioActions({
    deals: [d], roundsByDeal: { a: rounds }, coverageByDeal: { a: coverage }, now: NOW,
  })
  assert.equal(action.focus, focusOf(d, rounds, coverage).headline)
  assert.equal(action.kind, 'actor')
  // The action is still there — underneath, as the way in.
  assert.match(action.title, /CEO/)
})

test('an actor keeps the playbook capitalisation inside the sentence', () => {
  // It read « faire entrer cEO dans la boucle » on the deal screen.
  const aims = roundAims(round(1, {
    real_business_problem: 4, compelling_reason: 4, concerns_fit: 4,
    stakeholder_map: 4, personal_pain_linkage: 4, urgency: 4,
  }), coverageMissing('CEO'))
  assert.ok(aims.some(a => a.includes('CEO')), aims.join(' | '))
  assert.ok(!aims.some(a => a.includes('cEO')), aims.join(' | '))
})

test('a closed deal says so rather than composing an objective', () => {
  const d = deal({ id: 'a', status: 'won' })
  assert.match(focusOf(d, [round(1)]).headline, /clos/)
})
