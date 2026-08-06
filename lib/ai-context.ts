// Shared helpers for building AI prompts from deal + vendor context

import { type Vendor, type Deal, type DealRound, type EvidenceLevel, LAYER_VARIABLES, LAYER_LABELS, VARIABLE_LABELS, EVIDENCE_LABELS } from './types'
import { simpleStatus, gateScore, prescriptions, DECISIVE_VARS } from './scoring'
import { evidenceFromDeclarations } from './voice-credit'
import type { VoiceDeclaration } from './types'
import { normalizePlaybook, playbookToContext } from './playbook'
import { normalizeFit, FIT_AXIS_LABELS, FIT_AXIS_SOURCE, type ActorCoverage } from './playbook-fit'
import { normalizeSellerRead, buildSellerReadContext } from './seller-read'

// The seller's subjective read of the last conversation, for the briefing.
export function buildSellerRead(round: DealRound | null): string {
  return buildSellerReadContext(normalizeSellerRead((round as unknown as { seller_read?: unknown } | null)?.seller_read))
}

export function buildVendorContext(vendor: Vendor): string {
  // The problem they named at onboarding. Everything the AI produces should
  // visibly serve it — that is what makes the output feel worth the input.
  const challenge = [vendor.sales_challenge, vendor.sales_challenge_note]
    .filter(Boolean).join(' — ')
  const challengeLine = challenge ? `\nTHIS SELLER'S STATED CHALLENGE: ${challenge}` : ''

  // The Sales Playbook socle is the current source of truth.
  const socle = playbookToContext(normalizePlaybook(vendor.playbook, vendor.locale ?? 'fr'), vendor.locale ?? 'fr')
  if (socle) {
    return [`VENDOR: ${vendor.company_name}`, challenge ? `Stated challenge: ${challenge}` : '', socle]
      .filter(Boolean).join('\n')
  }

  // Fallback for accounts created before the playbook replaced the profile.
  const d = vendor.dimensions
  if (!d) return `Vendor: ${vendor.company_name}\nProduct: ${vendor.product_description ?? ''}\nValue prop: ${vendor.value_proposition ?? ''}${challengeLine}`

  const sections: string[] = [`VENDOR: ${vendor.company_name}`]
  if (challenge) sections.push(`Stated challenge: ${challenge}`)
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

// How this deal reads against the socle. Given to the briefing so it can turn
// an uncertain axis into a question to ask, rather than leaving it hanging.
export function buildFitContext(deal: Deal): string {
  const fit = normalizeFit(deal.playbook_fit)
  if (!fit) return ''
  const lines = [
    `PLAYBOOK FIT (${fit.basis === 'context' ? 'HYPOTHESIS — formed from the prospect\'s public material, not yet confirmed by any conversation' : 'informed by captured conversation'}):`,
  ]
  if (fit.avoid_list_hit) lines.push('  ⚠ This prospect matches a segment the team decided to AVOID.')
  for (const a of fit.axes) {
    const name = FIT_AXIS_LABELS[a.key].en
    lines.push(`  - ${name} (${FIT_AXIS_SOURCE[a.key]}): ${a.verdict}${a.summary ? ` — ${a.summary}` : ''}`)
    if (a.playbook_ref) lines.push(`      playbook: ${a.playbook_ref}`)
    if (a.gap) lines.push(`      to settle: ${a.gap}`)
  }
  return lines.join('\n')
}

// Fit gaps as mandated actions, in the same channel as the score-based
// prescriptions — the briefing already cannot ignore that section. A prospect
// who does not match the playbook is a deal you have little chance of winning,
// so every unsettled axis is a question the next conversation owes you.
export function buildFitPrescriptions(deal: Deal, coverage?: ActorCoverage): string {
  const fit = normalizeFit(deal.playbook_fit)
  const lines: string[] = []

  if (fit) {
    const unsettled = fit.axes.filter(a => a.verdict !== 'aligned')
    for (const a of unsettled) {
      const name = FIT_AXIS_LABELS[a.key].en
      const what = a.gap?.trim() || a.reason?.trim() || a.summary?.trim() || ''
      const head = a.verdict === 'mismatch'
        ? `FIT · ${name} — OFF-BOOK: this prospect contradicts the playbook here.`
        : a.verdict === 'unknown'
          ? `FIT · ${name} — UNKNOWN: nothing tells us either way yet.`
          : `FIT · ${name} — PARTIAL: it matches only in part.`
      lines.push(`  ${head}${what ? ` The conversation must settle: ${what}` : ''}`)
    }
    if (fit.avoid_list_hit) {
      lines.push('  FIT · AVOID LIST — this prospect matches a segment the team decided to stop selling to. Treat the exception as the subject of the conversation, not a detail.')
    }
  }

  // A missing necessary actor is the most actionable gap of all: the fix is a
  // person to get into the room, not a question to ask.
  for (const m of coverage?.missing ?? []) {
    lines.push(`  FIT · ACTOR — "${m.label}" is required by the playbook and absent from this deal.${m.risk ? ` Risk: ${m.risk}` : ''} The conversation must open a path to them.`)
  }

  if (lines.length === 0) return ''
  return ['PLAYBOOK FIT PRESCRIPTIONS (unsettled — each must shape this briefing):', ...lines].join('\n')
}

// A4 is a list of objections the team already knows how to defuse, with the
// wording they chose. Handing it to the briefing costs no question slot: the
// work is done, it just has to reach the right deal at the right moment.
export function buildKnownObjections(vendor: Vendor): string {
  const pb = normalizePlaybook(vendor.playbook, vendor.locale ?? 'fr')
  const rows = pb.a4_perception.filter(r => (r.objection ?? '').trim())
  if (rows.length === 0) return ''
  const lines = ['KNOWN PERCEPTION OBJECTIONS (from the playbook, A4 — the team already wrote how to defuse each):']
  for (const r of rows) {
    lines.push(`  - "${r.objection.trim()}"${r.prospect_type?.trim() ? ` [with: ${r.prospect_type.trim()}]` : ''}`)
    if (r.defuse?.trim()) lines.push(`      their own defusing line: ${r.defuse.trim()}`)
  }
  return lines.join('\n')
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

// Does this round hold anything a human actually captured? Scoring a round
// with no captured conversation is meaningless — the model would score the
// prospect's website instead of what was said — so the AI routes refuse it.
export function hasCaptureContent(round: { capture_notes?: unknown } | null): boolean {
  const notes = (round?.capture_notes ?? null) as Record<string, string> | null
  if (!notes) return false
  return Object.values(notes).some(v => typeof v === 'string' && v.trim().length > 0)
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
    } else if (it.kind === 'CORROBORER') {
      lines.push(`  ${label}: only DECLARED — prescribe corroboration: who else can confirm? what number proves it?`)
    } else {
      lines.push(`  ${label}: already corroborated but WEAK — do not ask for another witness, ask for precision: a figure, a date, a named consequence.`)
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
    for (const a of r.alarms) alarms.push(`${a.role} voices doubt on ${VARIABLE_LABELS[a.variable] ?? a.variable}`)
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
