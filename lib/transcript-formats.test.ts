import { test } from 'node:test'
import assert from 'node:assert/strict'
import { deflateRawSync } from 'node:zlib'
import {
  parseVtt, parseSrt, parseJsonTranscript, parseCsvTranscript, parseCsvRows,
  parsePlainTranscript, docxToText, parseTranscriptText, parseTranscriptFile,
} from './transcript-formats'

test('VTT: timestamps, cue numbers and voice tags are dropped', () => {
  const vtt = `WEBVTT

1
00:00:01.000 --> 00:00:04.000
<v Marie Dupont>Notre problème, c'est le churn.</v>

2
00:00:04.000 --> 00:00:07.000
<v Marie Dupont>On perd 3 % par mois.</v>

3
00:00:07.000 --> 00:00:09.000
<v Henri Colin>Le budget est bloqué jusqu'en mars.</v>
`
  const out = parseVtt(vtt)
  assert.deepEqual(out, [
    "Marie Dupont: Notre problème, c'est le churn. On perd 3 % par mois.",
    "Henri Colin: Le budget est bloqué jusqu'en mars.",
  ])
  assert.ok(!out.join('\n').includes('-->'))
})

test('VTT: rolling captions do not repeat the same line', () => {
  const vtt = `WEBVTT

00:00:01.000 --> 00:00:02.000
On perd des clients

00:00:02.000 --> 00:00:03.000
On perd des clients
`
  assert.equal(parseVtt(vtt).length, 1)
})

test('SRT: the transcript survives, the numbering does not', () => {
  const srt = `1
00:00:01,000 --> 00:00:04,000
Marie: Le vrai sujet c'est l'adoption.

2
00:00:04,000 --> 00:00:06,000
Henri: On a déjà essayé deux outils.
`
  assert.deepEqual(parseSrt(srt), [
    "Marie: Le vrai sujet c'est l'adoption.",
    'Henri: On a déjà essayé deux outils.',
  ])
})

test('JSON: Fireflies-shaped sentences', () => {
  const json = JSON.stringify({
    title: 'Discovery',
    sentences: [
      { speaker_name: 'Marie Dupont', text: 'Notre churn est à 3 %.' },
      { speaker_name: 'Henri Colin', text: 'Le budget est voté en mars.' },
    ],
  })
  assert.deepEqual(parseJsonTranscript(json), [
    'Marie Dupont: Notre churn est à 3 %.',
    'Henri Colin: Le budget est voté en mars.',
  ])
})

test('JSON: Gong-shaped nesting, several levels down', () => {
  const json = JSON.stringify({
    callTranscripts: [{
      callId: '42',
      transcript: [
        { speakerId: 'Marie', sentences: [{ text: 'On veut décider avant juin.' }] },
      ],
    }],
  })
  const out = parseJsonTranscript(json)
  assert.ok(out && out.some(l => l.includes('On veut décider avant juin.')), JSON.stringify(out))
})

test('JSON: a segment carrying words[] instead of text', () => {
  const json = JSON.stringify([
    { speaker: 'Marie', words: [{ word: 'Le' }, { word: 'budget' }, { word: 'existe' }] },
  ])
  assert.deepEqual(parseJsonTranscript(json), ['Marie: Le budget existe'])
})

test('JSON: something that is not a transcript returns null', () => {
  assert.equal(parseJsonTranscript('{"count": 3}'), null)
  assert.equal(parseJsonTranscript('not json'), null)
})

test('CSV: quoted cells containing commas and newlines', () => {
  const csv = 'Speaker,Text\n"Marie Dupont","On perd 3 %, chaque mois"\n"Henri","Deux\nlignes"\n'
  assert.deepEqual(parseCsvRows(csv)[1], ['Marie Dupont', 'On perd 3 %, chaque mois'])
  assert.deepEqual(parseCsvTranscript(csv), [
    'Marie Dupont: On perd 3 %, chaque mois',
    'Henri: Deux lignes',
  ])
})

test('CSV: headers are matched loosely, and a file with no text column is refused', () => {
  const gong = 'Call ID,Speaker Name,Sentence,Start\n1,Marie,Le churn nous tue,00:01\n'
  assert.deepEqual(parseCsvTranscript(gong), ['Marie: Le churn nous tue'])
  assert.equal(parseCsvTranscript('a,b\n1,2\n'), null)
})

test('plain text: leading timestamps are stripped, speakers kept', () => {
  const txt = `[00:01:12] Marie Dupont: On perd des clients.
00:01:20 Henri Colin: Le budget est bloqué.
Il faut attendre mars.`
  assert.deepEqual(parsePlainTranscript(txt), [
    'Marie Dupont: On perd des clients.',
    'Henri Colin: Le budget est bloqué. Il faut attendre mars.',
  ])
})

test('plain text: a line with no speaker is attributed to the last one, not invented', () => {
  const out = parsePlainTranscript('Il faut attendre mars.\nEt voir après.')
  assert.deepEqual(out, ['Il faut attendre mars.', 'Et voir après.'])
})

test('docx: text is extracted from the zip, not read as bytes', () => {
  const xml = `<?xml version="1.0"?><w:document><w:body>
    <w:p><w:r><w:t>Marie Dupont: On perd 3 % par mois.</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Henri Colin: </w:t></w:r><w:r><w:t>Budget en mars &amp; pas avant.</w:t></w:r></w:p>
  </w:body></w:document>`
  const docx = makeDocx(xml)
  const text = docxToText(docx)
  assert.equal(text, 'Marie Dupont: On perd 3 % par mois.\nHenri Colin: Budget en mars & pas avant.')

  const parsed = parseTranscriptFile('gong-call.docx', docx)
  assert.equal(parsed.format, 'docx')
  assert.deepEqual(parsed.speakers, ['Marie Dupont', 'Henri Colin'])
})

test('docx: a file we cannot open yields nothing rather than binary noise', () => {
  const junk = Buffer.from('PK not really a zip')
  const parsed = parseTranscriptFile('broken.docx', junk)
  assert.equal(parsed.text, '')
})

test('the format is detected from the content, not only the extension', () => {
  // Exports named .txt that actually hold VTT or JSON are common.
  assert.equal(parseTranscriptText('WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nMarie: Bonjour\n').format, 'vtt')
  assert.equal(parseTranscriptText('[{"speaker":"Marie","text":"Bonjour"}]').format, 'json')
  assert.equal(parseTranscriptText('1\n00:00:01,000 --> 00:00:02,000\nBonjour\n').format, 'srt')
  assert.equal(parseTranscriptText('Marie: Bonjour').format, 'text')
})

test('normalizing a VTT cuts it down to the words that were said', () => {
  const vtt = `WEBVTT\n\n` + Array.from({ length: 20 }, (_, i) =>
    `${i + 1}\n00:00:0${i % 10}.000 --> 00:00:0${(i + 1) % 10}.000\n<v Marie>phrase ${i}</v>\n`).join('\n')
  const { text } = parseTranscriptText(vtt, 'vtt')
  assert.ok(text.length < vtt.length / 2, `${text.length} vs ${vtt.length}`)
  assert.ok(text.includes('phrase 19'))
})

/** A minimal single-entry ZIP, so the docx test needs no fixture file. */
function makeDocx(xml: string): Buffer {
  const name = Buffer.from('word/document.xml', 'latin1')
  const content = Buffer.from(xml, 'utf-8')
  const deflated = deflateRawSync(content)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(8, 8)           // deflate
  local.writeUInt32LE(0, 14)          // crc — not checked
  local.writeUInt32LE(deflated.length, 18)
  local.writeUInt32LE(content.length, 22)
  local.writeUInt16LE(name.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(deflated.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt32LE(0, 42)        // local header offset

  const localPart = Buffer.concat([local, name, deflated])
  const centralPart = Buffer.concat([central, name])

  const eocd = Buffer.alloc(22)
  eocd.writeUInt32LE(0x06054b50, 0)
  eocd.writeUInt16LE(1, 8)
  eocd.writeUInt16LE(1, 10)
  eocd.writeUInt32LE(centralPart.length, 12)
  eocd.writeUInt32LE(localPart.length, 16)

  return Buffer.concat([localPart, centralPart, eocd])
}
