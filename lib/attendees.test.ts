import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeAttendees, rolesPresent, buildAttendeesContext, attendeesSummary,
} from './attendees'

test('a nameless entry is dropped, a roleless one is kept as unknown', () => {
  const got = normalizeAttendees([
    { name: '  Marie Dupont ', title: ' DAF ', actor_types: ['budget_guardian'] },
    { name: '   ' },
    { name: 'Henri', actor_types: [] },
    'nonsense',
  ])
  assert.deepEqual(got, [
    { name: 'Marie Dupont', title: 'DAF', actor_types: ['budget_guardian'] },
    { name: 'Henri', title: null, actor_types: ['unknown'] },
  ])
})

test('anything that is not a list yields nothing', () => {
  assert.deepEqual(normalizeAttendees(null), [])
  assert.deepEqual(normalizeAttendees({ name: 'Marie' }), [])
})

test('roles present ignore the unknown ones', () => {
  const a = normalizeAttendees([
    { name: 'Marie', actor_types: ['champion', 'user'] },
    { name: 'Henri', actor_types: ['unknown'] },
    { name: 'Paul', actor_types: ['champion'] },
  ])
  assert.deepEqual(rolesPresent(a).sort(), ['champion', 'user'])
})

test('no attendees means no block at all, never an empty heading', () => {
  assert.equal(buildAttendeesContext([]), '')
})

test('the block names who is there and what they can settle', () => {
  const ctx = buildAttendeesContext(normalizeAttendees([
    { name: 'Marie Dupont', title: 'DAF', actor_types: ['budget_guardian'] },
  ]))
  assert.match(ctx, /Marie Dupont \(DAF\)/)
  assert.match(ctx, /Gardien du budget/)
  assert.match(ctx, /settle the money/)
})

test('the block says which decisive roles are missing', () => {
  // The point of asking who is coming: knowing what this conversation cannot
  // establish, whatever questions are written.
  const ctx = buildAttendeesContext(normalizeAttendees([
    { name: 'Marie', actor_types: ['champion'] },
  ]))
  assert.match(ctx, /Not in the room:.*Décideur/)
  assert.match(ctx, /Gardien du budget/)
})

test('a full room is told so instead of being warned about nobody', () => {
  const ctx = buildAttendeesContext(normalizeAttendees([
    { name: 'A', actor_types: ['decision_maker'] },
    { name: 'B', actor_types: ['budget_guardian'] },
    { name: 'C', actor_types: ['user'] },
  ]))
  assert.ok(!ctx.includes('Not in the room'))
  assert.match(ctx, /Every decisive role is in the room/)
})

test('several people in the room is itself an instruction', () => {
  const one = buildAttendeesContext(normalizeAttendees([{ name: 'A', actor_types: ['champion'] }]))
  const two = buildAttendeesContext(normalizeAttendees([
    { name: 'A', actor_types: ['champion'] }, { name: 'B', actor_types: ['user'] },
  ]))
  assert.ok(!one.includes('disagree'))
  assert.match(two, /disagree/)
})

test('the summary stays short however many people come', () => {
  const many = normalizeAttendees([1, 2, 3, 4].map(n => ({ name: `P${n}`, actor_types: ['user'] })))
  assert.equal(attendeesSummary(many), 'P1, P2 (+2)')
  assert.equal(attendeesSummary([]), '')
})
