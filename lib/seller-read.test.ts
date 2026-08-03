import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeSellerRead, readGap, buildSellerReadContext } from './seller-read'
import type { DealRound } from './types'

// Gate 1 weights: compelling_reason .30, personal_pain_linkage .30,
// real_business_problem .20, stakeholder_map .10, concerns_fit .10.
// A missing criterion counts as 0, so a full house is needed for a high score.
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

const weakGate1 = round({
  real_business_problem: 2, compelling_reason: 2, concerns_fit: 2,
  stakeholder_map: 2, personal_pain_linkage: 2,
  evidence_levels: {
    real_business_problem: 'declared', compelling_reason: 'declared', concerns_fit: 'declared',
    stakeholder_map: 'declared', personal_pain_linkage: 'declared',
  },
})

const strongGate1 = round({
  real_business_problem: 5, compelling_reason: 5, concerns_fit: 5,
  stakeholder_map: 5, personal_pain_linkage: 5,
  evidence_levels: {
    real_business_problem: 'verified', compelling_reason: 'verified', concerns_fit: 'verified',
    stakeholder_map: 'verified', personal_pain_linkage: 'verified',
  },
})

// ── normalizeSellerRead ───────────────────────────────────────

test('nothing in, nothing out', () => {
  assert.equal(normalizeSellerRead(null), null)
  assert.equal(normalizeSellerRead({}), null)
  assert.equal(normalizeSellerRead('nope'), null)
})

test('a note alone is a valid read', () => {
  // Sellers often have only the nagging feeling, not the ratings.
  const r = normalizeSellerRead({ note: 'Il a esquivé la question du budget.' })
  assert.equal(r?.note, 'Il a esquivé la question du budget.')
})

test('out-of-range values are dropped, not clamped', () => {
  const r = normalizeSellerRead({ engagement: 9, tone: 0, confidence: 4 })
  assert.equal(r?.engagement, undefined)
  assert.equal(r?.tone, undefined)
  assert.equal(r?.confidence, 4)
})

test('a blank note does not count as content', () => {
  assert.equal(normalizeSellerRead({ note: '   ' }), null)
})

// ── readGap ───────────────────────────────────────────────────

test('no gap without a confidence or without a round', () => {
  assert.equal(readGap(null, weakGate1), null)
  assert.equal(readGap({ note: 'hmm' }, weakGate1), null)
  assert.equal(readGap({ confidence: 5 }, null), null)
})

test('no gap when the gate has never been scored', () => {
  assert.equal(readGap({ confidence: 5 }, round()), null)
})

test('confident seller, weak evidence — optimistic', () => {
  const gap = readGap({ confidence: 5 }, weakGate1)
  assert.equal(gap?.kind, 'optimistic')
})

test('doubtful seller, strong evidence — pessimistic', () => {
  const gap = readGap({ confidence: 1 }, strongGate1)
  assert.equal(gap?.kind, 'pessimistic')
})

test('a small difference is not a gap', () => {
  // Sellers are not instruments. Crying wolf over one point would teach them
  // to ignore this entirely.
  const gap = readGap({ confidence: 3 }, weakGate1)
  assert.equal(gap?.kind, 'aligned')
})

// ── buildSellerReadContext ────────────────────────────────────

test('the context labels the read as unverified', () => {
  const ctx = buildSellerReadContext({ confidence: 5, tone: 5, engagement: 4 })
  assert.match(ctx, /NEVER use it as evidence/)
  assert.match(ctx, /never let it raise a score/)
})

test('a note is passed as a hypothesis to verify', () => {
  const ctx = buildSellerReadContext({ note: 'Il a esquivé le budget.' })
  assert.match(ctx, /Il a esquivé le budget\./)
  assert.match(ctx, /hypothesis to VERIFY/)
})

test('an empty read produces no context at all', () => {
  assert.equal(buildSellerReadContext(null), '')
})
