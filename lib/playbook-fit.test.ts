import { test } from 'node:test'
import assert from 'node:assert/strict'
import { matchActorRole, actorCoverage, type DealContact } from './playbook-fit'
import { emptyPlaybook, type Playbook } from './playbook'

function withActors(rows: { role: string; why?: string; risk?: string }[]): Playbook {
  return {
    ...emptyPlaybook('fr'),
    a5_actors: rows.map(r => ({ role: r.role, why: r.why ?? '', risk: r.risk ?? '' })),
  }
}

test('matches role names in French, accented or not', () => {
  assert.equal(matchActorRole('Décideur'), 'decision_maker')
  assert.equal(matchActorRole('decideur'), 'decision_maker')
  assert.equal(matchActorRole('Gardien du budget'), 'budget_guardian')
  assert.equal(matchActorRole('Champion interne'), 'champion')
  assert.equal(matchActorRole('Utilisateur final'), 'user')
  assert.equal(matchActorRole('Bloqueur probable'), 'blocker')
})

test('matches role names in English', () => {
  assert.equal(matchActorRole('Decision maker'), 'decision_maker')
  assert.equal(matchActorRole('Budget holder'), 'budget_guardian')
  assert.equal(matchActorRole('End user'), 'user')
})

test('a technical decision maker is a reviewer, not a decision maker', () => {
  // The longer phrase must win, or every technical buyer would be miscounted
  // as covering the decision-maker requirement.
  assert.equal(matchActorRole('Décideur technique'), 'reviewer')
  assert.equal(matchActorRole('Acheteur technique'), 'reviewer')
})

test('unrecognised wording returns null rather than guessing', () => {
  assert.equal(matchActorRole('Comité de pilotage'), null)
  assert.equal(matchActorRole(''), null)
  assert.equal(matchActorRole('   '), null)
})

test('an empty A5 makes the axis inapplicable', () => {
  const cov = actorCoverage(emptyPlaybook('fr'), [{ name: 'Ana', actor_types: ['champion'] }])
  assert.equal(cov.applicable, false)
  assert.equal(cov.total, 0)
})

test('covers a requirement when a contact carries the role', () => {
  const pb = withActors([{ role: 'Décideur' }, { role: 'Gardien du budget', risk: 'Le budget saute en fin de cycle.' }])
  const contacts: DealContact[] = [{ name: 'Ana', actor_types: ['decision_maker'] }]
  const cov = actorCoverage(pb, contacts)

  assert.equal(cov.applicable, true)
  assert.equal(cov.total, 2)
  assert.equal(cov.covered, 1)
  assert.deepEqual(cov.requirements[0].coveredBy, ['Ana'])
  assert.equal(cov.missing.length, 1)
  assert.equal(cov.missing[0].risk, 'Le budget saute en fin de cycle.')
})

test('a contact wearing several hats covers several requirements', () => {
  const pb = withActors([{ role: 'Décideur' }, { role: 'Gardien du budget' }])
  const contacts: DealContact[] = [{ name: 'Medhi', actor_types: ['decision_maker', 'budget_guardian'] }]
  const cov = actorCoverage(pb, contacts)
  assert.equal(cov.covered, 2)
  assert.equal(cov.missing.length, 0)
})

test('unknown-tagged contacts cover nothing', () => {
  const pb = withActors([{ role: 'Décideur' }])
  const cov = actorCoverage(pb, [{ name: 'Sans rôle', actor_types: ['unknown'] }])
  assert.equal(cov.covered, 0)
  assert.equal(cov.missing.length, 1)
})

test('falls back to the legacy single actor_type', () => {
  const pb = withActors([{ role: 'Champion' }])
  const cov = actorCoverage(pb, [{ name: 'Léa', actor_type: 'champion' }])
  assert.equal(cov.covered, 1)
})

test('unrecognised A5 lines are reported, not counted', () => {
  const pb = withActors([{ role: 'Décideur' }, { role: 'Comité de pilotage' }])
  const cov = actorCoverage(pb, [{ name: 'Ana', actor_types: ['decision_maker'] }])
  assert.equal(cov.total, 1, 'only recognised roles count towards coverage')
  assert.equal(cov.covered, 1)
  assert.equal(cov.unmatched.length, 1)
  assert.equal(cov.unmatched[0].label, 'Comité de pilotage')
})
