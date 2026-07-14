// ============================================================
// VOICE WEIGHTS — actor × criterion matrix (Switch_credit_de_voix.md §3)
// The authority of a voice depends on the dimension. Each declaration
// carries a weight w: 1.0 = owner of the dimension, 0.7 = directly
// concerned, 0.4 = peripheral (default: unknown or unqualified role).
// ============================================================

// Canonical roles used by the engine.
export type ActorRole =
  | 'decideur'
  | 'champion'
  | 'acheteur_technique'
  | 'gardien_du_budget'
  | 'utilisateur'
  | 'bloqueur'
  | 'unknown'

// Map stored stakeholder actor_type → canonical role.
export const ACTOR_TYPE_TO_ROLE: Record<string, ActorRole> = {
  decision_maker: 'decideur',
  champion: 'champion',
  reviewer: 'acheteur_technique',
  budget_guardian: 'gardien_du_budget',
  user: 'utilisateur',
  blocker: 'bloqueur',
  unknown: 'unknown',
}

// Presumed leaning toward the deal (used for the against-interest rule).
export const ROLE_INTEREST: Record<ActorRole, 'pro' | 'con' | 'neutral'> = {
  decideur: 'pro',
  champion: 'pro',
  utilisateur: 'pro',
  bloqueur: 'con',
  acheteur_technique: 'neutral',
  gardien_du_budget: 'neutral',
  unknown: 'neutral',
}

// Resistant roles: a favorable stance from them runs against their interest
// → the voice is amplified ×1.5 (capped at 1.5).
export const RESISTANT_ROLES = new Set<ActorRole>(['bloqueur', 'gardien_du_budget'])

// Natural advocates: an unfavorable stance from them is an alarm and its
// negative signal is amplified.
export const ADVOCATE_ROLES = new Set<ActorRole>(['champion', 'decideur'])

// Matrix — key = criterion variable, values = role lists per tier.
// Any role not listed → 0.4 (peripheral default).
export const VOICE_WEIGHTS: Record<string, { '1.0': ActorRole[]; '0.7': ActorRole[] }> = {
  real_business_problem:      { '1.0': ['decideur', 'champion'], '0.7': ['utilisateur', 'bloqueur'] },
  compelling_reason:          { '1.0': ['decideur'], '0.7': ['champion', 'gardien_du_budget'] },
  concerns_fit:               { '1.0': ['champion'], '0.7': ['decideur', 'acheteur_technique'] },
  stakeholder_map:            { '1.0': ['champion'], '0.7': [] }, // ¹ corroborated by diversity of actors met
  personal_pain_linkage:      { '1.0': [], '0.7': [] },           // owner flag → 1.0, direct witness → 0.7 default
  credibility_perception:     { '1.0': [], '0.7': [] },           // each on their OWN perception → owner 1.0
  value_solution_fit:         { '1.0': ['acheteur_technique', 'champion'], '0.7': ['decideur', 'utilisateur'] },
  competitive_position:       { '1.0': ['champion'], '0.7': ['acheteur_technique', 'gardien_du_budget'] },
  urgency:                    { '1.0': ['decideur', 'gardien_du_budget'], '0.7': ['champion'] },
  product_capability:         { '1.0': ['acheteur_technique'], '0.7': ['utilisateur', 'champion'] },
  implementation_feasibility: { '1.0': ['acheteur_technique'], '0.7': ['utilisateur', 'champion'] },
  adoption_reality:           { '1.0': ['utilisateur'], '0.7': ['champion', 'bloqueur'] }, // ² blocker in counter-interest corroborates alone
  impact:                     { '1.0': ['decideur', 'gardien_du_budget'], '0.7': ['champion'] },
  urgency_resolution:         { '1.0': ['decideur'], '0.7': ['champion'] },
  strategic_alignment:        { '1.0': ['decideur'], '0.7': ['champion'] },
  internal_momentum:          { '1.0': ['champion'], '0.7': [] }, // any internal actor → 0.4 default
  value_momentum:             { '1.0': ['decideur', 'champion'], '0.7': ['acheteur_technique'] },
  open_objections:            { '1.0': [], '0.7': ['champion'] },
  process_drag:               { '1.0': [], '0.7': ['champion'] },
  external_friction:          { '1.0': [], '0.7': ['champion'] },
}

// Criteria where the owner is the person speaking about themselves.
export const SELF_OWNER_CRITERIA = new Set(['personal_pain_linkage', 'credibility_perception'])

// The natural owner role for a criterion (for arbitration prescriptions).
export function ownerRole(variable: string): ActorRole | 'le propriétaire de la dimension' {
  return VOICE_WEIGHTS[variable]?.['1.0'][0] ?? 'le propriétaire de la dimension'
}

export function voiceWeight(variable: string, role: ActorRole, owner?: boolean): number {
  if (owner && SELF_OWNER_CRITERIA.has(variable)) return 1.0
  const m = VOICE_WEIGHTS[variable]
  if (!m) return 0.4
  if (m['1.0'].includes(role)) return 1.0
  if (m['0.7'].includes(role)) return 0.7
  return 0.4
}
