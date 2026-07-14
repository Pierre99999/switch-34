// Shared helpers for building AI prompts from deal + vendor context

import { type Vendor, type Deal, type DealRound, type EvidenceLevel, LAYER_VARIABLES, LAYER_LABELS, VARIABLE_LABELS, EVIDENCE_LABELS } from './types'
import { simpleStatus, gateScore, prescriptions, DECISIVE_VARS } from './scoring'
import { evidenceFromDeclarations } from './voice-credit'
import type { VoiceDeclaration } from './types'

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

  if (d._dynamic && d.dimensions) {
    if (d.sales_context) lines.push(`Sales focus: ${d.sales_context}`)
    for (const dim of d.dimensions) {
      const filled = dim.fields.filter(f => f.value.trim())
      if (filled.length === 0) continue
      lines.push(`\n${dim.label}:`)
      for (const f of filled) lines.push(`  ${f.label}: ${f.value}`)
    }
  } else {
    const legacy = d as unknown as Record<string, Record<string, string>>
    for (const [section, fields] of Object.entries(legacy)) {
      if (typeof fields !== 'object' || !fields) continue
      for (const [k, v] of Object.entries(fields)) {
        if (v?.trim()) lines.push(`${k.replace(/_/g, ' ')}: ${v}`)
      }
    }
  }
  return lines.join('\n')
}

export function buildScoresContext(round: DealRound): string {
  const lines: string[] = [`ROUND ${round.round} SCORES:`]
  for (const [layer, vars] of Object.entries(LAYER_VARIABLES)) {
    const verdict = simpleStatus(round, Number(layer))
    const score = gateScore(round, Number(layer))
    const gateName = Number(layer) === 4 ? 'MOMENTUM (parallel)' : `GATE ${layer}`
    lines.push(`\n${gateName} — ${LAYER_LABELS[Number(layer)]} [${verdict}${score !== null ? ` · ${score}/5` : ''}]`)
    for (const v of vars as readonly string[]) {
      const score = round[v as keyof DealRound] as number | null
      const ev = (round.evidence_levels ?? {})[v] as EvidenceLevel | undefined
      const evLabel = ev ? ` [${EVIDENCE_LABELS[ev]}]` : ''
      lines.push(`  ${VARIABLE_LABELS[v]}: ${score !== null ? `${score}/5${evLabel}` : 'not scored'}`)
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


// B5 — Prescriptions: for every criterion < 3.5, tell the briefing engine
// what the next conversation must accomplish.
export function buildPrescriptionsContext(round: DealRound): string {
  const items = prescriptions(round)
  if (items.length === 0) return ''
  const lockVars = new Set(Object.values(DECISIVE_VARS).flat())
  const lines: string[] = ['PRESCRIPTIONS (criteria below 3.5 — each must produce an action in this briefing):']
  for (const it of items) {
    const label = VARIABLE_LABELS[it.variable] ?? it.variable
    if (it.kind === 'MANQUANT') {
      lines.push(`  ${label}: MISSING — no evidence at all. Prescribe the conversation to open this zone.`)
    } else if (it.kind === 'NEGATIF') {
      lines.push(`  ${label}: NEGATIVE and corroborated on a lock criterion${lockVars.has(it.variable) ? '' : ''} — flag the clean exit as an option.`)
    } else {
      lines.push(`  ${label}: only DECLARED — prescribe corroboration: who else can confirm? what number proves it?`)
    }
  }
  return lines.join('\n')
}

// Voice-credit alarms & arbitration prescriptions (Switch_credit_de_voix.md).
// Recomputed from the stored declarations so the next briefing acts on them.
export function buildVoiceContext(round: DealRound): string {
  const declarations = ((round as unknown as { declarations?: Record<string, VoiceDeclaration[]> }).declarations) ?? {}
  const alarms: string[] = []
  const prescriptions: string[] = []
  for (const [variable, decls] of Object.entries(declarations)) {
    const r = evidenceFromDeclarations(variable, decls as unknown as Parameters<typeof evidenceFromDeclarations>[1])
    for (const a of r.alarms) alarms.push(a)
    for (const p of r.prescriptions) prescriptions.push(p)
  }
  if (alarms.length === 0 && prescriptions.length === 0) return ''
  const lines: string[] = []
  if (alarms.length) {
    lines.push('ALARM SIGNALS (a natural advocate voiced doubt — address head-on):')
    for (const a of alarms) lines.push(`  ${a}`)
  }
  if (prescriptions.length) {
    lines.push('VOICE PRESCRIPTIONS (resolve these before advancing):')
    for (const p of [...new Set(prescriptions)]) lines.push(`  ${p}`)
  }
  return lines.join('\n')
}
