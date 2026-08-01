// Playbook fit — how well a deal matches the socle.
//
// This is a SECOND reading, orthogonal to the gates. The gates ask "is this
// deal healthy?" from what was said; the fit asks "is this deal ours to win?"
// from the socle. A fit verdict must never change a gate score: the gates
// carry an evidence discipline that "it looks like our customers" would
// corrupt.
//
// This file holds the deterministic axis only — actor coverage, which is a
// set intersection and needs no model. The semantic axes (segment, problem,
// value, alternative, perception) require judgement and live elsewhere.

import type { Playbook } from './playbook'
import { rowHasContent } from './playbook'

// ── The semantic axes ────────────────────────────────────────

export type FitVerdict = 'aligned' | 'partial' | 'mismatch' | 'unknown'
export type FitAxisKey = 'segment' | 'problem' | 'value' | 'alternative' | 'perception'

export type FitAxis = {
  key: FitAxisKey
  verdict: FitVerdict
  /** What we understood about this prospect, in one sentence. */
  summary: string
  /** Why THIS verdict and not another — the comparison that produced it. */
  reason: string
  /** The socle row this was matched against — quoted, so the verdict is checkable. */
  playbook_ref: string
  /** What is missing, or what the next conversation should settle. */
  gap?: string
}

export type PlaybookFit = {
  axes: FitAxis[]
  /**
   * 'context' means the read comes from the prospect's own public material —
   * a hypothesis, not a finding. Only a captured conversation makes it
   * 'conversation'. Labelling this is what stops a website from reading as
   * established fact, the way it did on the revo deal.
   */
  basis: 'context' | 'conversation'
  computed_at: string
  /** The prospect resembles a segment the team decided to stop selling to. */
  avoid_list_hit?: boolean
}

// Each axis is read next to an existing criterion — never inside its score.
export const AXIS_CRITERION: Record<FitAxisKey, string> = {
  segment: 'concerns_fit',
  problem: 'real_business_problem',
  value: 'value_solution_fit',
  alternative: 'competitive_position',
  perception: 'credibility_perception',
}
export const ACTORS_CRITERION = 'stakeholder_map'

export const FIT_AXIS_LABELS: Record<FitAxisKey, { fr: string; en: string }> = {
  segment: { fr: 'Segment', en: 'Segment' },
  problem: { fr: 'Problème', en: 'Problem' },
  value: { fr: 'Valeur', en: 'Value' },
  alternative: { fr: 'Alternative', en: 'Alternative' },
  perception: { fr: 'Perception', en: 'Perception' },
}

// What each verdict means, shown as a legend — a colour with no key is a
// puzzle, and the user has to trust it blind.
export const VERDICT_MEANING: Record<FitVerdict, { fr: string; en: string }> = {
  aligned: {
    fr: 'Correspond clairement à une ligne de votre socle.',
    en: 'Clearly matches a row of your socle.',
  },
  partial: {
    fr: 'Correspond en partie seulement, ou de façon encore incertaine.',
    en: 'Matches only in part, or not yet with certainty.',
  },
  mismatch: {
    fr: 'Contredit votre socle, ou relève d’un segment que vous avez décidé de fuir.',
    en: 'Contradicts your socle, or belongs to a segment you decided to avoid.',
  },
  unknown: {
    fr: 'Ce que vous savez de ce prospect ne dit rien sur cet axe.',
    en: 'What you know about this prospect says nothing either way.',
  },
}

export const FIT_AXIS_QUESTION: Record<FitAxisKey, { fr: string; en: string }> = {
  segment: { fr: 'Ce prospect est-il une de vos cibles idéales ?', en: 'Is this prospect one of your ideal segments?' },
  problem: { fr: 'Son problème est-il un de ceux que vous savez résoudre ?', en: 'Is their problem one you know how to solve?' },
  value: { fr: 'La valeur que vous délivrez lui parle-t-elle ?', en: 'Does the value you deliver land for them?' },
  alternative: { fr: 'Face à quoi se décide-t-il, et avez-vous la différence pertinente ?', en: 'What are they deciding against, and do you have the relevant difference?' },
  perception: { fr: 'Lesquelles de vos objections connues sont actives ici ?', en: 'Which of your known objections are alive here?' },
}

export const FIT_AXIS_SOURCE: Record<FitAxisKey, string> = {
  segment: 'A2', problem: 'A1', value: 'A1', alternative: 'A3', perception: 'A4',
}

export function normalizeFit(raw: unknown): PlaybookFit | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<PlaybookFit>
  if (!Array.isArray(r.axes)) return null
  const valid: FitVerdict[] = ['aligned', 'partial', 'mismatch', 'unknown']
  const axes = r.axes
    .filter(a => a && typeof a === 'object' && a.key in AXIS_CRITERION)
    .map(a => ({
      key: a.key,
      verdict: valid.includes(a.verdict) ? a.verdict : 'unknown',
      summary: typeof a.summary === 'string' ? a.summary : '',
      reason: typeof a.reason === 'string' ? a.reason : '',
      playbook_ref: typeof a.playbook_ref === 'string' ? a.playbook_ref : '',
      gap: typeof a.gap === 'string' ? a.gap : undefined,
    })) as FitAxis[]
  if (!axes.length) return null
  return {
    axes,
    basis: r.basis === 'conversation' ? 'conversation' : 'context',
    computed_at: typeof r.computed_at === 'string' ? r.computed_at : '',
    avoid_list_hit: r.avoid_list_hit === true,
  }
}

export type CanonicalActor =
  | 'champion' | 'decision_maker' | 'user' | 'reviewer' | 'budget_guardian' | 'blocker'

// A5 role names are typed by hand, in either language. Match them to the
// roles a deal's contacts are tagged with. Order matters: the longer, more
// specific phrases are tested first ("décideur technique" is a reviewer, not
// a decision maker).
const ROLE_PATTERNS: { actor: CanonicalActor; patterns: string[] }[] = [
  { actor: 'reviewer', patterns: [
    'decideur technique', 'acheteur technique', 'technical buyer', 'technical decision',
    'evaluateur', 'evaluator', 'reviewer', 'architecte', 'architect', 'dsi technique',
  ] },
  { actor: 'budget_guardian', patterns: [
    'gardien du budget', 'budget guardian', 'budget holder', 'budget', 'finance',
    'achats', 'procurement', 'purchasing', 'cfo', 'daf', 'controle de gestion',
  ] },
  { actor: 'decision_maker', patterns: [
    'decideur', 'decision maker', 'decision-maker', 'sponsor executif', 'executive sponsor',
    'signataire', 'signatory', 'dirigeant', 'ceo', 'directeur general', 'economic buyer',
  ] },
  { actor: 'champion', patterns: [
    'champion', 'ambassadeur', 'sponsor interne', 'internal sponsor', 'relais', 'advocate',
  ] },
  { actor: 'user', patterns: [
    'utilisateur', 'end user', 'end-user', 'user', 'usager', 'equipe terrain', 'operationnel',
  ] },
  { actor: 'blocker', patterns: [
    'bloqueur', 'blocker', 'opposant', 'detracteur', 'gatekeeper', 'frein',
  ] },
]

function normalize(s: string): string {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Returns the canonical role an A5 line refers to, or null when the wording
// is not recognised — better to say so than to guess wrong.
export function matchActorRole(text: string): CanonicalActor | null {
  const n = normalize(text)
  if (!n) return null
  for (const { actor, patterns } of ROLE_PATTERNS) {
    if (patterns.some(p => n.includes(p))) return actor
  }
  return null
}

export type ActorRequirement = {
  /** The A5 row, as the team wrote it. */
  label: string
  why: string
  risk: string
  actor: CanonicalActor | null
  covered: boolean
  /** Names of the deal contacts carrying this role. */
  coveredBy: string[]
}

export type ActorCoverage = {
  /** False when A5 holds nothing — there is nothing to compare against. */
  applicable: boolean
  requirements: ActorRequirement[]
  covered: number
  total: number
  /** Recognised roles that no contact carries. */
  missing: ActorRequirement[]
  /** A5 lines whose wording could not be matched to a role. */
  unmatched: ActorRequirement[]
}

export type DealContact = { name: string; actor_types?: string[] | null; actor_type?: string | null }

export function actorCoverage(playbook: Playbook, contacts: DealContact[]): ActorCoverage {
  const rows = playbook.a5_actors.filter(r => rowHasContent(r))
  if (rows.length === 0) {
    return { applicable: false, requirements: [], covered: 0, total: 0, missing: [], unmatched: [] }
  }

  // Which roles this deal's contacts actually carry.
  const present = new Map<string, string[]>()
  for (const c of contacts) {
    const types = (c.actor_types?.length ? c.actor_types : [c.actor_type ?? 'unknown']) as string[]
    for (const t of types) {
      if (!t || t === 'unknown') continue
      present.set(t, [...(present.get(t) ?? []), c.name])
    }
  }

  const requirements: ActorRequirement[] = rows.map(r => {
    const label = (r.role ?? '').trim()
    const actor = matchActorRole(label)
    const coveredBy = actor ? (present.get(actor) ?? []) : []
    return {
      label,
      why: (r.why ?? '').trim(),
      risk: (r.risk ?? '').trim(),
      actor,
      covered: coveredBy.length > 0,
      coveredBy,
    }
  })

  const recognised = requirements.filter(r => r.actor)
  return {
    applicable: true,
    requirements,
    covered: recognised.filter(r => r.covered).length,
    total: recognised.length,
    missing: recognised.filter(r => !r.covered),
    unmatched: requirements.filter(r => !r.actor),
  }
}
