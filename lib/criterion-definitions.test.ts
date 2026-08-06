import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CRITERION_DEFINITIONS, criterionDefinitionList, ALL_SCORED_VARIABLES } from './criterion-definitions'
import { GATE_WEIGHTS, MOMENTUM_WEIGHTS } from './scoring'

test('every scored criterion has a definition', () => {
  // A criterion the prompt cannot describe is a criterion the model skips —
  // which is exactly how gate 3 stayed empty.
  for (const v of ALL_SCORED_VARIABLES) {
    assert.ok(CRITERION_DEFINITIONS[v], `${v} has no definition`)
  }
})

test('every criterion the engine weighs has a definition', () => {
  const weighed = [
    ...Object.values(GATE_WEIGHTS).flatMap(g => Object.keys(g)),
    ...Object.keys(MOMENTUM_WEIGHTS),
  ]
  for (const v of weighed) {
    assert.ok(CRITERION_DEFINITIONS[v], `${v} is weighed in a gate but never defined`)
  }
})

test('no definition is left as a bare label', () => {
  for (const [v, d] of Object.entries(CRITERION_DEFINITIONS)) {
    assert.ok(d.length > 60, `${v} is too thin to be useful to the model: "${d}"`)
    assert.ok(/evidence|Evidence|brake/.test(d), `${v} must say what counts as evidence`)
  }
})

test('gate 3 says explicitly that it is not only a post-sale question', () => {
  // The regression to guard: "can the product deliver" read as something only
  // a pilot could answer, so nothing was scored for several rounds.
  assert.match(CRITERION_DEFINITIONS.product_capability, /NOT limited to/)
  for (const v of ['product_capability', 'implementation_feasibility', 'adoption_reality', 'impact', 'urgency_resolution']) {
    assert.ok(CRITERION_DEFINITIONS[v].length > 120, `${v} needs the same depth as the gate 1 and 2 criteria`)
  }
})

test('the list keeps the variable name the tool schema uses', () => {
  const list = criterionDefinitionList(['urgency', 'impact'])
  assert.match(list, /^urgency: /m)
  assert.match(list, /^impact: /m)
  assert.equal(list.split('\n').length, 2)
})

test('an unknown variable degrades to its own name rather than crashing', () => {
  assert.equal(criterionDefinitionList(['nonsense']), 'nonsense')
})
