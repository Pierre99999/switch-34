export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext } from '@/lib/ai-context'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  try {
  const { dealId, locale } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: vendor }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
  ])

  if (!deal || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  if (!vendor.dimensions || Object.keys(vendor.dimensions).length === 0) {
    return NextResponse.json({ error: 'Vendor profile is empty. Fill your profile first.' }, { status: 422 })
  }

  const context = [buildVendorContext(vendor), buildProspectContext(deal)].join('\n\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a senior sales coach using Pierre Gaubil's Switch methodology. Help the salesperson build their "self-knowledge" for THIS specific prospect — one of the four data types in the method. Combine what the seller knows about their own strengths with what has just been learned about the prospect during onboarding.

Key principles:
- A proposition of value answers: "Why should THIS prospect choose YOU rather than an alternative?" — not what you do, but what you CHANGE for them.
- Your playing field (terrain) = how well this prospect matches the problems you solve exceptionally well. State the fit honestly, including where it is weak.
- The necessary actor = given this prospect's organization and buying context, who must be in the room for the deal to close.

Ground every box in the prospect context below — tailor it to this company, not a generic template. 2-4 sentences per box.` + localeInstruction(locale),
    tools: [
      {
        name: 'fill_prepared_boxes',
        description: 'Generate content for the three prepared knowledge boxes',
        input_schema: {
          type: 'object' as const,
          properties: {
            product: {
              type: 'string',
              description: "Product & Positioning FOR THIS PROSPECT: our real strengths that matter to this specific company, and how to position them honestly against their alternatives/status quo.",
            },
            fit: {
              type: 'string',
              description: "Terrain (Concern Fit): how well THIS prospect matches the problems we solve exceptionally well. Qualification signals present or missing, and where the fit is weak.",
            },
            necessary_actor: {
              type: 'string',
              description: "Necessary Actor: given THIS prospect's organization and buying context, who must be in the room for the deal to close — role, accountability, what they care about.",
            },
          },
          required: ['product', 'fit', 'necessary_actor'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Fill the three preparation boxes for this specific prospect, combining the seller's self-knowledge with the prospect context just captured during onboarding.\n\n${context}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  const input = toolUse.input as { product: string; fit: string; necessary_actor: string }

  // Map tool output to box IDs
  const boxes = [
    { box_id: 'product',          text: input.product },
    { box_id: 'fit',              text: input.fit },
    { box_id: 'necessary-actor',  text: input.necessary_actor },
  ]

  const { data: existing } = await supabase
    .from('deal_boxes')
    .select('*')
    .eq('deal_id', dealId)
    .in('box_id', ['product', 'fit', 'necessary-actor'])

  const existingMap: Record<string, { round: number; text: string }[]> = {}
  for (const row of existing ?? []) {
    existingMap[row.box_id] = row.entries ?? []
  }

  // Prepared boxes are regenerated at onboarding — replace the round-0 entry
  // rather than stacking a duplicate on every import.
  for (const { box_id, text } of boxes) {
    const prev = (existingMap[box_id] ?? []).filter(e => e.round !== 0)
    const newEntries = [{ round: 0, text }, ...prev]
    await supabase
      .from('deal_boxes')
      .upsert({ deal_id: dealId, box_id, entries: newEntries }, { onConflict: 'deal_id,box_id' })
  }

  return NextResponse.json({ ok: true, boxes: input })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown AI error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
