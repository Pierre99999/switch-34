import { test } from 'node:test'
import assert from 'node:assert/strict'
import { portfolioActions, portfolioPositions, daysSinceActivity } from './mission-control'
import type { Deal, DealRound } from './types'

const NOW = Date.parse('2026-08-06T09:00:00Z')
const daysAgo = (n: number) => new Date(NOW - n * 24 * 60 * 60 * 1000).toISOString()

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
    capture_notes: {}, updated_at: daysAgo(1),
    ...over,
  } as unknown as DealRound
}

const captured = (n: number, over: Record<string, unknown> = {}) =>
  round(n, { briefing_line: 'x', capture_notes: { q: 'said' }, ...over })

const briefed = (n: number, over: Record<string, unknown> = {}) =>
  round(n, { briefing_line: 'x', ...over })

// ── Actions ──────────────────────────────────────────────────

test('a closed deal asks for nothing', () => {
  const d = deal({ id: 'won', status: 'won' })
  assert.deepEqual(portfolioActions({ deals: [d], roundsByDeal: { won: [captured(1)] }, now: NOW }), [])
})

test('walking away comes before advancing', () => {
  // The cheapest decision available, and the one a seller avoids longest.
  const avoid = deal({ id: 'avoid' })
  avoid.playbook_fit = {
    axes: [{ key: 'segment', verdict: 'mismatch', summary: '', reason: '', playbook_ref: '' }],
    basis: 'conversation', computed_at: '', avoid_list_hit: true,
  } as unknown as Deal['playbook_fit']
  const normal = deal({ id: 'normal' })
  const actions = portfolioActions({
    deals: [normal, avoid],
    roundsByDeal: { avoid: [captured(1)], normal: [round(1)] },
    now: NOW,
  })
  assert.equal(actions[0].prospect, 'avoid')
  assert.equal(actions[0].kind, 'exit')
})

test('one action per deal, never a to-do list per deal', () => {
  const d = deal({ id: 'busy' })
  const actions = portfolioActions({
    deals: [d],
    roundsByDeal: { busy: [briefed(1)] },
    now: NOW,
  })
  assert.equal(actions.length, 1)
})

test('a briefed round that was never captured asks for the transcript', () => {
  const d = deal({ id: 'a' })
  const a = portfolioActions({ deals: [d], roundsByDeal: { a: [briefed(1)] }, now: NOW })[0]
  assert.equal(a.kind, 'capture')
})

test('a missing required actor outranks the next briefing', () => {
  const d = deal({ id: 'a' })
  const a = portfolioActions({
    deals: [d],
    roundsByDeal: { a: [captured(1)] },
    coverageByDeal: {
      a: {
        applicable: true, requirements: [], covered: 0, total: 1, unmatched: [],
        missing: [{ label: 'Le CEO', why: '', risk: 'Rien ne se signe sans lui.', actor: 'decision_maker', covered: false, coveredBy: [] }],
      },
    },
    now: NOW,
  })[0]
  assert.equal(a.kind, 'actor')
  assert.match(a.title, /le ceo/i)
})

test('a deal nobody has touched for twelve days asks to be revived', () => {
  const d = deal({ id: 'cold' })
  const a = portfolioActions({
    deals: [d],
    roundsByDeal: { cold: [captured(1, { updated_at: daysAgo(14) })] },
    now: NOW,
  })[0]
  assert.equal(a.kind, 'revive')
  assert.match(a.title, /14 jours/)
})

test('no action ever promises a score', () => {
  // The mockup showed "+0,8 sur Momentum". Nothing in the engine knows that,
  // and the method's rule is that the outcome is never predicted.
  const deals = [deal({ id: 'a' }), deal({ id: 'b' })]
  const actions = portfolioActions({
    deals,
    roundsByDeal: { a: [briefed(1)], b: [captured(1, { updated_at: daysAgo(30) })] },
    now: NOW,
  })
  assert.ok(actions.length > 0)
  for (const a of actions) {
    assert.ok(!/[+-]\s?\d[.,]\d/.test(a.unlocks), `predicted a delta: ${a.unlocks}`)
    assert.ok(a.unlocks.length > 3, a.unlocks)
    assert.ok(a.why.length > 10, a.why)
  }
})

// ── The map ──────────────────────────────────────────────────

test('advancement counts gates carried, not rounds held', () => {
  // A deal on its fifth conversation with gate 1 still open has not advanced.
  const many = [1, 2, 3, 4, 5].map(n => captured(n))
  const [pos] = portfolioPositions({
    deals: [deal({ id: 'a', current_round: 5 })],
    roundsByDeal: { a: many },
    now: NOW,
  })
  assert.ok(pos.advancement < 0.34, `${pos.advancement}`)
})

test('a gate at risk marks the deal high risk', () => {
  const r = captured(1, {
    real_business_problem: 1, compelling_reason: 1, concerns_fit: 3,
    stakeholder_map: 3, personal_pain_linkage: 3,
  })
  const [pos] = portfolioPositions({ deals: [deal({ id: 'a' })], roundsByDeal: { a: [r] }, now: NOW })
  assert.equal(pos.risk, 'high')
  assert.equal(pos.alert, true)
})

test('a long-untouched deal is medium risk even when its gates look fine', () => {
  const r = captured(1, { updated_at: daysAgo(40) })
  const [pos] = portfolioPositions({ deals: [deal({ id: 'a' })], roundsByDeal: { a: [r] }, now: NOW })
  assert.equal(pos.risk, 'medium')
})

test('closed deals are off the map', () => {
  assert.deepEqual(
    portfolioPositions({ deals: [deal({ id: 'a', status: 'lost' })], roundsByDeal: { a: [captured(1)] }, now: NOW }),
    [],
  )
})

test('the label is a score out of five, never a probability', () => {
  const [pos] = portfolioPositions({ deals: [deal({ id: 'a' })], roundsByDeal: { a: [captured(1, { urgency: 4 })] }, now: NOW })
  assert.ok(pos.score === null || (pos.score >= 0 && pos.score <= 5))
})

test('activity is read from captures, not from every touch of the row', () => {
  assert.equal(daysSinceActivity([], NOW), null)
  assert.equal(daysSinceActivity([round(1, { updated_at: daysAgo(3) })], NOW), null)
  assert.equal(daysSinceActivity([captured(1, { updated_at: daysAgo(3) })], NOW), 3)
})
