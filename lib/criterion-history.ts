// What a criterion looked like at each round.
//
// No new data is captured for this. A past round is frozen, so every round
// already holds its own photograph of all twenty criteria — score, evidence
// level and the sentence that justified them. The history is in the database
// already; it only had to be read.
//
// It answers the question the panel could not: a justification written at
// round 1 and one written at round 4 look identical on screen, and only one of
// them is news.

import type { DealRound, EvidenceLevel, SourceAuthority } from './types'
import { criterionScore } from './scoring'

export type CriterionSnapshot = {
  round: number
  score: number | null
  evidence: EvidenceLevel | undefined
  rationale: string | undefined
  /** True when this round is where the current wording was first written. */
  changed: boolean
}

function snapshot(round: DealRound, variable: string): Omit<CriterionSnapshot, 'changed'> {
  const evidence = (round.evidence_levels ?? {}) as Record<string, EvidenceLevel>
  const authority = ((round as unknown as { authority_levels?: Record<string, SourceAuthority> }).authority_levels ?? {})
  const rationales = (round.rationales ?? {}) as Record<string, string>
  const raw = round[variable as keyof DealRound] as number | null | undefined
  return {
    round: round.round,
    score: raw === null || raw === undefined ? null : criterionScore(variable, raw, evidence[variable], authority[variable]),
    evidence: evidence[variable],
    rationale: rationales[variable]?.trim() || undefined,
  }
}

/**
 * Every round that has something to say about this criterion, most recent
 * first. Rounds where nothing was known are dropped — an empty line teaches
 * nothing, and the gap is visible from the round numbers.
 */
export function criterionHistory(rounds: DealRound[], variable: string, upTo?: number): CriterionSnapshot[] {
  const ordered = [...rounds]
    .filter(r => upTo === undefined || r.round <= upTo)
    .sort((a, b) => a.round - b.round)
    .map(r => snapshot(r, variable))

  const out: CriterionSnapshot[] = []
  for (let i = 0; i < ordered.length; i++) {
    const s = ordered[i]
    if (s.score === null && !s.rationale) continue
    const prev = ordered.slice(0, i).reverse().find(p => p.score !== null || p.rationale)
    out.push({
      ...s,
      changed: !prev || prev.rationale !== s.rationale || prev.score !== s.score || prev.evidence !== s.evidence,
    })
  }
  return out.reverse()
}

/**
 * The round the current reading dates from — the last one that actually
 * changed it. A criterion untouched since round 1 says so instead of passing
 * for fresh.
 */
export function readingSince(rounds: DealRound[], variable: string, upTo: number): number | null {
  const history = criterionHistory(rounds, variable, upTo)
  return history.find(h => h.changed)?.round ?? history[history.length - 1]?.round ?? null
}
