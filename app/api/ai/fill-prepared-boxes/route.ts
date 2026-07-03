import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext } from '@/lib/ai-context'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dealId } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: vendor }] = await Promise.all([
    supabase.from('deals').select('id').eq('id', dealId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
  ])

  if (!deal || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  if (!vendor.dimensions || Object.keys(vendor.dimensions).length === 0) {
    return NextResponse.json({ error: 'Vendor profile is empty. Fill your profile first.' }, { status: 422 })
  }

  const context = buildVendorContext(vendor)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system: `You are a senior sales coach helping a salesperson know their own product deeply before any prospect conversation. Based on the vendor profile only, generate sharp, specific content for three generic preparation boxes that apply to any deal. Be concrete and direct — these are the salesperson's standing knowledge about what they sell, who it is for, and who needs to be in the room. 2-4 sentences per box. No prospect-specific language.`,
    tools: [
      {
        name: 'fill_prepared_boxes',
        description: 'Generate content for the three prepared knowledge boxes',
        input_schema: {
          type: 'object' as const,
          properties: {
            product: {
              type: 'string',
              description: "Product & Positioning: The vendor's real strengths and why they are genuinely different from alternatives. What the product actually does well, what it doesn't, and how to position it honestly.",
            },
            fit: {
              type: 'string',
              description: "Terrain (Concern Fit): The profile of companies and individuals this vendor is truly relevant to. ICP, qualification signals, and who they are NOT for.",
            },
            necessary_actor: {
              type: 'string',
              description: "Necessary Actor: Based on the vendor's typical sales motion and deal complexity, who needs to be in the room or involved for this deal to close. What role, what accountability, what they typically care about.",
            },
          },
          required: ['product', 'fit', 'necessary_actor'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Generate generic preparation content for the three knowledge boxes based on the vendor profile below. This content should be true for any deal, not tailored to a specific prospect.\n\n${context}`,
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

  // Fetch existing box data to append (not overwrite)
  const { data: existing } = await supabase
    .from('deal_boxes')
    .select('*')
    .eq('deal_id', dealId)
    .in('box_id', ['product', 'fit', 'necessary-actor'])

  const existingMap: Record<string, { round: number; text: string }[]> = {}
  for (const row of existing ?? []) {
    existingMap[row.box_id] = row.entries ?? []
  }

  // Upsert each box — append new entry at round 0
  for (const { box_id, text } of boxes) {
    const prev = existingMap[box_id] ?? []
    const newEntries = [...prev, { round: 0, text }]
    await supabase
      .from('deal_boxes')
      .upsert({ deal_id: dealId, box_id, entries: newEntries }, { onConflict: 'deal_id,box_id' })
  }

  return NextResponse.json({ ok: true, boxes: input })
}
