// Acceptance tests for voice-credit weighting (Switch_credit_de_voix.md §5).
// Run: npm run test:scoring
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evidenceFromDeclarations, type Declaration } from './voice-credit'

const d = (over: Partial<Declaration>): Declaration => ({ role: 'unknown', stance: 'pour', text: '', ...over })

// C1 — budget favorable: a lone user declares → DÉCLARÉ; the budget guardian
// alone → CORROBORÉ. Use the "urgency" criterion (gardien = 1.0, user = 0.4).
test('C1: budget guardian corroborates alone, user does not', () => {
  const user = evidenceFromDeclarations('urgency', [d({ role: 'utilisateur', contact: 'U' })])
  assert.equal(user.level, 'declared')
  const guardian = evidenceFromDeclarations('urgency', [d({ role: 'gardien_du_budget', contact: 'G' })])
  assert.equal(guardian.level, 'corroborated')
})

// C2 — champion alone (0.7) → DÉCLARÉ; champion + user concordant (0.7 + 0.4 = 1.1) → CORROBORÉ.
test('C2: champion alone declared, champion + user corroborated', () => {
  const alone = evidenceFromDeclarations('urgency', [d({ role: 'champion', contact: 'C' })])
  assert.equal(alone.level, 'declared')
  const pair = evidenceFromDeclarations('urgency', [
    d({ role: 'champion', contact: 'C' }),
    d({ role: 'utilisateur', contact: 'U' }),
  ])
  assert.equal(pair.level, 'corroborated')
  assert.ok(Math.abs(pair.credit - 1.1) < 1e-9)
})

// C3 — blocker alone, favorable, on adoption_reality (0.7 × 1.5 = 1.05) → CORROBORÉ.
test('C3: favorable blocker corroborates adoption alone (against-interest)', () => {
  const r = evidenceFromDeclarations('adoption_reality', [d({ role: 'bloqueur', stance: 'pour', contact: 'B' })])
  assert.equal(r.level, 'corroborated')
  assert.ok(Math.abs(r.credit - 1.05) < 1e-9)
  assert.equal(r.breakdown[0].amplified, true)
})

// C4 — decideur and acheteur_technique contradict → S ≤ 2, DÉCLARÉ, arbitration prescription.
test('C4: heavy contradiction forces declared + S<=2 + arbitration', () => {
  const r = evidenceFromDeclarations('value_solution_fit', [
    d({ role: 'acheteur_technique', stance: 'pour', contact: 'AT' }),
    d({ role: 'decideur', stance: 'contre', contact: 'DM' }),
  ])
  assert.equal(r.contradiction, true)
  assert.equal(r.level, 'declared')
  assert.equal(r.forceMaxSignal, 2)
  assert.ok(r.prescriptions.some(p => p.startsWith('Contradiction sur')))
})

// C5 — an unfavorable champion raises an alarm.
test('C5: unfavorable champion raises an alarm', () => {
  const r = evidenceFromDeclarations('impact', [d({ role: 'champion', stance: 'contre', contact: 'C' })])
  assert.ok(r.alarms.some(a => a.startsWith("Signal d'alarme")))
})

// C6 — two declarations from the same person → only the most recent counts.
test('C6: same person twice counts once (most recent)', () => {
  const r = evidenceFromDeclarations('urgency', [
    d({ role: 'gardien_du_budget', contact: 'G', date: '2026-01-01' }),
    d({ role: 'utilisateur', contact: 'G', date: '2026-02-01' }), // same person, later, now peripheral
  ])
  assert.equal(r.breakdown.length, 1)
  assert.equal(r.level, 'declared') // most recent = user 0.4
})

// C7 — a contact without a role → w = 0.4 + "qualify the role" prescription.
test('C7: unknown role → 0.4 and qualification prescription', () => {
  const r = evidenceFromDeclarations('urgency', [d({ role: 'unknown', contact: 'X' })])
  assert.equal(r.breakdown[0].weight, 0.4)
  assert.ok(r.prescriptions.some(p => p.includes('Qualifier le rôle de X')))
})

// C8 — any quantified declaration → CHIFFRÉ regardless of the credit.
test('C8: quantified declaration is verified regardless of credit', () => {
  const r = evidenceFromDeclarations('urgency', [d({ role: 'utilisateur', quantified: true, contact: 'U' })])
  assert.equal(r.level, 'verified')
})

// Extra — no declarations at all → AUCUNE.
test('no declarations → level null (AUCUNE)', () => {
  assert.equal(evidenceFromDeclarations('urgency', []).level, null)
  assert.equal(evidenceFromDeclarations('urgency', undefined).level, null)
})
