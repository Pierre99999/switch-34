// What happened to a deal, recorded at the moment it closes.
//
// This is the one piece of data that cannot be back-filled. Scores, evidence
// and patterns can all be recomputed later from what is stored; why a deal was
// won or lost exists only in the seller's head on the day, and is gone a week
// later. So it is captured at the click that closes the deal, in three fields,
// and nothing here tries to be clever about it.
//
// The reasons are not a generic CRM list: each one maps to a gate of the
// method, so a corpus of closed deals can later be read as "which gate gave
// way" without re-interpreting free text.

export type CloseReasonKey =
  // Lost
  | 'no_compelling_reason' | 'wrong_people' | 'no_urgency'
  | 'competitor' | 'budget' | 'status_quo' | 'bad_fit'
  // Won
  | 'compelling_reason' | 'champion' | 'differentiation'
  | 'proven_urgency' | 'credibility'
  | 'other'

export type CloseReason = {
  key: CloseReasonKey
  fr: string
  /** The gate this outcome speaks about; null when it is outside the method. */
  gate: number | null
}

export const LOST_REASONS: CloseReason[] = [
  { key: 'no_compelling_reason', fr: 'Pas de raison impérieuse — le problème n’en était pas un', gate: 1 },
  { key: 'wrong_people', fr: 'Mauvais interlocuteurs — le décideur n’a jamais été atteint', gate: 1 },
  { key: 'bad_fit', fr: 'Hors cadre — mauvais segment, mauvais moment', gate: 1 },
  { key: 'competitor', fr: 'Concurrent mieux placé', gate: 2 },
  { key: 'no_urgency', fr: 'Pas d’urgence — reporté sans date', gate: 2 },
  { key: 'budget', fr: 'Budget — pas d’argent, ou pas pour ça', gate: 3 },
  { key: 'status_quo', fr: 'Statu quo — ils n’ont rien fait du tout', gate: 4 },
  { key: 'other', fr: 'Autre', gate: null },
]

export const WON_REASONS: CloseReason[] = [
  { key: 'compelling_reason', fr: 'Une raison impérieuse, établie et partagée', gate: 1 },
  { key: 'champion', fr: 'Un relais interne a porté le dossier', gate: 1 },
  { key: 'differentiation', fr: 'Différenciation claire face au concurrent', gate: 2 },
  { key: 'credibility', fr: 'Crédibilité — ils nous ont fait confiance', gate: 2 },
  { key: 'proven_urgency', fr: 'Une échéance réelle a forcé la décision', gate: 4 },
  { key: 'other', fr: 'Autre', gate: null },
]

export function reasonsFor(status: 'won' | 'lost'): CloseReason[] {
  return status === 'won' ? WON_REASONS : LOST_REASONS
}

export function reasonLabel(key: string | null | undefined): string | null {
  if (!key) return null
  return [...LOST_REASONS, ...WON_REASONS].find(r => r.key === key)?.fr ?? null
}

export function reasonLabels(keys: readonly string[] | null | undefined): string[] {
  return (keys ?? []).map(reasonLabel).filter((l): l is string => l !== null)
}

/**
 * The reasons in the order of the list rather than the order they were
 * clicked. A corpus is easier to read when the same pair always comes out the
 * same way, and click order carries no meaning worth keeping.
 */
export function orderReasons(status: 'won' | 'lost', keys: readonly string[]): CloseReasonKey[] {
  const order = reasonsFor(status).map(r => r.key)
  return order.filter(k => keys.includes(k))
}

/** The gate a closed deal points at — the raw material of any later pattern. */
export function reasonGate(key: string | null | undefined): number | null {
  if (!key) return null
  return [...LOST_REASONS, ...WON_REASONS].find(r => r.key === key)?.gate ?? null
}

/** The distinct gates a closed deal points at, lowest first. */
export function reasonGates(keys: readonly string[] | null | undefined): number[] {
  const gates = (keys ?? []).map(reasonGate).filter((g): g is number => g !== null)
  return [...new Set(gates)].sort((a, b) => a - b)
}

export type DealOutcome = {
  /**
   * More than one, on purpose. A deal rarely dies of a single cause — "hors
   * cadre" and "pas d'urgence" are usually the same story told twice, and
   * forcing a choice between them loses half of what happened.
   */
  reasons: CloseReasonKey[]
  /** The round the deal died on, or was signed on. */
  round: number
  /** ISO date — the seller can correct it; a deal is often closed in the CRM late. */
  closed_at: string
  note: string | null
}

export function isCloseReason(key: unknown): key is CloseReasonKey {
  return typeof key === 'string' && [...LOST_REASONS, ...WON_REASONS].some(r => r.key === key)
}

/** What goes into the deals row. Kept flat so it stays queryable in SQL. */
export function outcomeUpdate(status: 'won' | 'lost', o: DealOutcome) {
  return {
    status,
    close_reasons: orderReasons(status, o.reasons),
    close_round: o.round,
    closed_at: o.closed_at,
    close_note: o.note?.trim() ? o.note.trim() : null,
  }
}

/** Today, as the date input wants it. Local time: a seller closes in their day. */
export function todayISO(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
