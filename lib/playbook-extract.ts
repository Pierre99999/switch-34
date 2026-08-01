// Shared extraction contract for the Sales Playbook, used by both the URL and
// the document import.
//
// A website reveals A1-A4 honestly (who they sell to, positioning, likely
// perception objections). A5 and A6 come from a team's own sales history, so
// the model is told to leave them alone rather than invent them — an invented
// socle is worse than an empty one, because it reads as authoritative.

import { localeInstruction } from '@/lib/ai-locale'
import { normalizePlaybook, type Playbook } from '@/lib/playbook'

export const PLAYBOOK_SYSTEM_PROMPT = `You are building the "socle" of a Sales Playbook from a company's own public material, for Pierre Gaubil's Switch sales methodology.

The socle describes what a company knows about ITSELF as a seller — never about one deal. Write it as the company's own sales team would, in their words.

WHAT TO EXTRACT:
- a1_value_proposition: one row per target (customer type). Not a product description — the transformation created, stated as a consequence for the customer, with its proof. Leave "proof" empty unless the material actually shows one (a figure, a named client, a case study).
- a2_ideal_targets: the segments where this company clearly wins. a2_avoid_targets: only if the material genuinely signals a poor fit — otherwise leave empty.
- a3_positioning: keep the three seeded alternatives (status quo, in-house solution, competitor) and fill what each promises and the relevant difference. Add named competitors only if the material names them.
- a4_perception: objections a prospect would likely hold BEFORE the first meeting, from what the material shows: size, price, youth of the company, country, thin references. This is judgement about how the market reads them — infer it, but stay plausible.

WHAT NOT TO INVENT:
- a5_actors and a6_questions come from a team's lived sales history. A website cannot reveal them. Return them EMPTY.
- a7_postmortem is a log of closed deals. Always return it EMPTY.
- Never fabricate figures, client names or proof. An empty cell is correct; an invented one corrupts the socle.

Be concise: one or two sentences per cell. Prefer fewer, well-grounded rows over many thin ones.`

export function playbookTool(locale?: string) {
  const row = (props: string[]) => ({
    type: 'array' as const,
    items: {
      type: 'object' as const,
      properties: Object.fromEntries(props.map(p => [p, { type: 'string' }])),
      required: [],
    },
  })

  return {
    system: PLAYBOOK_SYSTEM_PROMPT + localeInstruction(locale),
    tool: {
      name: 'save_playbook',
      description: 'Save the extracted Sales Playbook socle',
      input_schema: {
        type: 'object' as const,
        properties: {
          a1_value_proposition: row(['segment', 'problem', 'consequence', 'proof']),
          a2_ideal_targets: row(['target']),
          a2_avoid_targets: row(['target']),
          a3_positioning: row(['alternative', 'promise', 'difference', 'proof']),
          a4_perception: row(['objection', 'prospect_type', 'defuse']),
        },
        required: [],
      },
    },
  }
}

// The model only fills A1-A4; everything else keeps its seeded/empty shape.
export function playbookFromToolInput(input: unknown, locale = 'fr'): Playbook {
  return normalizePlaybook(input, locale)
}
