// ============================================================
// SWITCH TYPES
// ============================================================

// ── Vendor 9-dimension profile ────────────────────────────────

export type VendorDimensions = {
  value: {
    problem: string
    point_of_view: string
    value_delivered: string
    value_reliability: string
    market_response: string
    competitive_standing: string
  }
  target: {
    who_youre_for: string
    positioning: string
    market_timing: string
    qualification: string
    sales_motion: string
    customer_knowledge: string
  }
  product: {
    current_product: string
    vision: string
    roadmap: string
    defensibility: string
    user_experience: string
    technical_foundation: string
    product_health: string
  }
  reach: {
    gtm_model: string
    reach_focus: string
    message_cta: string
    channels: string
    execution_capacity: string
    performance: string
  }
  usage: {
    core_action: string
    feature_adoption: string
    retention: string
    churn: string
    expansion: string
    monetization: string
    instrumentation: string
  }
  finance: {
    revenue: string
    costs: string
    capital_runway: string
    unit_economics: string
    forecasting: string
  }
  scale: {
    growth_channel: string
    bottleneck: string
    investment_focus: string
    talent_plan: string
  }
  playbook: {
    capture_lessons: string
    codify: string
    build_capability: string
    impact: string
  }
  foundations: {
    vision_purpose: string
    culture: string
    team_status: string
    engagement: string
    strengths: string
  }
}

// ── Prospect dynamic profile ─────────────────────────────────

export type ProspectField = {
  key: string
  label: string
  hint: string
  value: string
}

export type ProspectDimension = {
  key: string
  label: string
  fields: ProspectField[]
}

export type ProspectDimensions = {
  _dynamic: true
  sales_context: string
  dimensions: ProspectDimension[]
}

// Legacy fixed-shape type for backward compatibility with old deals
export type LegacyProspectDimensions = {
  company?: Record<string, string>
  strategic_context?: Record<string, string>
  buying_environment?: Record<string, string>
  key_contact?: Record<string, string>
  fit_signals?: Record<string, string>
}

export const EMPTY_VENDOR_DIMENSIONS: VendorDimensions = {
  value: { problem: '', point_of_view: '', value_delivered: '', value_reliability: '', market_response: '', competitive_standing: '' },
  target: { who_youre_for: '', positioning: '', market_timing: '', qualification: '', sales_motion: '', customer_knowledge: '' },
  product: { current_product: '', vision: '', roadmap: '', defensibility: '', user_experience: '', technical_foundation: '', product_health: '' },
  reach: { gtm_model: '', reach_focus: '', message_cta: '', channels: '', execution_capacity: '', performance: '' },
  usage: { core_action: '', feature_adoption: '', retention: '', churn: '', expansion: '', monetization: '', instrumentation: '' },
  finance: { revenue: '', costs: '', capital_runway: '', unit_economics: '', forecasting: '' },
  scale: { growth_channel: '', bottleneck: '', investment_focus: '', talent_plan: '' },
  playbook: { capture_lessons: '', codify: '', build_capability: '', impact: '' },
  foundations: { vision_purpose: '', culture: '', team_status: '', engagement: '', strengths: '' },
}

export const EMPTY_PROSPECT_DIMENSIONS: ProspectDimensions = {
  _dynamic: true,
  sales_context: '',
  dimensions: [],
}

export function isLegacyDimensions(d: unknown): d is LegacyProspectDimensions {
  return !!d && typeof d === 'object' && !('_dynamic' in (d as Record<string, unknown>))
}

export function migrateLegacyDimensions(d: LegacyProspectDimensions): ProspectDimensions {
  const dims: ProspectDimension[] = []
  const sections: { key: string; label: string; data?: Record<string, string> }[] = [
    { key: 'company', label: 'Company', data: d.company },
    { key: 'strategic_context', label: 'Strategic Context', data: d.strategic_context },
    { key: 'buying_environment', label: 'Buying Environment', data: d.buying_environment },
    { key: 'key_contact', label: 'Key Contact', data: d.key_contact },
    { key: 'fit_signals', label: 'Fit Signals', data: d.fit_signals },
  ]
  for (const s of sections) {
    if (!s.data) continue
    const fields: ProspectField[] = Object.entries(s.data)
      .filter(([, v]) => v.trim())
      .map(([k, v]) => ({ key: k, label: k.replace(/_/g, ' '), hint: '', value: v }))
    if (fields.length > 0) dims.push({ key: s.key, label: s.label, fields })
  }
  return { _dynamic: true, sales_context: '', dimensions: dims }
}

export type UserRole = 'sales' | 'director'

export type Organization = {
  id: string
  name: string
  owner_id: string
  invite_code: string
  created_at: string
}

export type QuestionTemplate = {
  id: string
  organization_id: string
  text: string
  category: string
  created_by: string | null
  created_at: string
  updated_at: string
}

export type Vendor = {
  id: string
  user_id: string
  company_name: string
  full_name: string | null
  role: UserRole
  organization_id: string | null
  locale: string | null
  onboarding_completed: boolean
  company_url: string | null
  product_description: string | null
  value_proposition: string | null
  differentiators: string | null
  ideal_customer: string | null
  past_wins: string | null
  sales_context_template: string | null
  dimensions: VendorDimensions | null
  created_at: string
  updated_at: string
}

export type Deal = {
  id: string
  user_id: string
  prospect_name: string
  prospect_url: string | null
  contact_name: string | null
  contact_title: string | null
  contact_linkedin: string | null
  current_round: number
  status: 'active' | 'won' | 'lost' | 'paused'
  potential_revenue: number | null
  prospect_dimensions: ProspectDimensions | null
  created_at: string
  updated_at: string
}

export type DealRound = {
  id: string
  deal_id: string
  round: number
  // Layer 1
  real_business_problem: number | null
  compelling_reason: number | null
  concerns_fit: number | null
  stakeholder_map: number | null
  personal_pain_linkage: number | null
  // Layer 2
  credibility_perception: number | null
  value_solution_fit: number | null
  competitive_position: number | null
  urgency: number | null
  // Layer 3
  product_capability: number | null
  implementation_feasibility: number | null
  adoption_reality: number | null
  impact: number | null
  urgency_resolution: number | null
  // Layer 4
  value_momentum: number | null
  strategic_alignment: number | null
  internal_momentum: number | null
  open_objections: number | null
  process_drag: number | null
  external_friction: number | null
  rationales: Record<string, string>
  capture_notes: Record<string, string>
  briefing_line: string | null
  briefing_read: string | null
  briefing_angle: string | null
  briefing_questions: BriefingQuestion[]
  briefing_do_not: string[]
  briefing_mirror: string[]
  briefing_objections: BriefingObjection[]
  briefing_win_condition: string | null
  mandatory_questions: string[]
  selected_templates: string[]
  evidence_levels: Record<string, EvidenceLevel>
  authority_levels: Record<string, SourceAuthority>
  created_at: string
  updated_at: string
}

export type BriefingQuestion = {
  layer: number
  variable: string
  intent: string           // what this question is trying to establish
  text: string             // the main question to ask
  sub_questions: string[]  // follow-up probes if the main question opens a thread
  priority: 'pressing' | 'opportunistic'
}

export type BriefingObjection = {
  likely: string
  frame: string
}

export type Stakeholder = {
  id: string
  deal_id: string
  name: string
  role: string | null
  actor_type: 'champion' | 'decision_maker' | 'user' | 'reviewer' | 'blocker' | 'unknown'
  notes: string | null
  first_seen_round: number | null
  created_at: string
}

export type DealBox = {
  id: string
  deal_id: string
  box_id: string
  entries: BoxEntry[]
  updated_at: string
}

export type BoxEntry = {
  round: number
  text: string
}

export type DealTheme = {
  id: string
  deal_id: string
  title: string
  body: string | null
  rounds: number[]
  created_at: string
}

export type MirrorTerm = {
  id: string
  deal_id: string
  term: string
  round: number | null
}

// ============================================================
// EVIDENCE LEVELS — cap how high a score can go
// ============================================================

export type EvidenceLevel = 'declared' | 'corroborated' | 'verified'
export type SourceAuthority = 'decision_maker' | 'influencer' | 'end_user'

export const EVIDENCE_CAP: Record<EvidenceLevel, number> = {
  declared: 3,
  corroborated: 4,
  verified: 5,
}

export const EVIDENCE_LABELS: Record<EvidenceLevel, string> = {
  declared: 'Declared',
  corroborated: 'Corroborated',
  verified: 'Verified',
}

export const EVIDENCE_DESCRIPTIONS: Record<EvidenceLevel, string> = {
  declared: 'One person said it, no proof',
  corroborated: 'Multiple sources or repeated across rounds',
  verified: 'Hard data, documents, or metrics shared',
}

export const EVIDENCE_WEIGHT: Record<EvidenceLevel, number> = {
  declared: 0.6,
  corroborated: 0.85,
  verified: 1.0,
}

export const AUTHORITY_WEIGHT: Record<SourceAuthority, number> = {
  decision_maker: 1.0,
  influencer: 0.85,
  end_user: 0.7,
}

export const AUTHORITY_LABELS: Record<SourceAuthority, string> = {
  decision_maker: 'Decision Maker',
  influencer: 'Influencer',
  end_user: 'End User',
}

export function capScore(score: number, evidence: EvidenceLevel): number {
  return Math.min(score, EVIDENCE_CAP[evidence])
}

export function weightedScore(score: number, evidence: EvidenceLevel, authority: SourceAuthority = 'end_user'): number {
  return Math.min(score, EVIDENCE_CAP[evidence]) * EVIDENCE_WEIGHT[evidence] * AUTHORITY_WEIGHT[authority]
}

// ============================================================
// SCORING HELPERS
// ============================================================

export type LayerVerdict = 'PASS' | 'HOLD' | 'AT RISK' | 'EMPTY' | 'EMERGING' | 'NASCENT'

export const LAYER_VARIABLES = {
  1: ['real_business_problem', 'compelling_reason', 'concerns_fit', 'stakeholder_map', 'personal_pain_linkage'],
  2: ['credibility_perception', 'value_solution_fit', 'competitive_position', 'urgency'],
  3: ['product_capability', 'implementation_feasibility', 'adoption_reality', 'impact', 'urgency_resolution'],
  4: ['value_momentum', 'strategic_alignment', 'internal_momentum', 'open_objections', 'process_drag', 'external_friction'],
} as const

export const LAYER_LABELS: Record<number, string> = {
  1: 'Opportunity',
  2: 'Winability',
  3: 'Impact',
  4: 'Momentum',
}

export const VARIABLE_LABELS: Record<string, string> = {
  real_business_problem: 'Real Business Problem',
  compelling_reason: 'Compelling Reason',
  concerns_fit: 'Concerns Fit',
  stakeholder_map: 'Stakeholder Map',
  personal_pain_linkage: 'Personal Pain Linkage',
  credibility_perception: 'Credibility & Perception',
  value_solution_fit: 'Value & Solution Fit',
  competitive_position: 'Competitive Position',
  urgency: 'Urgency',
  product_capability: 'Product Capability',
  implementation_feasibility: 'Implementation Feasibility',
  adoption_reality: 'Adoption Reality',
  impact: 'Impact',
  urgency_resolution: 'Urgency Resolution',
  value_momentum: 'Value Momentum',
  strategic_alignment: 'Strategic Alignment',
  internal_momentum: 'Internal Momentum',
  open_objections: 'Open Objections',
  process_drag: 'Process Drag',
  external_friction: 'External Friction',
}

export function getLayerAverage(round: DealRound | null, layer: number): number | null {
  if (!round) return null
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const evidenceLevels = (round.evidence_levels ?? {}) as Record<string, EvidenceLevel>
  const authorityLevels = (round.authority_levels ?? {}) as Record<string, SourceAuthority>
  const weighted: number[] = []
  for (const v of vars) {
    const raw = round[v as keyof DealRound] as number | null
    if (raw === null) continue
    const ev: EvidenceLevel = evidenceLevels[v] ?? 'declared'
    const auth: SourceAuthority = authorityLevels[v] ?? 'end_user'
    weighted.push(weightedScore(raw, ev, auth))
  }
  if (weighted.length === 0) return null
  return weighted.reduce((a, b) => a + b, 0) / vars.length
}

export function getLayerVerdict(round: DealRound | null, layer: number): LayerVerdict {
  const avg = getLayerAverage(round, layer)
  if (avg === null) return 'EMPTY'
  if (avg >= 3.5) return 'PASS'
  if (avg < 2.5) return 'AT RISK'
  return 'HOLD'
}
