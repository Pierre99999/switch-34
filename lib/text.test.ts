import { test } from 'node:test'
import assert from 'node:assert/strict'
import { firstSentences, isTruncated } from './text'

test('a short text is returned whole', () => {
  assert.equal(firstSentences('Court.', 200), 'Court.')
  assert.equal(isTruncated('Court.', 200), false)
})

test('a decimal does not end a sentence', () => {
  // The bug: "La Gate 1 est franchie (3.9/5)" was cut to "La Gate 1 est franchie (3."
  const t = 'La Gate 1 est franchie (3.9/5) et la douleur personnelle est nette. La Gate 2 reste en construction faute de corroboration sur la valeur. Le momentum est le vrai point de risque.'
  const got = firstSentences(t, 200)
  assert.ok(!got.endsWith('(3.'), `cut inside a decimal: ${got}`)
  assert.ok(got.startsWith('La Gate 1 est franchie (3.9/5)'))
})

test('a period inside parentheses does not end a sentence', () => {
  const t = 'Henri est aligné (il l’a dit deux fois. Confirmé hier) et le budget reste flou. Le reste suit.'
  assert.ok(firstSentences(t, 60).includes('Confirmé hier)'))
})

test('takes whole sentences up to the budget', () => {
  const t = 'Une. Deux. Trois. Quatre. Cinq. Six. Sept. Huit. Neuf. Dix. Onze. Douze. Treize. Quatorze.'
  const got = firstSentences(t, 20)
  assert.ok(got.length <= 24, got)
  assert.ok(got.endsWith('.'), got)
})

test('never returns less than one sentence, even past the budget', () => {
  const long = 'Une phrase unique et particulièrement longue qui dépasse largement le budget imposé sans jamais offrir de point intermédiaire pour couper proprement. Puis une autre.'
  const got = firstSentences(long, 40)
  assert.ok(got.length > 40, 'a whole first sentence is better than a stump')
  assert.ok(got.endsWith('proprement.'))
})

test('a text with no sentence end is returned whole', () => {
  const t = 'Aucune ponctuation finale ici, juste une longue suite de mots qui continue encore et encore sans jamais s’arrêter'
  assert.equal(firstSentences(t, 20), t)
})

test('isTruncated reports whether anything was left out', () => {
  const t = 'Première phrase. Deuxième phrase qui rallonge nettement le texte au-delà du budget.'
  assert.equal(isTruncated(t, 20), true)
  assert.equal(isTruncated('Tout court.', 200), false)
})
