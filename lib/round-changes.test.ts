import { test } from 'node:test'
import assert from 'node:assert/strict'
import { roundChanges, topRisks } from './round-changes'
import { computeDealState } from './scoring'
import type { DealRound } from './types'

function round(n: number, over: Record<string, unknown> = {}): DealRound {
  return {
    id: `r${n}`, deal_id: 'd1', round: n,
    evidence_levels: {}, authority_levels: {}, rationales: {},
    declarations: {}, capture_notes: { q: 'said' },
    ...over,
  } as unknown as DealRound
}

test('a criterion heard for the first time on one voice is a claim, not a fact', () => {
  const rounds = [round(1, {
    compelling_reason: 3,
    evidence_levels: { compelling_reason: 'declared' },
  })]
  const c = roundChanges(rounds, 1)
  assert.deepEqual(c.claims, ['compelling_reason'])
  assert.deepEqual(c.confirmed, [])
})

test('a second voice on the same criterion is what counts as confirmed', () => {
  const rounds = [
    round(1, { compelling_reason: 3, evidence_levels: { compelling_reason: 'declared' } }),
    round(2, { compelling_reason: 3, evidence_levels: { compelling_reason: 'corroborated' } }),
  ]
  const c = roundChanges(rounds, 2)
  assert.deepEqual(c.confirmed, ['compelling_reason'])
})

test('a score that rises without new evidence is not news', () => {
  // The distinction the method rests on: a number moving because the seller
  // feels better about it is not a confirmation.
  const rounds = [
    round(1, { compelling_reason: 2, evidence_levels: { compelling_reason: 'corroborated' } }),
    round(2, { compelling_reason: 4, evidence_levels: { compelling_reason: 'corroborated' } }),
  ]
  const c = roundChanges(rounds, 2)
  assert.deepEqual(c.confirmed, [])
  assert.deepEqual(c.claims, [])
})

test('evidence falling back is not counted as a confirmation', () => {
  const rounds = [
    round(1, { urgency: 4, evidence_levels: { urgency: 'verified' } }),
    round(2, { urgency: 4, evidence_levels: { urgency: 'declared' } }),
  ]
  assert.deepEqual(roundChanges(rounds, 2).confirmed, [])
})

test('two people disagreeing on one criterion is a contradiction', () => {
  const rounds = [round(1, {
    urgency: 3,
    evidence_levels: { urgency: 'corroborated' },
    declarations: {
      urgency: [
        { role: 'champion', stance: 'pour', text: 'il faut y aller' },
        { role: 'gardien_du_budget', stance: 'contre', text: 'pas cette année' },
      ],
    },
  })]
  assert.deepEqual(roundChanges(rounds, 1).contradictions, ['urgency'])
})

test('everyone agreeing is not a contradiction', () => {
  const rounds = [round(1, {
    declarations: { urgency: [{ role: 'champion', stance: 'pour', text: 'oui' }] },
  })]
  assert.deepEqual(roundChanges(rounds, 1).contradictions, [])
})

test('a round that does not exist changes nothing', () => {
  assert.deepEqual(roundChanges([], 1), { confirmed: [], claims: [], contradictions: [] })
})

// ── Risks ────────────────────────────────────────────────────

const state = (rounds: DealRound[], n: number) => computeDealState(rounds, n)

test('a missing required actor is named as a risk', () => {
  const risks = topRisks({
    dealState: state([], 0),
    current: null,
    coverage: {
      applicable: true, requirements: [], covered: 0, total: 1, unmatched: [],
      missing: [{ label: 'Le CEO', why: '', risk: 'Rien ne se signe sans lui.', actor: 'decision_maker', covered: false, coveredBy: [] }],
    },
    fit: null,
  })
  assert.ok(risks.some(r => r.label.includes('Le CEO')))
})

test('the avoid list outranks everything', () => {
  const risks = topRisks({
    dealState: state([], 0),
    current: null,
    coverage: null,
    fit: { axes: [], basis: 'conversation', computed_at: '', avoid_list_hit: true },
  })
  assert.match(risks[0].label, /à fuir/)
})

test('never more than three, however bad the deal is', () => {
  const r = round(1, {
    compelling_reason: 1, personal_pain_linkage: 1, urgency: 1, urgency_resolution: 1,
    evidence_levels: {
      compelling_reason: 'verified', personal_pain_linkage: 'verified',
      urgency: 'verified', urgency_resolution: 'verified',
    },
  })
  const risks = topRisks({
    dealState: state([r], 1),
    current: r,
    coverage: {
      applicable: true, requirements: [], covered: 0, total: 2, unmatched: [],
      missing: [
        { label: 'Le CEO', why: '', risk: '', actor: 'decision_maker', covered: false, coveredBy: [] },
        { label: 'Le DAF', why: '', risk: '', actor: 'budget_guardian', covered: false, coveredBy: [] },
      ],
    },
    fit: { axes: [], basis: 'conversation', computed_at: '', avoid_list_hit: true },
  })
  assert.equal(risks.length, 3)
})

test('a healthy deal raises nothing', () => {
  const r = round(1, {
    compelling_reason: 5, personal_pain_linkage: 5, real_business_problem: 5,
    stakeholder_map: 5, concerns_fit: 5, urgency: 5, urgency_resolution: 5,
    evidence_levels: Object.fromEntries(
      ['compelling_reason', 'personal_pain_linkage', 'real_business_problem',
        'stakeholder_map', 'concerns_fit', 'urgency', 'urgency_resolution']
        .map(v => [v, 'verified']),
    ),
  })
  const risks = topRisks({ dealState: state([r], 1), current: r, coverage: null, fit: null })
  assert.deepEqual(risks, [])
})

test('every risk says what it is and why it matters', () => {
  const r = round(1, { urgency: 1, evidence_levels: { urgency: 'verified' } })
  for (const risk of topRisks({ dealState: state([r], 1), current: r, coverage: null, fit: null })) {
    assert.ok(risk.label.length > 5, risk.label)
    assert.ok(risk.why.length > 15, risk.why)
  }
})
