// Who the seller is about to meet.
//
// The briefing was written as if every round faced the same person — the deal's
// contact, forever. In reality the room changes: round 1 is the champion alone,
// round 2 adds the budget holder, round 3 is a committee. Questions that ignore
// that are questions asked to the wrong person, which is the surest way to burn
// a conversation.
//
// It also matters to the engine, not only to the wording: the voice credit
// weighs a statement by the role of whoever made it. Knowing in advance who
// will be in the room is knowing which criteria this conversation can actually
// establish — you cannot corroborate a budget with someone who does not hold
// it, however well the question is phrased.

export type Attendee = {
  name: string
  title?: string | null
  /** Canonical actor types, as used by deal_stakeholders. */
  actor_types: string[]
}

export const ACTOR_TYPES = [
  'decision_maker', 'champion', 'reviewer', 'budget_guardian', 'user', 'blocker', 'unknown',
] as const

export const ACTOR_TYPE_LABEL: Record<string, string> = {
  decision_maker: 'Décideur',
  champion: 'Champion',
  reviewer: 'Décideur technique',
  budget_guardian: 'Gardien du budget',
  user: 'Utilisateur',
  blocker: 'Bloqueur',
  unknown: 'Rôle inconnu',
}

/** What each role can settle that the others cannot. */
const ROLE_REACH: Record<string, string> = {
  decision_maker: 'can settle urgency, the decision process and what winning requires',
  champion: 'can open doors and describe internal politics, but their enthusiasm alone stays a single voice',
  reviewer: 'can settle feasibility, integration and technical objections',
  budget_guardian: 'can settle the money: whether it exists, when, and what it is weighed against',
  user: 'can settle adoption reality and the daily impact',
  blocker: 'can name the objection nobody else says out loud — a concession here is heavy evidence',
}

export function normalizeAttendees(value: unknown): Attendee[] {
  if (!Array.isArray(value)) return []
  const mapped = value
    .map((a): Attendee | null => {
      const o = (a ?? {}) as Record<string, unknown>
      const name = typeof o.name === 'string' ? o.name.trim() : ''
      if (!name) return null
      const types = Array.isArray(o.actor_types)
        ? (o.actor_types as unknown[]).filter((t): t is string => typeof t === 'string' && t.length > 0)
        : []
      return {
        name,
        title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : null,
        actor_types: types.length ? types : ['unknown'],
      }
    })
  return mapped.filter((a): a is Attendee => a !== null)
}

/** The roles that will be in the room. */
export function rolesPresent(attendees: Attendee[]): string[] {
  return [...new Set(attendees.flatMap(a => a.actor_types))].filter(r => r !== 'unknown')
}

/**
 * The block handed to the briefing engine. Says who is there, what each of
 * them can settle, and — the part that matters most — what this conversation
 * cannot establish because the person who could is not coming.
 */
export function buildAttendeesContext(attendees: Attendee[]): string {
  if (attendees.length === 0) return ''

  const lines = attendees.map(a => {
    const roles = a.actor_types.filter(t => t !== 'unknown')
    const reach = roles.map(r => ROLE_REACH[r]).filter(Boolean)
    return `- ${a.name}${a.title ? ` (${a.title})` : ''} — ${
      roles.length ? roles.map(r => ACTOR_TYPE_LABEL[r] ?? r).join(', ') : 'role unknown'
    }${reach.length ? `; ${reach.join('; ')}` : ''}`
  })

  const present = rolesPresent(attendees)
  const absent = ['decision_maker', 'budget_guardian', 'user']
    .filter(r => !present.includes(r))
    .map(r => ACTOR_TYPE_LABEL[r])

  return [
    'WHO IS IN THE ROOM FOR THIS CONVERSATION:',
    ...lines,
    '',
    'Write the questions for THESE people. A question only lands if the person in front of you can answer it from their own experience — asking a user about the budget, or a budget holder about daily use, wastes the question and costs credibility.',
    absent.length
      ? `Not in the room: ${absent.join(', ')}. Do not build the conversation around what only they could settle; where it matters, one question may aim at opening a path to them.`
      : 'Every decisive role is in the room — this conversation can settle more than a one-to-one.',
    attendees.length > 1
      ? 'Several people are present: expect them to disagree, and treat a disagreement in the room as valuable evidence rather than a problem to smooth over.'
      : '',
  ].filter(Boolean).join('\n')
}

/** A short line for the screen: "Marie Dupont, Henri Colin (+1)". */
export function attendeesSummary(attendees: Attendee[]): string {
  if (attendees.length === 0) return ''
  const names = attendees.map(a => a.name)
  if (names.length <= 2) return names.join(', ')
  return `${names.slice(0, 2).join(', ')} (+${names.length - 2})`
}
