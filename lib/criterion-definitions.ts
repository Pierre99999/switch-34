// What each criterion asks, and what counts as evidence for it.
//
// Written because gate 3 was staying empty for several rounds on deals where
// the prospect had plainly said things bearing on it. The cause was not the
// engine but the prompt: gates 1 and 2 had their criteria explained at length,
// while gate 3 and momentum were handed to the model as bare two-word labels
// — "Product Capability", "Adoption Reality" — under a one-line gloss ("Can
// the product deliver? Is implementation feasible? Will users adopt?") that
// reads as post-sale technical validation. Told that, and told it is better to
// leave a criterion unscored than to guess, the model skipped them.
//
// So each definition says two things: what the criterion is, and what an early
// conversation sounds like when it speaks to it. It does not lower the bar —
// only what was actually said can be scored, and the evidence cap still
// applies, so one person's good word stays "declared" and caps at 2.5. It
// stops the model from discarding real evidence because the criterion sounded
// like it belonged to a later stage.

import { LAYER_VARIABLES } from './types'

export const CRITERION_DEFINITIONS: Record<string, string> = {
  // ── Gate 1 · Opportunity ──
  real_business_problem:
    'Is there a real business problem, with consequences they can describe? Evidence: a symptom with a cost, a frequency, a workaround they maintain, something they have already tried.',
  compelling_reason:
    'Is there a legitimate reason to act NOW rather than later? Evidence: a deadline, a contract end, a regulation, a board commitment, a consequence that grows with waiting.',
  concerns_fit:
    'Does what they care about fall on OUR playing field? This is a MATCH, not something the prospect says: compare the problem they stated and the compelling reason they gave against the Sales Playbook — A1 (what we do and the value we bring), A2 (who we are for, and who we avoid), A3 (our positioning against the alternatives). Score it as soon as they have described a problem or a reason to act: the evidence is their words, the judgement is ours. High when what they describe is squarely what we solve, for a target we serve; low when it is adjacent, out of scope, or on the avoid list. Attribute the declarations to whoever stated the problem.',
  stakeholder_map:
    'Do we know who decides, who influences, who pays, who uses? Evidence: names, roles, who they say they must convince, who was absent from the room.',
  personal_pain_linkage:
    'Does an identified person suffer personally — career, reputation, workload, stress? Evidence: first-person statements about their own difficulty. A company problem nobody suffers from personally scores low.',

  // ── Gate 2 · The ability to win ──
  credibility_perception:
    'Do they see us as credible for this? Evidence: how they came to us, a referral, a reference they mention, what they say they have heard about us, the level at which they engage.',
  value_solution_fit:
    'Can what we do actually resolve the problem as THEY described it? Strictly a problem-to-solution match — not what it is worth, not the size of the gain: the value and the measurable impact belong to gate 3, and scoring them here counts the same thing twice. Evidence: their reaction to what we do, the parts they pick up on, the piece of their problem they say we would not cover, a requirement we cannot meet.',
  competitive_position:
    'Where do we stand against alternatives, including doing nothing? Evidence: competitors named, an incumbent, a comparison, a previous purchase in the category.',
  urgency:
    'Is the urgency real and shared, not just stated? Consider frequency, intensity, spread across people, financial/strategic/client impact, risk — a 4-5 needs several of these lit up. Evidence: a date they are working towards, a consequence of missing it, several people saying the same thing.',

  // ── Gate 3 · Impact ──
  // These are the ones that were being skipped. Each says explicitly what an
  // early signal looks like, because "can the product deliver" was being read
  // as a question only a pilot could answer.
  product_capability:
    'Can what we sell actually produce the effect they need? This is NOT limited to a technical validation or a pilot — it starts the moment anything is said about our ability to deliver. Evidence: a referral or a good word heard about us ("on m’a dit du bien de vous"), a reference case they cite, their reaction to how we work, a capability they ask whether we have, a doubt about whether we can handle their case. For a service sold by the person delivering it, what is said about that person IS evidence about capability.',
  implementation_feasibility:
    'Can it be put in place in their environment, with their constraints? Evidence: their systems, their processes, their available time, an internal resource, an IT or procurement constraint, an existing project it must fit around, a past deployment that went badly.',
  adoption_reality:
    'Will the people concerned actually use it? Evidence: how the users react, resistance mentioned, a tool already abandoned, a habit that would have to change, training or support raised, who they say will have to be convinced internally.',
  impact:
    'What tangible difference would it make, in their terms? Evidence: a figure, a saving, a delay avoided, a risk removed, a KPI they name — or their inability to say, which is itself a signal.',
  urgency_resolution:
    'Does what we offer resolve the urgency they described, on their timeline? Evidence: whether they connect our solution to the deadline that pushes them, and whether the timing works.',

  // ── Momentum (parallel) ──
  // Definitions given by Pierre. The four brakes are scored as HEALTH, not as
  // severity: 5 = explored and clean, 0 = never explored. Absence of
  // information is not absence of a brake.
  value_momentum:
    'The significant and MEASURABLE impact of what we bring, compared with what they have today. Not the promise — the gap against the existing situation, and whether that gap is big enough to be worth moving for. Evidence: a before/after they state, a figure put on the current situation, what the status quo costs them, what they say would change. (Gate 3 asks whether an impact would be produced at all; here the question is whether the gap against today is wide enough to carry a decision.)',
  strategic_alignment:
    'Is the problem we solve attached to a stated priority, a new vision, or an imperative on their side? Evidence: a company priority they name, a transformation programme, a new direction from the top, an objective they must hit, an imperative imposed on them. A problem that matters to one person but hangs off nothing scores low.',
  internal_momentum:
    'The strength of the champion: their access to the decision-maker, and the weight of the blockers against them. Evidence: whether the champion can actually reach the decision-maker, whether they carry the file themselves, who opposes them and how heavy that opposition is, what they have already obtained internally.',
  open_objections:
    'Have the things that could become a problem been listed? Legal, security, contractual, technical, political — anything. A brake, scored as health: 5 = they have been listed and settled, 0 = never explored. Evidence: what they push back on, what they keep returning to, what they leave hanging. The danger is not an objection that was raised; it is one nobody has looked for.',
  competition:
    'Is a competitor shaping the decision — displacing the criteria, breaking the price, or slowing their ability to decide? A brake, scored as health: 5 = the competitive situation is known and clean, 0 = never explored. This is NOT our standing against them, which is gate 2 (competitive position). Evidence: a running RFP, criteria that suddenly match someone else, a price used as a reference, an incumbent renewal, a comparison they are told to make.',
  budget:
    'Is the budget in a workable cycle? A brake, scored as health: 5 = it exists, it is identified and its timing works; 0 = never explored. Evidence: a budget line, an envelope, a fiscal year, an arbitration against another project, who signs. An unallocated budget is NOT fatal: when the problem being solved is important enough, budgets are usually found — so score how much the money question holds the decision back, not whether the money is already sitting there.',
  external_friction:
    'What pressure from outside their control weighs on the decision? A brake, scored as health: 5 = known and clean, 0 = never explored. Evidence: regulation, an unforeseen shock (a war, a supply crisis), raw material prices, a market turning, a new class of competitor appearing — the kind now arriving on the back of AI.',
}

/** The variables, each with its definition, for a prompt. */
export function criterionDefinitionList(variables: readonly string[]): string {
  return variables
    .map(v => CRITERION_DEFINITIONS[v] ? `${v}: ${CRITERION_DEFINITIONS[v]}` : v)
    .join('\n')
}

/** Every scored variable, in gate order. */
export const ALL_SCORED_VARIABLES = Object.values(LAYER_VARIABLES).flat() as string[]
