// Round bookkeeping shared by every path that creates or scores a round.
//
// These two operations were written out by hand in three places — starting a
// new round, importing a past conversation, analysing a capture — and had
// already drifted: the transcript import forgot to carry authority_levels
// over, so an imported deal silently lost the caps those levels apply.

import { LAYER_VARIABLES, type DealRound } from './types'

const ALL_VARIABLES = Object.values(LAYER_VARIABLES).flat() as string[]

/**
 * What a new round carries over from the one before it. A round is a new
 * reading of the same deal, not a blank slate: last round's findings stand
 * until this conversation revises them.
 */
export function inheritedRoundFields(prev: DealRound | null | undefined): Record<string, unknown> {
  const inherited: Record<string, unknown> = {}
  if (!prev) return inherited

  for (const v of ALL_VARIABLES) {
    const score = prev[v as keyof DealRound] as number | null | undefined
    if (score !== null && score !== undefined) inherited[v] = score
  }

  // Carried as whole maps rather than per-variable: they are keyed by variable
  // already, and an empty map would needlessly overwrite.
  const carry: [string, Record<string, unknown> | undefined][] = [
    ['evidence_levels', prev.evidence_levels as Record<string, unknown> | undefined],
    ['authority_levels', (prev as unknown as Record<string, unknown>).authority_levels as Record<string, unknown> | undefined],
    ['rationales', prev.rationales as Record<string, unknown> | undefined],
  ]
  for (const [key, value] of carry) {
    if (value && Object.keys(value).length > 0) inherited[key] = value
  }
  return inherited
}

/**
 * A round that exists in the database but holds nothing: no briefing, no
 * capture, no score.
 *
 * The round row is created before its briefing is generated, so leaving the
 * page mid-generation — or a browser Back — strands an empty round. Clicking
 * "create the briefing" again would then open ANOTHER round, and the timeline
 * would show R2 for a deal still on its first conversation. Reuse this one
 * instead of stacking a new one on top.
 */
export function isRoundUnstarted(round: DealRound | null | undefined): boolean {
  if (!round) return false
  if (round.briefing_line) return false

  const notes = (round.capture_notes ?? {}) as Record<string, unknown>
  if (Object.values(notes).some(v => typeof v === 'string' && v.trim())) return false

  return !ALL_VARIABLES.some(v => {
    const score = round[v as keyof DealRound]
    return score !== null && score !== undefined
  })
}

/** Whether this round holds anything a human actually captured. */
export function hasCapture(round: DealRound | null | undefined): boolean {
  const notes = (round?.capture_notes ?? {}) as Record<string, unknown>
  return Object.values(notes).some(v => typeof v === 'string' && v.trim())
}

export type RoundState = 'UNSTARTED' | 'BRIEFED' | 'SCORED'

/**
 * Where a round stands, and therefore what the dashboard should offer next.
 *
 * SCORED depends on the CAPTURE, never on the presence of scores: a new round
 * inherits the previous round's scores, so "has a score" is true from the
 * moment it is created. Reading that as "already scored" offered the round 3
 * briefing while round 2's conversation had not happened yet.
 */
export function roundState(round: DealRound | null | undefined): RoundState {
  if (!round?.briefing_line) return 'UNSTARTED'
  return hasCapture(round) ? 'SCORED' : 'BRIEFED'
}

export type ScoreSuggestion = {
  score?: number | null
  evidence?: string
  rationale?: string
  declarations?: unknown[]
}

/**
 * Turns the scoring engine's suggestions into a single update for the round,
 * merged over what the round already holds so a criterion the engine did not
 * address keeps its previous reading.
 */
export function scoreUpdateFromSuggestions(
  round: Pick<DealRound, 'evidence_levels' | 'rationales'> & Record<string, unknown>,
  suggestions: Record<string, ScoreSuggestion>,
): Record<string, unknown> {
  const update: Record<string, unknown> = {}
  const evidenceLevels: Record<string, string> = { ...((round.evidence_levels ?? {}) as Record<string, string>) }
  const rationales: Record<string, string> = { ...((round.rationales ?? {}) as Record<string, string>) }
  const declarations: Record<string, unknown> = { ...((round.declarations ?? {}) as Record<string, unknown>) }

  for (const [variable, s] of Object.entries(suggestions)) {
    if (!s) continue
    if (s.score !== null && s.score !== undefined) update[variable] = s.score
    if (s.evidence) evidenceLevels[variable] = s.evidence
    if (s.rationale) rationales[variable] = s.rationale
    if (s.declarations) declarations[variable] = s.declarations
  }

  return { ...update, evidence_levels: evidenceLevels, rationales, declarations }
}
