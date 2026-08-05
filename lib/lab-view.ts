import { type DealRound, type EvidenceLevel, type SourceAuthority, LAYER_VARIABLES, VARIABLE_LABELS } from './types'
import { criterionScore, DECISIVE_VARS } from './scoring'
import type { Declaration } from './voice-credit'

// The dashboard's criteria, reorganised for the knowledge panel: what we know
// about each criterion, and on whose word.
//
// This reads only what the engine already stores — scores, evidence levels,
// rationales, declarations. It computes nothing of its own.
export type CriterionView = {
  variable: string
  label: string
  score: number | null
  evidence?: EvidenceLevel
  rationale?: string
  declarations: Declaration[]
  decisive: boolean
}

export function criteriaOfLayer(round: DealRound | null, layer: number): CriterionView[] {
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES] as readonly string[]
  const evidence = (round?.evidence_levels ?? {}) as Record<string, EvidenceLevel>
  const rationales = (round?.rationales ?? {}) as Record<string, string>
  const declarations = (round?.declarations ?? {}) as Record<string, Declaration[]>
  const authority = ((round as unknown as { authority_levels?: Record<string, SourceAuthority> } | null)?.authority_levels ?? {})
  return vars.map(v => ({
    variable: v,
    label: VARIABLE_LABELS[v] ?? v,
    score: round ? criterionScore(v, round[v as keyof DealRound] as number | null, evidence[v], authority[v]) : null,
    evidence: evidence[v],
    rationale: rationales[v],
    declarations: declarations[v] ?? [],
    decisive: (DECISIVE_VARS[layer] ?? []).includes(v),
  }))
}
