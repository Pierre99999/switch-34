// Turning whatever a recording tool exported into plain "Speaker: what they
// said" lines.
//
// Every one of these tools exports something different, and the difference is
// never interesting: Gong writes CSV or DOCX, Fireflies JSON or DOCX, Granola
// and Otter plain text with timestamps, Teams and Zoom VTT, everything else
// SRT. Underneath it is always the same object — a list of turns, each with a
// speaker and a sentence.
//
// Doing this before the model rather than in the prompt matters for two
// reasons. A VTT file is roughly three times its own transcript in timestamps
// and cue numbers, all of it paid for and none of it read. And a .docx is a
// ZIP archive: read as text it is binary noise, which is what the app was
// quietly sending until now.

import { inflateRawSync } from 'node:zlib'

export type TranscriptFormat = 'vtt' | 'srt' | 'json' | 'csv' | 'docx' | 'text'

export type ParsedTranscript = {
  text: string
  format: TranscriptFormat
  /** Distinct speakers seen, when the format names them. Empty for plain text. */
  speakers: string[]
}

// ── Small shared helpers ─────────────────────────────────────

const TIMESTAMP_LINE = /^\s*(\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?\s*(-->|–>|-)?\s*((\d{1,2}:)?\d{1,2}:\d{2}([.,]\d{1,3})?)?\s*$/

/** "Name: text" — the shape every one of these formats collapses to. */
function turn(speaker: string | null, text: string): string {
  const t = text.replace(/\s+/g, ' ').trim()
  if (!t) return ''
  const s = speaker?.trim()
  return s ? `${s}: ${t}` : t
}

/**
 * Consecutive lines from the same speaker become one turn. Caption formats cut
 * a sentence into three cues; keeping them apart makes a speaker look like
 * they said three separate things.
 */
function mergeTurns(lines: string[]): string[] {
  const out: string[] = []
  for (const line of lines) {
    if (!line) continue
    const m = line.match(/^([^:]{1,60}): ([\s\S]*)$/)
    const prev = out[out.length - 1]
    if (m && prev) {
      const p = prev.match(/^([^:]{1,60}): ([\s\S]*)$/)
      if (p && p[1] === m[1]) {
        out[out.length - 1] = `${p[1]}: ${p[2]} ${m[2]}`.replace(/\s+/g, ' ')
        continue
      }
    }
    if (line === prev) continue // rolling captions repeat the previous cue
    out.push(line)
  }
  return out
}

// ── WebVTT (Teams, Zoom, Meet, Whisper) ──────────────────────

export function parseVtt(raw: string): string[] {
  const lines: string[] = []
  let speaker: string | null = null
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || l === 'WEBVTT' || l.startsWith('NOTE') || l.startsWith('STYLE')) continue
    if (l.includes('-->')) continue
    if (/^\d+$/.test(l)) continue          // cue number
    if (/^[0-9a-f-]{8,}$/i.test(l)) continue // cue id (Teams uses uuids)

    // <v Marie Dupont>text</v> — the Teams/Zoom voice span.
    const voice = l.match(/^<v\s+([^>]+)>([\s\S]*?)(<\/v>)?$/i)
    if (voice) { lines.push(turn(voice[1], voice[2].replace(/<[^>]+>/g, ''))); continue }

    const plain = l.replace(/<[^>]+>/g, '').trim()
    if (!plain) continue

    // Some exports write "Marie Dupont: text" inside the cue instead.
    const named = plain.match(/^([\p{Lu}][\p{L}'’. -]{1,40}(?:\([^)]*\))?):\s*(.+)$/u)
    if (named) { speaker = named[1]; lines.push(turn(speaker, named[2])); continue }
    lines.push(turn(speaker, plain))
  }
  return mergeTurns(lines)
}

// ── SRT ──────────────────────────────────────────────────────

export function parseSrt(raw: string): string[] {
  const lines: string[] = []
  let speaker: string | null = null
  for (const line of raw.split(/\r?\n/)) {
    const l = line.trim()
    if (!l || /^\d+$/.test(l) || l.includes('-->')) continue
    const plain = l.replace(/<[^>]+>/g, '').replace(/^\{\\an\d\}/, '').trim()
    if (!plain) continue
    const named = plain.match(/^([\p{Lu}][\p{L}'’. -]{1,40}):\s*(.+)$/u)
    if (named) { speaker = named[1]; lines.push(turn(speaker, named[2])); continue }
    lines.push(turn(speaker, plain))
  }
  return mergeTurns(lines)
}

// ── JSON (Fireflies, Gong, Otter, Rev, Whisper) ──────────────

const SPEAKER_KEYS = ['speaker_name', 'speakerName', 'speaker', 'speaker_label', 'name', 'participant', 'speakerId', 'speaker_id']
const TEXT_KEYS = ['text', 'sentence', 'content', 'transcript', 'value', 'raw_text']

function pick(o: Record<string, unknown>, keys: string[]): string | null {
  for (const k of keys) {
    const v = o[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
    if (typeof v === 'number') return String(v)
  }
  return null
}

/** A segment can carry its text as words[] instead of a string (Rev, Gong). */
function textOfSegment(o: Record<string, unknown>): string | null {
  const direct = pick(o, TEXT_KEYS)
  if (direct) return direct
  const words = o.words
  if (Array.isArray(words)) {
    const joined = words
      .map(w => typeof w === 'string' ? w : pick((w ?? {}) as Record<string, unknown>, ['word', 'text', 'value']) ?? '')
      .join(' ').replace(/\s+([,.!?;:])/g, '$1').trim()
    if (joined) return joined
  }
  return null
}

/**
 * Walk the tree and collect anything that looks like a turn. Deliberately
 * shape-agnostic: every vendor nests its sentences somewhere different
 * (`sentences`, `monologues`, `callTranscripts[].transcript[]`), and chasing
 * each nesting by name would break on the next export version.
 */
function collectSegments(node: unknown, out: { speaker: string | null; text: string }[], depth = 0): void {
  if (depth > 8 || out.length > 20000) return
  if (Array.isArray(node)) { for (const n of node) collectSegments(n, out, depth + 1); return }
  if (!node || typeof node !== 'object') return
  const o = node as Record<string, unknown>
  const text = textOfSegment(o)
  if (text) {
    out.push({ speaker: pick(o, SPEAKER_KEYS), text })
    // A turn can still nest sentences under it; those repeat the same words.
    return
  }
  for (const v of Object.values(o)) collectSegments(v, out, depth + 1)
}

export function parseJsonTranscript(raw: string): string[] | null {
  let data: unknown
  try { data = JSON.parse(raw) } catch { return null }
  const segments: { speaker: string | null; text: string }[] = []
  collectSegments(data, segments)
  if (segments.length === 0) return null
  return mergeTurns(segments.map(s => turn(s.speaker, s.text)))
}

// ── CSV (Gong, Chorus exports) ───────────────────────────────

export function parseCsvRows(raw: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i]
    if (quoted) {
      if (c === '"') {
        if (raw[i + 1] === '"') { cell += '"'; i++ } else quoted = false
      } else cell += c
      continue
    }
    if (c === '"') { quoted = true; continue }
    if (c === ',' || c === ';' || c === '\t') { row.push(cell); cell = ''; continue }
    if (c === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; continue }
    if (c === '\r') continue
    cell += c
  }
  if (cell || row.length) { row.push(cell); rows.push(row) }
  return rows.filter(r => r.some(c => c.trim()))
}

const CSV_SPEAKER_HEADERS = ['speaker', 'name', 'participant', 'intervenant', 'locuteur', 'from']
const CSV_TEXT_HEADERS = ['text', 'sentence', 'transcript', 'content', 'utterance', 'contenu', 'message']

export function parseCsvTranscript(raw: string): string[] | null {
  const rows = parseCsvRows(raw)
  if (rows.length < 2) return null
  const header = rows[0].map(h => h.trim().toLowerCase())
  const speakerIdx = header.findIndex(h => CSV_SPEAKER_HEADERS.some(k => h.includes(k)))
  const textIdx = header.findIndex(h => CSV_TEXT_HEADERS.some(k => h.includes(k)))
  if (textIdx === -1) return null
  const lines = rows.slice(1).map(r =>
    turn(speakerIdx === -1 ? null : (r[speakerIdx] ?? null), r[textIdx] ?? ''))
  return mergeTurns(lines)
}

// ── DOCX (Gong, Fireflies, Word exports) ─────────────────────

/**
 * A .docx is a ZIP holding word/document.xml. Read as UTF-8 it is binary
 * noise, which is what was reaching the model before. No dependency needed:
 * the central directory is a handful of offsets and the payload is raw
 * deflate.
 */
export function docxToText(buf: Buffer): string | null {
  const xml = readZipEntry(buf, 'word/document.xml')
  if (!xml) return null
  const paragraphs = xml.split(/<\/w:p>/).map(p => {
    // <w:br/> and <w:tab/> are whitespace; <w:t> holds the words.
    const withBreaks = p.replace(/<w:(br|tab)\b[^>]*\/?>/g, ' ')
    const text = [...withBreaks.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(m => m[1]).join('')
    return decodeXml(text).replace(/\s+/g, ' ').trim()
  })
  const out = paragraphs.filter(Boolean)
  return out.length ? out.join('\n') : null
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, '&')
}

function readZipEntry(buf: Buffer, wanted: string): string | null {
  // End of central directory, searched from the end (a comment may follow it).
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65558; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) return null
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)

  for (let i = 0; i < count; i++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) return null
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const nameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOffset = buf.readUInt32LE(p + 42)
    const name = buf.subarray(p + 46, p + 46 + nameLen).toString('latin1')

    if (name === wanted) {
      if (localOffset + 30 > buf.length || buf.readUInt32LE(localOffset) !== 0x04034b50) return null
      const lNameLen = buf.readUInt16LE(localOffset + 26)
      const lExtraLen = buf.readUInt16LE(localOffset + 28)
      const start = localOffset + 30 + lNameLen + lExtraLen
      const data = buf.subarray(start, start + compSize)
      try {
        if (method === 0) return data.toString('utf-8')
        if (method === 8) return inflateRawSync(data).toString('utf-8')
      } catch { return null }
      return null
    }
    p += 46 + nameLen + extraLen + commentLen
  }
  return null
}

// ── Plain text (Granola, Otter, Notion, a paste) ─────────────

export function parsePlainTranscript(raw: string): string[] {
  const lines: string[] = []
  let speaker: string | null = null
  for (const line of raw.split(/\r?\n/)) {
    let l = line.trim()
    if (!l) continue
    if (TIMESTAMP_LINE.test(l)) continue
    // "[00:12:34] Marie: ..." / "00:12 Marie: ..." — the timestamp is noise.
    l = l.replace(/^\[?\(?((\d{1,2}:)?\d{1,2}:\d{2})([.,]\d{1,3})?\)?\]?\s*[-–—]?\s*/, '')
    if (!l) continue
    const named = l.match(/^([\p{Lu}][\p{L}'’. -]{1,40}(?:\s*\([^)]*\))?):\s*(.*)$/u)
    if (named) { speaker = named[1].trim(); lines.push(turn(speaker, named[2])); continue }
    lines.push(turn(speaker, l))
  }
  return mergeTurns(lines)
}

// ── Entry point ──────────────────────────────────────────────

function speakersOf(lines: string[]): string[] {
  const names = lines
    .map(l => l.match(/^([^:]{1,60}): /)?.[1]?.trim())
    .filter((n): n is string => !!n)
  return [...new Set(names)]
}

/**
 * Normalize an uploaded transcript. `buf` is the raw file; `name` decides the
 * first guess, but content wins — an export named .txt that holds JSON is
 * common enough to be worth handling.
 */
export function parseTranscriptFile(name: string, buf: Buffer): ParsedTranscript {
  const ext = (name.split('.').pop() ?? '').toLowerCase()

  if (ext === 'docx') {
    const text = docxToText(buf)
    if (text) {
      const lines = parsePlainTranscript(text)
      return { text: lines.join('\n'), format: 'docx', speakers: speakersOf(lines) }
    }
    // A .docx we cannot open is not something to pass on as bytes.
    return { text: '', format: 'docx', speakers: [] }
  }

  const raw = buf.toString('utf-8')
  return parseTranscriptText(raw, ext)
}

/** The same normalization for a paste, or for a file already read as text. */
export function parseTranscriptText(raw: string, ext = ''): ParsedTranscript {
  const trimmed = raw.trimStart()

  if (ext === 'vtt' || /^WEBVTT/.test(trimmed)) {
    const lines = parseVtt(raw)
    return { text: lines.join('\n'), format: 'vtt', speakers: speakersOf(lines) }
  }

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const lines = parseJsonTranscript(raw)
    if (lines?.length) return { text: lines.join('\n'), format: 'json', speakers: speakersOf(lines) }
  }

  if (ext === 'srt' || /^\d+\r?\n[\d:,]+\s*-->/.test(trimmed)) {
    const lines = parseSrt(raw)
    return { text: lines.join('\n'), format: 'srt', speakers: speakersOf(lines) }
  }

  if (ext === 'csv' || ext === 'tsv') {
    const lines = parseCsvTranscript(raw)
    if (lines?.length) return { text: lines.join('\n'), format: 'csv', speakers: speakersOf(lines) }
  }

  const lines = parsePlainTranscript(raw)
  return { text: lines.join('\n'), format: 'text', speakers: speakersOf(lines) }
}
