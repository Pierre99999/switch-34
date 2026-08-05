import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LOST_REASONS, WON_REASONS, reasonsFor, reasonLabel, reasonGate,
  isCloseReason, outcomeUpdate, todayISO,
} from './deal-outcome'

test('every reason key is unique across both lists', () => {
  const keys = [...LOST_REASONS, ...WON_REASONS].map(r => r.key)
  // 'other' is deliberately in both — it is the same reason.
  const distinct = keys.filter(k => k !== 'other')
  assert.equal(new Set(distinct).size, distinct.length)
})

test('a lost deal is not offered the reasons for winning', () => {
  assert.deepEqual(reasonsFor('lost'), LOST_REASONS)
  assert.deepEqual(reasonsFor('won'), WON_REASONS)
  assert.ok(!reasonsFor('lost').some(r => r.key === 'champion'))
})

test('each reason points at a gate, so a corpus can be read by gate', () => {
  for (const r of [...LOST_REASONS, ...WON_REASONS]) {
    if (r.key === 'other') { assert.equal(r.gate, null); continue }
    assert.ok(r.gate !== null && r.gate >= 1 && r.gate <= 4, `${r.key} needs a gate`)
  }
  assert.equal(reasonGate('no_compelling_reason'), 1)
  assert.equal(reasonGate('status_quo'), 4)
  assert.equal(reasonGate('nonsense'), null)
})

test('labels resolve, and unknown keys do not crash', () => {
  assert.ok((reasonLabel('budget') ?? '').length > 5)
  assert.equal(reasonLabel('nonsense'), null)
  assert.equal(reasonLabel(null), null)
})

test('only real keys are accepted', () => {
  assert.ok(isCloseReason('competitor'))
  assert.ok(!isCloseReason('churn'))
  assert.ok(!isCloseReason(3))
})

test('the row written is flat and keeps an empty note as null', () => {
  const row = outcomeUpdate('lost', {
    reason: 'budget', round: 3, closed_at: '2026-08-05', note: '   ',
  })
  assert.deepEqual(row, {
    status: 'lost', close_reason: 'budget', close_round: 3,
    closed_at: '2026-08-05', close_note: null,
  })
  assert.equal(outcomeUpdate('won', {
    reason: 'champion', round: 2, closed_at: '2026-08-05', note: ' Henri ',
  }).close_note, 'Henri')
})

test('todayISO is local, not UTC', () => {
  // A deal closed at 9pm in Paris must not be dated tomorrow.
  assert.equal(todayISO(new Date(2026, 7, 5, 21, 30)), '2026-08-05')
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/)
})
