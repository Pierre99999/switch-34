// ============================================================
// VOICE CREDIT (Switch_credit_de_voix.md §2)
// Replaces voice-counting with a weighted voice credit that decides the
// evidence level (DÉCLARÉ / CORROBORÉ) of a criterion. CHIFFRÉ stays
// independent — it depends on data being present, not on voices.
// Does NOT touch gate weights, locks or statuses.
// ============================================================

import type { EvidenceLevel } from './types'
import {
  type ActorRole, voiceWeight, ownerRole,
  RESISTANT_ROLES, ADVOCATE_ROLES,
} from './voice-weights'

export type Stance = 'pour' | 'contre' | 'neutre'

export type Declaration = {
  role: ActorRole
  stance: Stance
  text: string
  contact?: string | null   // person name — used to dedupe and to prescribe role qualification
  owner?: boolean           // this speaker is the natural owner (self-referential criteria)
  quantified?: boolean      // hard data backing the statement → CHIFFRÉ
  date?: string             // ISO — most recent wins when the same person speaks twice
}

export type VoiceBreakdown = {
  contact?: string | null
  role: ActorRole
  stance: Stance
  weight: number       // effective weight after amplification
  amplified: boolean   // against-interest ×1.5 applied
}

export type VoiceResult = {
  level: EvidenceLevel | null   // null = AUCUNE (display "—")
  credit: number
  contradiction: boolean
  forceMaxSignal: number | null // 2 when heavy voices contradict
  alarms: VoiceAlarm[]          // an advocate voiced doubt — formatted by the UI in its locale
  prescriptions: string[]       // arbitration, role qualification (English — feeds the AI)
  breakdown: VoiceBreakdown[]
}

// Structured so the UI can render it in the viewer's language with a
// translated criterion label (the engine stays locale-agnostic).
export type VoiceAlarm = { role: ActorRole; variable: string }

const ROLE_LABELS_EN: Record<ActorRole, string> = {
  decideur: 'Decision maker',
  champion: 'Champion',
  acheteur_technique: 'Technical decider',
  gardien_du_budget: 'Budget guardian',
  utilisateur: 'End user',
  bloqueur: 'Blocker',
  unknown: 'Unknown role',
}

// Keep the single most recent declaration per person (§2.3).
function dedupeByPerson(decls: Declaration[]): Declaration[] {
  const byPerson = new Map<string, Declaration>()
  const anonymous: Declaration[] = []
  for (const d of decls) {
    const key = d.contact?.trim().toLowerCase()
    if (!key) { anonymous.push(d); continue }
    const existing = byPerson.get(key)
    if (!existing || (d.date ?? '') >= (existing.date ?? '')) byPerson.set(key, d)
  }
  return [...byPerson.values(), ...anonymous]
}

export function evidenceFromDeclarations(variable: string, rawDecls: Declaration[] | undefined): VoiceResult {
  const empty: VoiceResult = { level: null, credit: 0, contradiction: false, forceMaxSignal: null, alarms: [], prescriptions: [], breakdown: [] }
  if (!rawDecls || rawDecls.length === 0) return empty

  const decls = dedupeByPerson(rawDecls)
  const alarms: VoiceAlarm[] = []
  const prescriptions: string[] = []
  const breakdown: VoiceBreakdown[] = []
  const quantified = decls.some(d => d.quantified)

  let proCredit = 0
  let conCredit = 0
  let neutreCredit = 0
  let proHeavy = false
  let conHeavy = false

  // Advocate-doubt alarms are collected then filtered: we only keep them if the
  // doubt is real (not drowned by favorable evidence), to avoid false positives
  // from a mis-classified "contre" on an otherwise positive criterion.
  const alarmCandidates: VoiceAlarm[] = []

  for (const d of decls) {
    const base = voiceWeight(variable, d.role, d.owner)
    let w = base
    let amplified = false
    // §2.2 against-interest amplification (positive): a favorable stance from
    // a resistant role is worth more.
    if (d.stance === 'pour' && RESISTANT_ROLES.has(d.role)) {
      w = Math.min(base * 1.5, 1.5)
      amplified = true
    }
    // §2.2 symmetric negative: an advocate voicing doubt is a candidate alarm.
    if (d.stance === 'contre' && ADVOCATE_ROLES.has(d.role)) {
      alarmCandidates.push({ role: d.role, variable })
    }
    if (d.role === 'unknown' && d.contact) {
      prescriptions.push(`Qualify the role of ${d.contact}.`)
    }
    breakdown.push({ contact: d.contact, role: d.role, stance: d.stance, weight: Math.round(w * 100) / 100, amplified })

    if (d.stance === 'pour') { proCredit += w; if (base >= 0.7) proHeavy = true }
    else if (d.stance === 'contre') { conCredit += w; if (base >= 0.7) conHeavy = true }
    else neutreCredit += w
  }

  // Keep alarms only when the doubt is at least as strong as the support —
  // otherwise a lone contre voice amid clearly favorable evidence is noise.
  if (conCredit >= proCredit) alarms.push(...alarmCandidates)

  // §2.4 contradiction between heavy voices → ambiguous, capped at DÉCLARÉ.
  const contradiction = proHeavy && conHeavy
  if (contradiction) {
    prescriptions.push(`Contradiction on ${variable} — have ${ROLE_LABELS_EN[ownerRole(variable) as ActorRole] ?? 'the dimension owner'} arbitrate.`)
    return {
      level: quantified ? 'verified' : 'declared',
      credit: Math.max(proCredit, conCredit),
      contradiction: true,
      forceMaxSignal: quantified ? null : 2,
      alarms,
      prescriptions,
      breakdown,
    }
  }

  const credit = Math.round(Math.max(proCredit, conCredit, neutreCredit) * 100) / 100
  const level: EvidenceLevel = quantified ? 'verified' : credit >= 1.0 ? 'corroborated' : 'declared'

  return { level, credit, contradiction: false, forceMaxSignal: null, alarms, prescriptions, breakdown }
}
