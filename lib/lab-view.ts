import { type DealRound, type EvidenceLevel, type SourceAuthority, LAYER_VARIABLES, VARIABLE_LABELS } from './types'
import { translations } from './i18n/translations'
import { criterionScore, DECISIVE_VARS } from './scoring'
import type { Declaration } from './voice-credit'

// VARIABLE_LABELS is the English internal wording the AI prompts use. Screens
// take their labels from the translation table, which is the single place any
// wording change has to happen.
export function criterionLabel(variable: string, locale = 'fr'): string {
  const entry = (translations as Record<string, { fr: string; en: string } | undefined>)[`var.${variable}`]
  if (entry) return locale === 'fr' ? entry.fr : entry.en
  return VARIABLE_LABELS[variable] ?? variable
}

// The gate's name and its question, both from the translation table. They
// were copied into three components; a rename has to happen once.
export function gateName(layer: number, locale = 'fr'): string {
  const e = (translations as Record<string, { fr: string; en: string } | undefined>)[`layer.${layer}`]
  return e ? (locale === 'fr' ? e.fr : e.en) : String(layer)
}

export function gateQuestion(layer: number, locale = 'fr'): string {
  const e = (translations as Record<string, { fr: string; en: string } | undefined>)[`layer.q${layer}`]
  return e ? (locale === 'fr' ? e.fr : e.en) : ''
}

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
    label: criterionLabel(v),
    score: round ? criterionScore(v, round[v as keyof DealRound] as number | null, evidence[v], authority[v]) : null,
    evidence: evidence[v],
    rationale: rationales[v],
    declarations: declarations[v] ?? [],
    decisive: (DECISIVE_VARS[layer] ?? []).includes(v),
  }))
}
