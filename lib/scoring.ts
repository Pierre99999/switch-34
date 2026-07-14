// ============================================================
// SWITCH SCORING ENGINE — canonical implementation of the book's
// three gates + parallel momentum. See Switch_maj_dashboard_scoring.md.
//
// A criterion score = min(S, cap[E]) where S is the raw signal (0–5)
// captured from conversations and E the evidence level. Evidence caps
// the score, it never boosts it. Missing criteria (no evidence) count
// as 0 in the gate's weighted average: a blind spot weighs against
// the deal.
// ============================================================

import type { DealRound, EvidenceLevel, SourceAuthority } from './types'
import { LAYER_VARIABLES } from './types'

// ── B1 · Criterion score ─────────────────────────────────────

export const EVIDENCE_CAP: Record<EvidenceLevel, number> = {
  declared: 2.5,
  corroborated: 4.0,
  verified: 5.0, // "CHIFFRÉ" — validated by data (amounts, dates, volumes, contracts)
}

// Legitimate-actor rule: when the single declarant is the natural owner
// of the dimension, DÉCLARÉ caps at 4.0 instead of 2.5.
const LEGITIMATE_OWNER: Record<string, SourceAuthority> = {
  strategic_alignment: 'decision_maker', // alignement stratégique → décideur
  adoption_reality: 'end_user',          // adoption → utilisateurs finaux
  implementation_feasibility: 'end_user',// implémentation → équipe technique
  personal_pain_linkage: 'influencer',   // douleur personnelle → la personne concernée
}

export function criterionScore(
  variable: string,
  raw: number | null | undefined,
  evidence: EvidenceLevel | undefined,
  authority: SourceAuthority | undefined,
): number | null {
  if (raw == null) return null // E = AUCUNE → no score, display "—"
  const ev = evidence ?? 'declared'
  let cap = EVIDENCE_CAP[ev]
  if (ev === 'declared' && authority && LEGITIMATE_OWNER[variable] === authority) cap = 4.0
  return Math.round(Math.min(raw, cap) * 10) / 10
}

// ── B2 · Gate weights ────────────────────────────────────────

export const GATE_WEIGHTS: Record<number, Record<string, number>> = {
  1: {
    compelling_reason: 0.30,
    personal_pain_linkage: 0.30,
    real_business_problem: 0.20,
    stakeholder_map: 0.10,
    concerns_fit: 0.10,
  },
  2: {
    urgency: 0.40,
    value_solution_fit: 0.25,
    credibility_perception: 0.20,
    competitive_position: 0.15,
  },
  3: {
    urgency_resolution: 0.30,
    impact: 0.25,
    adoption_reality: 0.20,
    product_capability: 0.15,
    implementation_feasibility: 0.10,
  },
}

// Momentum (B4): builders are scored normally; brakes are captured in
// inverted health (5 = explored & clean, 0 = never explored).
export const MOMENTUM_WEIGHTS: Record<string, number> = {
  value_momentum: 0.25,
  internal_momentum: 0.25,
  strategic_alignment: 0.20,
  open_objections: 0.10,
  process_drag: 0.10,
  external_friction: 0.10,
}
export const MOMENTUM_BRAKES = new Set(['open_objections', 'process_drag', 'external_friction'])

// ⚡ Decisive criteria per gate; none on momentum.
export const DECISIVE_VARS: Record<number, string[]> = {
  1: ['compelling_reason', 'personal_pain_linkage'],
  2: ['urgency'],
  3: ['urgency_resolution'],
}

function scoreOf(round: DealRound, variable: string): number | null {
  const raw = round[variable as keyof DealRound] as number | null
  const evidenceLevels = (round.evidence_levels ?? {}) as Record<string, EvidenceLevel>
  const authorityLevels = ((round as Record<string, unknown>).authority_levels ?? {}) as Record<string, SourceAuthority>
  return criterionScore(variable, raw, evidenceLevels[variable], authorityLevels[variable])
}

// ── Gate score: weighted average, MISSING counts 0 ───────────

export function gateScore(round: DealRound | null, gate: number): number | null {
  if (!round) return null
  const weights = gate === 4 ? MOMENTUM_WEIGHTS : GATE_WEIGHTS[gate]
  if (!weights) return null
  let total = 0
  let any = false
  for (const [variable, weight] of Object.entries(weights)) {
    const s = scoreOf(round, variable)
    if (s !== null) any = true
    // Brakes never explored (null) count 0 too — absence of information
    // is not absence of a brake.
    total += (s ?? 0) * weight
  }
  if (!any) return null
  return Math.round(total * 10) / 10
}

// ── B3 · Gate status ─────────────────────────────────────────

export type GateStatus = 'EMPTY' | 'A_RISQUE' | 'EN_CONSTRUCTION' | 'FRANCHIE' | 'PRETE'

export type GateInfo = {
  score: number | null
  status: GateStatus
  lockMessage: string | null   // e.g. "Bloquée — Raison impérieuse < 2"
  waitingForGate: number | null // set when status is PRETE
  urgencyProven: boolean        // gate 2 bonus badge
}

export function gateInfo(round: DealRound | null, gate: number, prevGatePassed: boolean): GateInfo {
  const score = gateScore(round, gate)
  const none: GateInfo = { score, status: 'EMPTY', lockMessage: null, waitingForGate: null, urgencyProven: false }
  if (score === null || !round) return none

  let status: GateStatus = score < 2.0 ? 'A_RISQUE' : score <= 3.5 ? 'EN_CONSTRUCTION' : 'FRANCHIE'
  let lockMessage: string | null = null
  let urgencyProven = false

  if (gate === 1) {
    // All five conditions are necessary.
    const lows = Object.keys(GATE_WEIGHTS[1]).filter(v => (scoreOf(round, v) ?? 0) < 2.0)
    if (lows.length >= 2) {
      status = 'A_RISQUE'
      lockMessage = lows[0]
    } else if (lows.length === 1) {
      if (status === 'FRANCHIE') status = 'EN_CONSTRUCTION'
      lockMessage = lows[0]
    }
  }
  if (gate === 2) {
    const urgency = scoreOf(round, 'urgency') ?? 0
    if (status === 'FRANCHIE' && urgency < 3.5) status = 'EN_CONSTRUCTION'
    const ev = ((round.evidence_levels ?? {}) as Record<string, EvidenceLevel>)['urgency']
    urgencyProven = ev === 'verified' && (round.urgency ?? 0) > 0
  }
  if (gate === 3) {
    const resolution = scoreOf(round, 'urgency_resolution') ?? 0
    if (status === 'FRANCHIE' && resolution < 3.0) status = 'EN_CONSTRUCTION'
  }

  // Sequentiality: a gate can only display FRANCHIE if the previous one is.
  let waitingForGate: number | null = null
  if (status === 'FRANCHIE' && gate > 1 && !prevGatePassed) {
    status = 'PRETE'
    waitingForGate = gate - 1
  }

  return { score, status, lockMessage, waitingForGate, urgencyProven }
}

// Simple per-layer status for dots and pipeline cells (no sequentiality,
// no momentum trend — those need the full deal history).
export function simpleStatus(round: DealRound | null, layer: number): GateStatus {
  if (layer === 4) {
    const score = gateScore(round, 4)
    if (score === null) return 'EMPTY'
    return score < 2.0 ? 'A_RISQUE' : score <= 3.5 ? 'EN_CONSTRUCTION' : 'FRANCHIE'
  }
  return gateInfo(round, layer, true).status
}

// ── B4 · Momentum (separate mechanics) ───────────────────────

export type MomentumStatus = 'EN_OBSERVATION' | 'VIVANT' | 'FRAGILE' | 'EN_PANNE'

export type MomentumInfo = {
  score: number | null
  status: MomentumStatus
  delta: number | null      // score now − score 3 captures ago
  trend: '↑' | '→' | '↓' | null
  stagnant: boolean         // Δ ≤ 0 over 3 consecutive captures
}

export function momentumInfo(rounds: DealRound[], currentRound: number): MomentumInfo {
  const ordered = [...rounds].sort((a, b) => a.round - b.round).filter(r => r.round <= currentRound)
  const current = ordered[ordered.length - 1] ?? null
  const score = gateScore(current, 4)
  if (score === null) return { score: null, status: 'EN_OBSERVATION', delta: null, trend: null, stagnant: false }

  let delta: number | null = null
  if (ordered.length >= 4) {
    const past = gateScore(ordered[ordered.length - 4], 4)
    if (past !== null) delta = Math.round((score - past) * 10) / 10
  }

  let status: MomentumStatus
  if (delta === null && ordered.length < 4) {
    status = score >= 3.5 ? 'VIVANT' : score >= 2.0 ? 'EN_OBSERVATION' : 'EN_PANNE'
  } else if (score < 2.0 || (delta !== null && delta < 0)) {
    status = 'EN_PANNE'
  } else if (score >= 3.5 && (delta === null || delta >= 0)) {
    status = 'VIVANT'
  } else {
    status = 'FRAGILE'
  }
  if (delta !== null && delta === 0 && score >= 2.0 && score < 3.5) status = 'FRAGILE'

  const trend = delta === null ? null : delta > 0 ? '↑' : delta < 0 ? '↓' : '→'
  const stagnant = delta !== null && delta <= 0
  return { score, status, delta, trend, stagnant }
}

// ── Deal state: all gates + momentum, sequentially resolved ──

export type DealState = {
  gates: Record<number, GateInfo>
  momentum: MomentumInfo
  activeGate: number // first gate not FRANCHIE (deal stage)
}

export function computeDealState(rounds: DealRound[], currentRoundNumber: number): DealState {
  const current = rounds.find(r => r.round === currentRoundNumber) ?? null
  const gates: Record<number, GateInfo> = {}
  let prevPassed = true
  let activeGate = 4
  for (const g of [1, 2, 3]) {
    const info = gateInfo(current, g, prevPassed)
    gates[g] = info
    if (prevPassed && info.status !== 'FRANCHIE' && activeGate === 4) activeGate = g
    prevPassed = info.status === 'FRANCHIE'
  }
  const momentum = momentumInfo(rounds, currentRoundNumber)
  return { gates, momentum, activeGate }
}

// ── B5 · Prescriptions for the next briefing ─────────────────

export type Prescription = {
  variable: string
  kind: 'MANQUANT' | 'CORROBORER' | 'NEGATIF'
}

export function prescriptions(round: DealRound | null): Prescription[] {
  if (!round) return []
  const out: Prescription[] = []
  const evidenceLevels = (round.evidence_levels ?? {}) as Record<string, EvidenceLevel>
  const lockVars = new Set(Object.values(DECISIVE_VARS).flat())
  const allVars = Object.values(LAYER_VARIABLES).flat() as string[]
  for (const v of allVars) {
    const s = scoreOf(round, v)
    if (s !== null && s >= 3.5) continue
    if (s === null) {
      out.push({ variable: v, kind: 'MANQUANT' })
    } else if ((evidenceLevels[v] ?? 'declared') === 'declared') {
      out.push({ variable: v, kind: 'CORROBORER' })
    } else if (s < 2.0 && lockVars.has(v)) {
      out.push({ variable: v, kind: 'NEGATIF' })
    } else {
      out.push({ variable: v, kind: 'CORROBORER' })
    }
  }
  return out
}
