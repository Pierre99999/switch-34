import { test } from 'node:test'
import assert from 'node:assert/strict'
import { copilotSuggestions, type SuggestionInput } from './copilot-suggestions'
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

function input(over: Partial<SuggestionInput> & { rounds?: DealRound[] } = {}): SuggestionInput {
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

const keys = (i: SuggestionInput) => copilotSuggestions(i).map(s => s.key)

test('always returns exactly four questions', () => {
  assert.equal(copilotSuggestions(input()).length, 4)

  const busy = input({
    rounds: [round({
      briefing_line: 'x',
      capture_notes: { q: 'said' },
      real_business_problem: 1, compelling_reason: 1, concerns_fit: 1,
      stakeholder_map: 1, personal_pain_linkage: 1,
      evidence_levels: { compelling_reason: 'corroborated' },
    })],
  })
  assert.equal(copilotSuggestions(busy).length, 4)
})

test('a brand new deal is asked what is already known', () => {
  assert.ok(keys(input()).includes('start'))
})

test('the anchor question is always first, whatever the deal is doing', () => {
  // What matters to understand is not the same at round 1 and at round 4, so
  // the question has to be asked at every step — and always in the same place,
  // or it becomes something you ask when you already know the answer.
  assert.equal(keys(input())[0], 'understand')

  const busy = input({
    rounds: [round({
      briefing_line: 'x', capture_notes: { q: 'said' },
      declarations: { urgency: [{ role: 'decideur', stance: 'contre', text: 'trop cher' }] },
    })],
  })
  assert.equal(keys(busy)[0], 'understand')
})

test('the avoid list outranks everything else that varies', () => {
  // Walking away is the cheapest decision available, so it comes first among
  // the three state-driven slots.
  const i = input({
    rounds: [round({ briefing_line: 'x', capture_notes: { q: 'said' } })],
  })
  i.deal.playbook_fit = {
    axes: [{ key: 'segment', verdict: 'mismatch', summary: '', reason: '', playbook_ref: '' }],
    basis: 'conversation', computed_at: '', avoid_list_hit: true,
  }
  assert.equal(keys(i)[1], 'avoid')
})

test('a missing necessary actor becomes a question', () => {
  const i = input({
    rounds: [round({ briefing_line: 'x', capture_notes: { q: 'said' } })],
    coverage: {
      applicable: true, requirements: [], covered: 0, total: 1, unmatched: [],
      missing: [{ label: 'Gardien du budget', why: '', risk: 'Le budget saute en fin de cycle.', actor: 'budget_guardian', covered: false, coveredBy: [] }],
    },
  })
  assert.ok(keys(i).some(k => k.startsWith('actor:')))
})

test('a stalled momentum is surfaced', () => {
  const rounds = [
    round({ round: 1, briefing_line: 'x', capture_notes: { q: 'a' }, value_momentum: 1, strategic_alignment: 1, internal_momentum: 1 }),
    round({ round: 2, briefing_line: 'x', capture_notes: { q: 'b' }, value_momentum: 1, strategic_alignment: 1, internal_momentum: 1 }),
    round({ round: 3, briefing_line: 'x', capture_notes: { q: 'c' }, value_momentum: 1, strategic_alignment: 1, internal_momentum: 1 }),
  ]
  assert.ok(keys(input({ rounds })).includes('momentum'))
})

test('the three other questions change as the deal changes', () => {
  const before = keys(input())
  const after = keys(input({
    rounds: [round({
      briefing_line: 'x', capture_notes: { q: 'said' },
      declarations: { urgency: [{ role: 'decideur', stance: 'contre', text: 'trop cher' }] },
    })],
  }))
  assert.notDeepEqual(before, after, 'a deal that moved must not offer the same four questions')
})

test('every suggestion carries a question for the copilot', () => {
  for (const s of copilotSuggestions(input())) {
    assert.ok(s.q.length > 30, `${s.key} needs a real question, got "${s.q}"`)
    assert.ok(s.label.length > 0 && s.hint.length > 0)
  }
})

test('no duplicate keys', () => {
  const k = keys(input({ rounds: [round({ briefing_line: 'x', capture_notes: { q: 'said' } })] }))
  assert.equal(new Set(k).size, k.length)
})
