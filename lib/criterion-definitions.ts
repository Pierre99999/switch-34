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
    'Does what we offer fit the problem as they describe it? Evidence: their reaction to what we do, the parts they pick up on, the gaps they point out.',
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
  value_momentum:
    'Is perceived value growing from one conversation to the next? Evidence: what they say now that they did not say before, engagement rising or cooling.',
  strategic_alignment:
    'Is this connected to something the organisation has decided matters? Evidence: a stated priority, a programme, a budget line, an executive sponsor.',
  internal_momentum:
    'Is a decision being built on their side? Evidence: internal meetings organised, people brought in, a next step they propose, a process they describe.',
  open_objections:
    'What objections are open and unresolved? A brake: a high score means objections are heavy or unanswered.',
  process_drag:
    'What in their own process slows the decision? A brake: procurement, legal, a committee, an approval cycle, holidays.',
  external_friction:
    'What outside their control slows it? A brake: market conditions, a reorganisation, a hiring freeze, a supplier, a regulator.',
}

/** The variables, each with its definition, for a prompt. */
export function criterionDefinitionList(variables: readonly string[]): string {
  return variables
    .map(v => CRITERION_DEFINITIONS[v] ? `${v}: ${CRITERION_DEFINITIONS[v]}` : v)
    .join('\n')
}

/** Every scored variable, in gate order. */
export const ALL_SCORED_VARIABLES = Object.values(LAYER_VARIABLES).flat() as string[]
