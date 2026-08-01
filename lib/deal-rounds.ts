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
