// Shared helpers for building AI prompts from deal + vendor context

import { type Vendor, type Deal, type DealRound, LAYER_VARIABLES, LAYER_LABELS, VARIABLE_LABELS, getLayerVerdict } from './types'

export function buildVendorContext(vendor: Vendor): string {
  const d = vendor.dimensions
  if (!d) return `Vendor: ${vendor.company_name}\nProduct: ${vendor.product_description ?? ''}\nValue prop: ${vendor.value_proposition ?? ''}`

  const sections: string[] = [`VENDOR: ${vendor.company_name}`]
  if (d.value?.problem) sections.push(`Problem solved: ${d.value.problem}`)
  if (d.value?.point_of_view) sections.push(`Point of view: ${d.value.point_of_view}`)
  if (d.value?.value_delivered) sections.push(`Value delivered: ${d.value.value_delivered}`)
  if (d.value?.competitive_standing) sections.push(`Competitive standing: ${d.value.competitive_standing}`)
  if (d.target?.who_youre_for) sections.push(`ICP: ${d.target.who_youre_for}`)
  if (d.target?.qualification) sections.push(`Qualification: ${d.target.qualification}`)
  if (d.target?.sales_motion) sections.push(`Sales motion: ${d.target.sales_motion}`)
  if (d.product?.current_product) sections.push(`Product: ${d.product.current_product}`)
  if (d.product?.defensibility) sections.push(`Defensibility: ${d.product.defensibility}`)
  return sections.join('\n')
}

export function buildProspectContext(deal: Deal): string {
  const d = deal.prospect_dimensions
  const lines: string[] = [`PROSPECT: ${deal.prospect_name}`]
  if (deal.contact_name) lines.push(`Contact: ${deal.contact_name}${deal.contact_title ? ` (${deal.contact_title})` : ''}`)
  if (!d) return lines.join('\n')
  if (d.company?.core_business) lines.push(`Business: ${d.company.core_business}`)
  if (d.company?.industry) lines.push(`Industry: ${d.company.industry}`)
  if (d.strategic_context?.priorities) lines.push(`Priorities: ${d.strategic_context.priorities}`)
  if (d.strategic_context?.challenges) lines.push(`Challenges: ${d.strategic_context.challenges}`)
  if (d.strategic_context?.pressures) lines.push(`Pressures: ${d.strategic_context.pressures}`)
  if (d.buying_environment?.decision_process) lines.push(`Decision process: ${d.buying_environment.decision_process}`)
  if (d.buying_environment?.timeline) lines.push(`Timeline: ${d.buying_environment.timeline}`)
  if (d.key_contact?.role_accountability) lines.push(`Contact role: ${d.key_contact.role_accountability}`)
  if (d.key_contact?.personal_priorities) lines.push(`Contact priorities: ${d.key_contact.personal_priorities}`)
  if (d.fit_signals?.problem_mapping) lines.push(`Fit: ${d.fit_signals.problem_mapping}`)
  if (d.fit_signals?.timing_trigger) lines.push(`Timing trigger: ${d.fit_signals.timing_trigger}`)
  return lines.join('\n')
}

export function buildScoresContext(round: DealRound): string {
  const lines: string[] = [`ROUND ${round.round} SCORES:`]
  for (const [layer, vars] of Object.entries(LAYER_VARIABLES)) {
    const verdict = getLayerVerdict(round, Number(layer))
    lines.push(`\nLayer ${layer} — ${LAYER_LABELS[Number(layer)]} [${verdict}]`)
    for (const v of vars as string[]) {
      const score = round[v as keyof DealRound] as number | null
      lines.push(`  ${VARIABLE_LABELS[v]}: ${score !== null ? `${score}/5` : 'not scored'}`)
    }
  }
  return lines.join('\n')
}

export function buildCaptureContext(rounds: DealRound[]): string {
  const lines: string[] = []
  for (const r of rounds) {
    const notes = r.capture_notes as Record<string, string> | null
    if (!notes) continue
    const entries = Object.entries(notes).filter(([k, v]) => k !== '__free__' && v.trim())
    const free = notes.__free__?.trim()
    if (entries.length === 0 && !free) continue
    lines.push(`\nROUND ${r.round} CAPTURE:`)
    for (const [k, v] of entries) lines.push(`  [${k}] ${v}`)
    if (free) lines.push(`  [other] ${free}`)
  }
  return lines.join('\n')
}
