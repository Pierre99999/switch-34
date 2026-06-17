// ============================================================
// SCOREJAM TYPES
// ============================================================

export type Vendor = {
  id: string
  user_id: string
  company_name: string
  company_url: string | null
  product_description: string | null
  value_proposition: string | null
  differentiators: string | null
  ideal_customer: string | null
  past_wins: string | null
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
  narrative: string | null
  capture_notes: Record<string, string>
  briefing_line: string | null
  briefing_read: string | null
  briefing_angle: string | null
  briefing_questions: BriefingQuestion[]
  briefing_do_not: string[]
  briefing_mirror: string[]
  briefing_objections: BriefingObjection[]
  briefing_win_condition: string | null
  created_at: string
  updated_at: string
}

export type BriefingQuestion = {
  layer: number
  variable: string
  why: string
  text: string
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

export function getLayerVerdict(round: DealRound | null, layer: number): LayerVerdict {
  if (!round) return 'EMPTY'
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const scores = vars.map(v => round[v as keyof DealRound] as number | null).filter(s => s !== null) as number[]
  if (scores.length === 0) return 'EMPTY'
  const min = Math.min(...scores)
  if (min >= 4) return 'PASS'
  if (min <= 2) return 'AT RISK'
  return 'HOLD'
}
