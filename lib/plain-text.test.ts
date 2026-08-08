import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toPlainText } from './plain-text'

test('headings become plain lines', () => {
  assert.equal(toPlainText('## Ce qui est établi\nKevin a chiffré la perte.'),
    'Ce qui est établi\nKevin a chiffré la perte.')
  assert.equal(toPlainText('###### Petit titre'), 'Petit titre')
})

test('bold and italic keep their words', () => {
  assert.equal(toPlainText('**Kevin** a dit *non* clairement.'), 'Kevin a dit non clairement.')
  assert.equal(toPlainText('__gras__ et _italique_'), 'gras et italique')
})

test('bullets become dashes that read as speech', () => {
  assert.equal(toPlainText('- Un point\n* Un autre\n• Un troisième'),
    '— Un point\n— Un autre\n— Un troisième')
})

test('a numbered list keeps its numbers', () => {
  // An ordered list is meaningful in an answer about priorities.
  assert.equal(toPlainText('1. Memory\n2. BD Gest'), '1. Memory\n2. BD Gest')
})

test('an asterisk inside a sentence is not treated as markup', () => {
  assert.equal(toPlainText('Le taux est de 3 * 2 points.'), 'Le taux est de 3 * 2 points.')
})

test('a quoted sentence survives untouched', () => {
  const q = '« On perd 3 % par mois », a dit Kevin (décideur) au round 2.'
  assert.equal(toPlainText(q), q)
})

test('code marks, links, quotes and rules go', () => {
  assert.equal(toPlainText('`urgency` est bas'), 'urgency est bas')
  assert.equal(toPlainText('Voir [le playbook](https://x.y) pour A2'), 'Voir le playbook pour A2')
  assert.equal(toPlainText('> Une citation'), 'Une citation')
  assert.equal(toPlainText('Avant\n\n---\n\nAprès'), 'Avant\n\nAprès')
})

test('blank lines collapse but paragraphs survive', () => {
  assert.equal(toPlainText('Un.\n\n\n\nDeux.'), 'Un.\n\nDeux.')
})

test('empty in, empty out', () => {
  assert.equal(toPlainText(''), '')
  assert.equal(toPlainText('   \n  '), '')
})

test('plain prose is returned exactly as written', () => {
  const prose = 'La porte 1 est franchie. La raison impérieuse ne repose que sur une voix, celle de Kevin.'
  assert.equal(toPlainText(prose), prose)
})
