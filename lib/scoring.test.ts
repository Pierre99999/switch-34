// Unit tests for the Switch scoring engine (acceptance criteria C6–C9).
// Run: npm run test:scoring
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { gateInfo, gateScore, momentumInfo, criterionScore, dealScore, prescriptions, MOMENTUM_WEIGHTS, MOMENTUM_BRAKES } from './scoring'
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
    open_objections: 5, budget: 5, competition: 5,
    // external_friction intentionally missing = never explored
  }
  const evidence: Record<string, EvidenceLevel> = Object.fromEntries(
    Object.keys(base).map(k => [k, 'verified' as EvidenceLevel])
  )
  const round = makeRound(1, base, evidence)
  const withMissing = gateScore(round, 4)
  // All explored at 5 would be 5.0; the missing brake costs its own weight × 5,
  // whatever that weight currently is.
  const expected = Math.round((5 - MOMENTUM_WEIGHTS.external_friction * 5) * 10) / 10
  assert.equal(withMissing, expected)
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
  assert.equal(info.lockVariable, 'concerns_fit')
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

test('the deal score averages the gates that have been opened', () => {
  // Nothing captured at all: no number to show, not a zero.
  assert.equal(dealScore(null), null)
  assert.equal(dealScore(makeRound(1, {}, {})), null)

  // Only gate 1 scored — the mean is gate 1, not gate 1 divided by four.
  const scores = Object.fromEntries(GATE1_VARS.map(v => [v, 4]))
  const evidence = Object.fromEntries(GATE1_VARS.map(v => [v, 'verified' as EvidenceLevel]))
  const g1 = makeRound(1, scores, evidence)
  assert.equal(dealScore(g1), gateScore(g1, 1))
})

test('a corroborated but weak criterion is to be sharpened, not corroborated again', () => {
  // The bug: the panel showed "Corroboré" while the focus said "à corroborer"
  // — asking for a second voice on something that already had one.
  const r = makeRound(1, { compelling_reason: 3 }, { compelling_reason: 'corroborated' })
  const p = prescriptions(r).find(x => x.variable === 'compelling_reason')
  assert.equal(p?.kind, 'PRECISER')
})

test('a single voice is still to be corroborated', () => {
  const r = makeRound(1, { compelling_reason: 3 }, { compelling_reason: 'declared' })
  assert.equal(prescriptions(r).find(x => x.variable === 'compelling_reason')?.kind, 'CORROBORER')
})

test('nothing said at all stays a blind spot', () => {
  assert.equal(prescriptions(makeRound(1, {}, {})).find(x => x.variable === 'urgency')?.kind, 'MANQUANT')
})

test('an unfavourable decisive criterion is still to be settled', () => {
  const r = makeRound(1, { compelling_reason: 1 }, { compelling_reason: 'verified' })
  assert.equal(prescriptions(r).find(x => x.variable === 'compelling_reason')?.kind, 'NEGATIF')
})

test('a criterion at or above the threshold prescribes nothing', () => {
  const r = makeRound(1, { compelling_reason: 5 }, { compelling_reason: 'verified' })
  assert.equal(prescriptions(r).find(x => x.variable === 'compelling_reason'), undefined)
})

test('the momentum weights still sum to one', () => {
  // Adding budget and competition without rebalancing would silently rescale
  // every momentum score in the product.
  const total = Object.values(MOMENTUM_WEIGHTS).reduce((a, b) => a + b, 0)
  assert.ok(Math.abs(total - 1) < 1e-9, `momentum weights sum to ${total}`)
})

test('every momentum brake is weighed, and process drag is no longer either', () => {
  for (const b of MOMENTUM_BRAKES) {
    assert.ok(MOMENTUM_WEIGHTS[b] !== undefined, `${b} is a brake with no weight`)
  }
  assert.equal(MOMENTUM_WEIGHTS.process_drag, undefined)
  assert.ok(!MOMENTUM_BRAKES.has('process_drag'))
})

test('an unexplored budget drags the momentum down', () => {
  // Brakes count 0 when null: absence of information is not absence of a brake.
  const explored = makeRound(1, {
    value_momentum: 4, internal_momentum: 4, strategic_alignment: 4,
    open_objections: 4, budget: 4, competition: 4, external_friction: 4,
  }, {})
  const notExplored = makeRound(1, {
    value_momentum: 4, internal_momentum: 4, strategic_alignment: 4,
    open_objections: 4, competition: 4, external_friction: 4,
  }, {})
  assert.ok(gateScore(notExplored, 4)! < gateScore(explored, 4)!)
})
