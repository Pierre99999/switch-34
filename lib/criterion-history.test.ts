import { test } from 'node:test'
import assert from 'node:assert/strict'
import { criterionHistory, readingSince } from './criterion-history'
import type { DealRound } from './types'

function round(n: number, over: Record<string, unknown> = {}): DealRound {
  return {
    id: `r${n}`, deal_id: 'd1', round: n,
    evidence_levels: {}, authority_levels: {}, rationales: {}, capture_notes: {},
    ...over,
  } as unknown as DealRound
}

/** A round saying something about compelling_reason. */
function said(n: number, score: number | null, rationale: string, evidence = 'corroborated') {
  return round(n, {
    compelling_reason: score,
    evidence_levels: score === null ? {} : { compelling_reason: evidence },
    rationales: rationale ? { compelling_reason: rationale } : {},
  })
}

test('rounds that never knew anything are left out', () => {
  const rounds = [round(1), said(2, 3, 'Marie évoque la rétention.'), round(3)]
  const h = criterionHistory(rounds, 'compelling_reason')
  // Round 3 inherited nothing here, so only round 2 has something to show.
  assert.deepEqual(h.map(s => s.round), [2])
})

test('most recent first', () => {
  const rounds = [said(1, 2, 'a'), said(2, 3, 'b'), said(3, 4, 'c')]
  assert.deepEqual(criterionHistory(rounds, 'compelling_reason').map(s => s.round), [3, 2, 1])
})

test('a round that only inherited is not marked as a change', () => {
  // Round 3 carries round 2's wording and score untouched.
  const rounds = [said(1, 2, 'a'), said(2, 3, 'b'), said(3, 3, 'b')]
  const h = criterionHistory(rounds, 'compelling_reason')
  assert.equal(h.find(s => s.round === 3)?.changed, false)
  assert.equal(h.find(s => s.round === 2)?.changed, true)
})

test('a changed evidence level counts as a change, even at the same score', () => {
  const rounds = [
    said(1, 3, 'Le DAF chiffre la perte.', 'declared'),
    said(2, 3, 'Le DAF chiffre la perte.', 'verified'),
  ]
  assert.equal(criterionHistory(rounds, 'compelling_reason').find(s => s.round === 2)?.changed, true)
})

test('the first round to say anything is always a change', () => {
  assert.equal(criterionHistory([said(1, 2, 'a')], 'compelling_reason')[0].changed, true)
})

test('the reading is dated from the round that last changed it', () => {
  const rounds = [said(1, 2, 'a'), said(2, 3, 'b'), said(3, 3, 'b'), said(4, 3, 'b')]
  // Untouched since round 2, however many rounds have passed since.
  assert.equal(readingSince(rounds, 'compelling_reason', 4), 2)
  assert.equal(readingSince(rounds, 'compelling_reason', 1), 1)
})

test('a criterion nobody ever mentioned has no date', () => {
  assert.equal(readingSince([round(1), round(2)], 'compelling_reason', 2), null)
  assert.deepEqual(criterionHistory([round(1)], 'compelling_reason'), [])
})

test('history stops at the round being looked at', () => {
  const rounds = [said(1, 2, 'a'), said(2, 3, 'b'), said(3, 4, 'c')]
  assert.deepEqual(criterionHistory(rounds, 'compelling_reason', 2).map(s => s.round), [2, 1])
})

test('an unscored round with a rationale still counts', () => {
  // The engine can write a sentence without being able to score.
  const rounds = [said(1, null, 'Rien de chiffré, mais le sujet est venu.')]
  const h = criterionHistory(rounds, 'compelling_reason')
  assert.equal(h.length, 1)
  assert.equal(h[0].score, null)
})
