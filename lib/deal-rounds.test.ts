import { test } from 'node:test'
import assert from 'node:assert/strict'
import { inheritedRoundFields, scoreUpdateFromSuggestions, isRoundUnstarted, roundState, nextStep } from './deal-rounds'
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

// ── isRoundUnstarted ──────────────────────────────────────────

test('a freshly created round is unstarted', () => {
  // This is the round left behind when briefing generation is interrupted.
  assert.equal(isRoundUnstarted(round()), true)
})

test('a missing round is not "unstarted" — there is nothing to reuse', () => {
  assert.equal(isRoundUnstarted(null), false)
  assert.equal(isRoundUnstarted(undefined), false)
})

test('a briefed round is started', () => {
  assert.equal(isRoundUnstarted(round({ briefing_line: 'The deal hinges on urgency.' })), false)
})

test('a captured round is started, even with no briefing', () => {
  // The transcript-import path creates rounds with capture and no briefing.
  assert.equal(isRoundUnstarted(round({ capture_notes: { q1: 'Kevin said the margin is slipping.' } })), false)
})

test('whitespace-only capture notes do not count as started', () => {
  assert.equal(isRoundUnstarted(round({ capture_notes: { q1: '   ', __free__: '' } })), true)
})

test('a scored round is started', () => {
  assert.equal(isRoundUnstarted(round({ urgency: 3 })), false)
})

test('a round scored zero is started', () => {
  assert.equal(isRoundUnstarted(round({ urgency: 0 })), false)
})

// ── roundState ────────────────────────────────────────────────

test('a round with no briefing is unstarted', () => {
  assert.equal(roundState(round()), 'UNSTARTED')
  assert.equal(roundState(null), 'UNSTARTED')
})

test('a briefed round with nothing captured is BRIEFED', () => {
  assert.equal(roundState(round({ briefing_line: 'Urgency is the question.' })), 'BRIEFED')
})

test('inherited scores do not make a round SCORED', () => {
  // The bug: a new round carries the previous round's scores from the moment
  // it is created, so "has a score" was true before the conversation had
  // happened — and the dashboard offered the NEXT round's briefing.
  const r = round({ briefing_line: 'Urgency is the question.', urgency: 4, impact: 3 })
  assert.equal(roundState(r), 'BRIEFED')
})

test('a captured round is SCORED', () => {
  const r = round({ briefing_line: 'Urgency is the question.', capture_notes: { q1: 'Kevin named a deadline.' } })
  assert.equal(roundState(r), 'SCORED')
})

test('whitespace-only capture does not make a round SCORED', () => {
  const r = round({ briefing_line: 'Urgency.', capture_notes: { q1: '  ', __free__: '' } })
  assert.equal(roundState(r), 'BRIEFED')
})

test('capture with no briefing line yet reads as unstarted', () => {
  // Transient: an imported past conversation has no briefing, and only gets a
  // briefing_line once the post-conversation read has been written.
  assert.equal(roundState(round({ capture_notes: { q1: 'Said something.' } })), 'UNSTARTED')
})

// ── nextStep ──────────────────────────────────────────────────

const activeDeal = (current_round: number) => ({ current_round, status: 'active' })

test('a brand new deal waits on its first briefing', () => {
  assert.deepEqual(nextStep(activeDeal(0), []), { kind: 'brief', round: 1 })
})

test('a round created but never briefed still waits on the briefing', () => {
  const r = round({ round: 1 })
  assert.deepEqual(nextStep(activeDeal(1), [r]), { kind: 'brief', round: 1 })
})

test('a briefed round waits on the conversation', () => {
  const r = round({ round: 2, briefing_line: 'Urgency.' })
  assert.deepEqual(nextStep(activeDeal(2), [r]), { kind: 'capture', round: 2 })
})

test('inherited scores do not turn a briefed round into a finished one', () => {
  // Same trap as the dashboard: a round carries the previous scores from birth.
  const r = round({ round: 2, briefing_line: 'Urgency.', urgency: 4 })
  assert.deepEqual(nextStep(activeDeal(2), [r]), { kind: 'capture', round: 2 })
})

test('a captured round moves the deal on to the next one', () => {
  const r = round({ round: 2, briefing_line: 'Urgency.', capture_notes: { q1: 'Kevin named a deadline.' } })
  assert.deepEqual(nextStep(activeDeal(2), [r]), { kind: 'next_round', round: 3 })
})

test('a closed deal waits on nothing', () => {
  const r = round({ round: 2, briefing_line: 'Urgency.' })
  assert.equal(nextStep({ current_round: 2, status: 'won' }, [r]).kind, 'closed')
  assert.equal(nextStep({ current_round: 2, status: 'lost' }, [r]).kind, 'closed')
  assert.equal(nextStep({ current_round: 2, status: 'paused' }, [r]).kind, 'closed')
})

test('rounds of other deals are ignored by the caller, not guessed at', () => {
  // nextStep reads only the round matching current_round.
  const other = round({ round: 5, briefing_line: 'Elsewhere.' })
  assert.deepEqual(nextStep(activeDeal(2), [other]), { kind: 'brief', round: 2 })
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
