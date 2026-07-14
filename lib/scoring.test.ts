// Unit tests for the Switch scoring engine (acceptance criteria C6–C9).
// Run: npm run test:scoring
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateInfo, gateScore, momentumInfo, criterionScore } from './scoring'
import type { DealRound, EvidenceLevel } from './types'

// Build a minimal DealRound with given scores/evidence.
function makeRound(
  round: number,
  scores: Record<string, number>,
  evidence: Record<string, EvidenceLevel>,
): DealRound {
  return {
    id: `r${round}`,
    deal_id: 'd1',
    round,
    created_at: new Date().toISOString(),
    evidence_levels: evidence,
    authority_levels: {},
    rationales: {},
    capture_notes: {},
    ...scores,
  } as unknown as DealRound
}

const GATE2_VARS = ['urgency', 'value_solution_fit', 'credibility_perception', 'competitive_position']
const GATE1_VARS = ['compelling_reason', 'real_business_problem', 'personal_pain_linkage', 'stakeholder_map', 'concerns_fit']

// C6 — A deal where every criterion is DECLARED can pass no gate
// (cap 2.5 < 3.5 threshold).
test('C6: all-declared deal cannot pass any gate', () => {
  const scores: Record<string, number> = {}
  const evidence: Record<string, EvidenceLevel> = {}
  for (const v of [...GATE1_VARS, ...GATE2_VARS]) {
    scores[v] = 5
    evidence[v] = 'declared'
  }
  const round = makeRound(1, scores, evidence)
  for (const gate of [1, 2]) {
    const info = gateInfo(round, gate, true)
    assert.notEqual(info.status, 'FRANCHIE', `gate ${gate} must not be FRANCHIE with only declared evidence`)
    assert.ok((info.score ?? 0) <= 2.5, `gate ${gate} score must be capped at 2.5`)
  }
})

// C7 — Gate 2 with a high average but urgency at 3.0 stays EN CONSTRUCTION.
test('C7: gate 2 requires urgency >= 3.5 to pass', () => {
  const round = makeRound(1,
    { urgency: 3, value_solution_fit: 5, credibility_perception: 5, competitive_position: 5 },
    { urgency: 'verified', value_solution_fit: 'verified', credibility_perception: 'verified', competitive_position: 'verified' },
  )
  const info = gateInfo(round, 2, true)
  assert.ok((info.score ?? 0) > 3.5, 'weighted average should exceed 3.5')
  assert.equal(info.status, 'EN_CONSTRUCTION')
})

// C8 — Gate 2 passable before gate 1 shows PRÊTE, waiting for gate 1.
test('C8: sequentiality — gate 2 ready but waiting for gate 1', () => {
  const round = makeRound(1,
    { urgency: 5, value_solution_fit: 5, credibility_perception: 5, competitive_position: 5 },
    { urgency: 'verified', value_solution_fit: 'verified', credibility_perception: 'verified', competitive_position: 'verified' },
  )
  const info = gateInfo(round, 2, false) // gate 1 not passed
  assert.equal(info.status, 'PRETE')
  assert.equal(info.waitingForGate, 1)
})

// C9 — A brake never explored counts 0 in the momentum score.
test('C9: unexplored brake counts zero in momentum', () => {
  const base = {
    value_momentum: 5, internal_momentum: 5, strategic_alignment: 5,
    open_objections: 5, process_drag: 5,
    // external_friction intentionally missing = never explored
  }
  const evidence: Record<string, EvidenceLevel> = Object.fromEntries(
    Object.keys(base).map(k => [k, 'verified' as EvidenceLevel])
  )
  const round = makeRound(1, base, evidence)
  const withMissing = gateScore(round, 4)
  // All explored at 5 would be 5.0; missing external_friction (.10) drops it to 4.5.
  assert.equal(withMissing, 4.5)
  const full = makeRound(1, { ...base, external_friction: 5 }, { ...evidence, external_friction: 'verified' })
  assert.equal(gateScore(full, 4), 5.0)
})

// Extra: gate 1 collective lock — one criterion < 2 blocks FRANCHIE.
test('gate 1: any criterion < 2 caps status at EN CONSTRUCTION', () => {
  const round = makeRound(1,
    { compelling_reason: 5, real_business_problem: 5, personal_pain_linkage: 5, stakeholder_map: 5, concerns_fit: 1 },
    { compelling_reason: 'verified', real_business_problem: 'verified', personal_pain_linkage: 'verified', stakeholder_map: 'verified', concerns_fit: 'verified' },
  )
  const info = gateInfo(round, 1, true)
  assert.equal(info.status, 'EN_CONSTRUCTION')
  assert.equal(info.lockMessage, 'concerns_fit')
})

// Extra: legitimate-actor rule — declared by the natural owner caps at 4.0.
test('legitimate actor: declared by natural owner caps at 4.0', () => {
  assert.equal(criterionScore('adoption_reality', 5, 'declared', 'end_user'), 4.0)
  assert.equal(criterionScore('adoption_reality', 5, 'declared', 'decision_maker'), 2.5)
  assert.equal(criterionScore('strategic_alignment', 5, 'declared', 'decision_maker'), 4.0)
})

// Extra: momentum trend — negative delta over 3 captures = EN PANNE + stagnation alert.
test('momentum: negative delta over 3 captures flags EN PANNE', () => {
  const mk = (round: number, v: number) => makeRound(round,
    { value_momentum: v, internal_momentum: v, strategic_alignment: v, open_objections: v, process_drag: v, external_friction: v },
    Object.fromEntries(['value_momentum', 'internal_momentum', 'strategic_alignment', 'open_objections', 'process_drag', 'external_friction'].map(k => [k, 'verified' as EvidenceLevel])),
  )
  const rounds = [mk(1, 5), mk(2, 4), mk(3, 4), mk(4, 3)]
  const info = momentumInfo(rounds, 4)
  assert.equal(info.status, 'EN_PANNE')
  assert.ok(info.delta !== null && info.delta < 0)
  assert.equal(info.trend, '↓')
  assert.equal(info.stagnant, true)
})
