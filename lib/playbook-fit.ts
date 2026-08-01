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
