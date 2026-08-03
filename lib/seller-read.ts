// The seller's own read of a conversation — what they felt, not what was said.
//
// This never touches a score. The gates measure evidence; a feeling is the
// opposite of evidence, and letting it lift a score would break the discipline
// the whole diagnostic rests on.
//
// Its value is the GAP: a seller who leaves a call enthusiastic about a deal
// scored 1.7 in declared evidence is the most useful coaching signal the
// product can produce. When feeling and evidence agree, this file says nothing.

import { gateScore } from './scoring'
import type { DealRound } from './types'

// Engagement is asked as what the prospect DID, not how it felt. Behaviour
// resists happy ears better than impressions do.
export const ENGAGEMENT_LEVELS = [
  { value: 1, fr: 'Il a subi l’échange', en: 'They sat through it', hintFr: 'répond, n’initie rien', hintEn: 'answers, initiates nothing' },
  { value: 2, fr: 'Il a participé', en: 'They took part', hintFr: 'répond, pose quelques questions', hintEn: 'answers, asks a few questions' },
  { value: 3, fr: 'Il a creusé', en: 'They dug in', hintFr: 'questions précises, il challenge', hintEn: 'precise questions, pushes back' },
  { value: 4, fr: 'Il a poussé', en: 'They pushed', hintFr: 'propose la suite, implique d’autres personnes', hintEn: 'proposes next steps, brings others in' },
] as const

export const TONE_LEVELS = [
  { value: 1, fr: 'Négative', en: 'Negative' },
  { value: 2, fr: 'Réservée', en: 'Guarded' },
  { value: 3, fr: 'Neutre', en: 'Neutral' },
  { value: 4, fr: 'Favorable', en: 'Favourable' },
  { value: 5, fr: 'Enthousiaste', en: 'Enthusiastic' },
] as const

export const CONFIDENCE_LEVELS = [
  { value: 1, fr: 'Non', en: 'No' },
  { value: 2, fr: 'Peu probable', en: 'Unlikely' },
  { value: 3, fr: 'Je ne sais pas', en: 'I do not know' },
  { value: 4, fr: 'Probable', en: 'Likely' },
  { value: 5, fr: 'Oui', en: 'Yes' },
] as const

export type SellerRead = {
  engagement?: number
  tone?: number
  /** "If I had to bet today, this deal closes." */
  confidence?: number
  /** What struck them, or what nags at them. */
  note?: string
  at?: string
}

export function normalizeSellerRead(raw: unknown): SellerRead | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as SellerRead
  const num = (v: unknown, max: number) =>
    typeof v === 'number' && v >= 1 && v <= max ? v : undefined
  const out: SellerRead = {
    engagement: num(r.engagement, 4),
    tone: num(r.tone, 5),
    confidence: num(r.confidence, 5),
    note: typeof r.note === 'string' && r.note.trim() ? r.note.trim() : undefined,
    at: typeof r.at === 'string' ? r.at : undefined,
  }
  const hasAnything = out.engagement || out.tone || out.confidence || out.note
  return hasAnything ? out : null
}

// ── The gap ──────────────────────────────────────────────────

export type ReadGap = {
  kind: 'optimistic' | 'pessimistic' | 'aligned'
  /** The seller's confidence, and the evidence, on the same 1-5 footing. */
  confidence: number
  evidence: number
}

/**
 * Compares the seller's confidence with what the gates actually hold.
 *
 * Gate 1 is the reference: it is the gate that decides whether the deal
 * deserves to exist at all, and the one a hopeful seller is most likely to
 * read too generously. A gap of less than 1.5 points is not a gap — sellers
 * are not instruments, and crying wolf over noise would train them to ignore
 * this entirely.
 */
export function readGap(read: SellerRead | null, round: DealRound | null): ReadGap | null {
  if (!read?.confidence || !round) return null
  const evidence = gateScore(round, 1)
  if (evidence === null) return null

  const delta = read.confidence - evidence
  if (Math.abs(delta) < 1.5) return { kind: 'aligned', confidence: read.confidence, evidence }
  return {
    kind: delta > 0 ? 'optimistic' : 'pessimistic',
    confidence: read.confidence,
    evidence,
  }
}

// ── AI context ───────────────────────────────────────────────

/** Labelled so the model can never mistake a feeling for a finding. */
export function buildSellerReadContext(read: SellerRead | null, locale = 'fr'): string {
  if (!read) return ''
  const fr = locale === 'fr'
  const lines = ["THE SELLER'S OWN READ (subjective, unverified — NEVER use it as evidence, and never let it raise a score):"]
  if (read.engagement) {
    const e = ENGAGEMENT_LEVELS.find(l => l.value === read.engagement)
    if (e) lines.push(`  Prospect engagement: ${e.en} (${e.hintEn})`)
  }
  if (read.tone) {
    const t = TONE_LEVELS.find(l => l.value === read.tone)
    if (t) lines.push(`  Tone felt: ${t.en}`)
  }
  if (read.confidence) {
    const c = CONFIDENCE_LEVELS.find(l => l.value === read.confidence)
    if (c) lines.push(`  "This deal closes": ${c.en}`)
  }
  if (read.note) {
    lines.push(`  What struck them or nags at them: ${read.note}`)
    lines.push('  Treat that last line as a hypothesis to VERIFY in the next conversation, never as a fact.')
  }
  return fr ? lines.join('\n') : lines.join('\n')
}
