import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dealGreeting, type GreetingInput } from './deal-greeting'
import { computeDealState } from './scoring'
import type { DealRound } from './types'

function round(over: Record<string, unknown> = {}): DealRound {
  return {
    id: 'r1', deal_id: 'd1', round: 1,
    real_business_problem: null, compelling_reason: null, concerns_fit: null,
    stakeholder_map: null, personal_pain_linkage: null,
    credibility_perception: null, value_solution_fit: null,
    competitive_position: null, urgency: null,
    product_capability: null, implementation_feasibility: null,
    adoption_reality: null, impact: null, urgency_resolution: null,
    value_momentum: null, strategic_alignment: null, internal_momentum: null,
    open_objections: null, process_drag: null, external_friction: null,
    evidence_levels: {}, rationales: {}, capture_notes: {},
    ...over,
  } as unknown as DealRound
}

// Every gate-1 criterion high enough to pass — with corroborated evidence,
// since a declared-only score is capped at 2.5 and would never pass a gate.
const gate1Passed = {
  real_business_problem: 4.5, compelling_reason: 4.5, concerns_fit: 4.5,
  stakeholder_map: 4.5, personal_pain_linkage: 4.5,
  evidence_levels: {
    real_business_problem: 'verified', compelling_reason: 'verified',
    concerns_fit: 'verified', stakeholder_map: 'verified',
    personal_pain_linkage: 'verified',
  },
}

function input(over: Partial<GreetingInput> & { rounds?: DealRound[] } = {}): GreetingInput {
  const rounds = over.rounds ?? []
  const current = over.current !== undefined ? over.current : rounds[rounds.length - 1] ?? null
  return {
    deal: { current_round: current?.round ?? 0, status: 'active' },
    rounds,
    current,
    dealState: computeDealState(rounds, current?.round ?? 0),
    coverage: null,
    ...over,
  }
}

test('a deal with nothing captured says nothing at all', () => {
  // The screen already shows four empty gates and a button asking for the
  // transcript; a box repeating that is one you learn to dismiss unread.
  assert.equal(dealGreeting(input()), null)
})

test('scores inherited without a capture do not count as work done', () => {
  // The round carries scores but nothing was ever captured — the greeting must
  // not read that as progress, and must not appear at all.
  assert.equal(dealGreeting(input({ rounds: [round({ ...gate1Passed, capture_notes: {} })] })), null)
})

test('a playbook avoid-list hit outranks everything', () => {
  const i = input({ rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })] })
  i.deal.playbook_fit = {
    axes: [{ key: 'segment', verdict: 'mismatch', summary: '', reason: '', playbook_ref: '' }],
    basis: 'conversation', computed_at: '', avoid_list_hit: true,
  }
  const g = dealGreeting(i)!
  assert.equal(g.key, 'avoid')
  assert.equal(g.tone, 'warn')
})

test('a broken first gate is named, not softened', () => {
  const g = dealGreeting(input({
    rounds: [round({
      capture_notes: { q: 'a' },
      real_business_problem: 1, compelling_reason: 1, concerns_fit: 3,
      stakeholder_map: 3, personal_pain_linkage: 3,
    })],
  }))!
  assert.equal(g.key, 'gate1-risk')
  assert.equal(g.tone, 'warn')
})

test('praise arrives only when a gate is actually passed', () => {
  const g = dealGreeting(input({
    rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })],
  }))!
  assert.equal(g.tone, 'good')
  assert.ok(['one-gate', 'progress', 'all-passed'].includes(g.key), g.key)
})

test('a stalled deal is told so after three conversations', () => {
  const scores = { value_momentum: 1, strategic_alignment: 1, internal_momentum: 1 }
  const rounds = [1, 2, 3, 4].map(n =>
    round({ round: n, capture_notes: { q: `c${n}` }, ...gate1Passed, ...scores }))
  const g = dealGreeting(input({ rounds }))!
  assert.equal(g.key, 'stalled')
})

test('the signature changes when the deal moves, and only then', () => {
  const a = dealGreeting(input({ rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })] }))!
  const same = dealGreeting(input({ rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })] }))!
  assert.equal(a.signature, same.signature, 'reopening an unchanged deal must not re-greet')

  const moved = dealGreeting(input({
    rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' }, credibility_perception: 4.5, evidence_levels: { ...gate1Passed.evidence_levels, credibility_perception: 'verified' } })],
  }))!
  assert.notEqual(a.signature, moved.signature)
})

test('every greeting says something, and carries the next move unless closed', () => {
  const cases = [
    input({ rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })] }),
    input({ rounds: [round({ capture_notes: { q: 'a' }, real_business_problem: 1, compelling_reason: 1 })] }),
  ]
  for (const c of cases) {
    const g = dealGreeting(c)
    assert.ok(g, 'a captured deal always has something to say')
    assert.ok(g.headline.length > 10, g.key)
    assert.ok(g.body.length > 40, g.key)
    assert.ok(g.action && g.action.length > 0, `${g.key} must offer the next move`)
  }
})

test('a closed deal is not given a next move', () => {
  const i = input({ rounds: [round({ ...gate1Passed, capture_notes: { q: 'a' } })] })
  i.deal.status = 'won'
  const g = dealGreeting(i)!
  assert.equal(g.key, 'closed')
  assert.equal(g.action, null)
})
