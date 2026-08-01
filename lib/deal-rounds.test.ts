import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inheritedRoundFields, scoreUpdateFromSuggestions } from './deal-rounds'
import type { DealRound } from './types'

function round(over: Partial<DealRound> & Record<string, unknown> = {}): DealRound {
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

// ── inheritedRoundFields ──────────────────────────────────────

test('no previous round carries nothing', () => {
  assert.deepEqual(inheritedRoundFields(null), {})
  assert.deepEqual(inheritedRoundFields(undefined), {})
})

test('carries scored criteria and skips unscored ones', () => {
  const got = inheritedRoundFields(round({ urgency: 4, impact: null, compelling_reason: 2 }))
  assert.equal(got.urgency, 4)
  assert.equal(got.compelling_reason, 2)
  assert.ok(!('impact' in got), 'an unscored criterion must not be written as null')
})

test('a zero score is carried, not treated as absent', () => {
  const got = inheritedRoundFields(round({ urgency: 0 }))
  assert.equal(got.urgency, 0)
})

test('carries authority_levels — the field the transcript import used to drop', () => {
  const got = inheritedRoundFields(round({ authority_levels: { urgency: 'decision_maker' } }))
  assert.deepEqual(got.authority_levels, { urgency: 'decision_maker' })
})

test('carries evidence levels and rationales, but not empty maps', () => {
  const withMaps = inheritedRoundFields(round({
    evidence_levels: { urgency: 'corroborated' },
    rationales: { urgency: 'Kevin cited a deadline.' },
  }))
  assert.deepEqual(withMaps.evidence_levels, { urgency: 'corroborated' })
  assert.deepEqual(withMaps.rationales, { urgency: 'Kevin cited a deadline.' })

  const empty = inheritedRoundFields(round())
  assert.ok(!('evidence_levels' in empty))
  assert.ok(!('rationales' in empty))
  assert.ok(!('authority_levels' in empty))
})

// ── scoreUpdateFromSuggestions ────────────────────────────────

test('applies scores, evidence, rationales and declarations', () => {
  const got = scoreUpdateFromSuggestions(round(), {
    urgency: { score: 4, evidence: 'corroborated', rationale: 'Deadline named.', declarations: [{ role: 'decideur' }] },
  })
  assert.equal(got.urgency, 4)
  assert.deepEqual(got.evidence_levels, { urgency: 'corroborated' })
  assert.deepEqual(got.rationales, { urgency: 'Deadline named.' })
  assert.deepEqual(got.declarations, { urgency: [{ role: 'decideur' }] })
})

test('merges over what the round already holds', () => {
  const got = scoreUpdateFromSuggestions(
    round({ evidence_levels: { impact: 'declared' }, rationales: { impact: 'Earlier read.' } }),
    { urgency: { score: 3, evidence: 'declared' } },
  )
  assert.deepEqual(got.evidence_levels, { impact: 'declared', urgency: 'declared' })
  assert.deepEqual(got.rationales, { impact: 'Earlier read.' }, 'an untouched criterion keeps its rationale')
})

test('a null score leaves the criterion alone', () => {
  const got = scoreUpdateFromSuggestions(round({ urgency: 3 }), { urgency: { score: null, evidence: 'declared' } })
  assert.ok(!('urgency' in got), 'null must not overwrite an existing score')
  assert.deepEqual(got.evidence_levels, { urgency: 'declared' })
})

test('a score of zero is applied', () => {
  const got = scoreUpdateFromSuggestions(round(), { urgency: { score: 0 } })
  assert.equal(got.urgency, 0)
})

test('no suggestions still returns the round maps unchanged', () => {
  const got = scoreUpdateFromSuggestions(round({ evidence_levels: { urgency: 'verified' } }), {})
  assert.deepEqual(got.evidence_levels, { urgency: 'verified' })
  assert.deepEqual(got.rationales, {})
  assert.deepEqual(got.declarations, {})
})
