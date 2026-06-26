import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext, buildCaptureContext } from '@/lib/ai-context'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dealId, roundId } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: round }, { data: vendor }, { data: allRounds }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
    supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
  ])

  if (!deal || !round || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  const context = [
    buildVendorContext(vendor),
    buildProspectContext(deal),
    buildScoresContext(round),
    buildCaptureContext(allRounds ?? []),
  ].join('\n\n')

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `You are a senior sales coach generating a pre-conversation briefing for a salesperson. Use the deal diagnostic scores, capture notes, and context to generate a sharp, actionable briefing. Be specific — reference actual scores, actual prospect details, actual gaps. No generic advice.`,
    tools: [
      {
        name: 'save_briefing',
        description: 'Save the generated briefing for this deal round',
        input_schema: {
          type: 'object' as const,
          properties: {
            line: { type: 'string', description: 'One sentence that frames the entire conversation — the most important thing to establish or move in this round.' },
            read: { type: 'string', description: 'Where the deal stands honestly. What you know, what is missing, what the scores reveal. 3-5 sentences.' },
            angle: { type: 'string', description: 'How to walk into the conversation. The opening posture and framing. 2-3 sentences.' },
            win_condition: { type: 'string', description: 'What specific outcome would make this conversation a success. 1-2 sentences.' },
            questions: {
              type: 'array',
              description: 'Field questions ranked by diagnostic gap — weakest scored variables first.',
              items: {
                type: 'object',
                properties: {
                  layer: { type: 'number' },
                  variable: { type: 'string' },
                  text: { type: 'string', description: 'The actual question to ask, in natural language.' },
                  why: { type: 'string', description: 'Why this question matters now — link to the score gap.' },
                },
                required: ['layer', 'variable', 'text', 'why'],
              },
            },
            mirror: {
              type: 'array',
              description: "Words or phrases from the prospect's capture notes to echo back.",
              items: { type: 'string' },
            },
            objections: {
              type: 'array',
              description: 'Likely objections to prepare for.',
              items: {
                type: 'object',
                properties: {
                  likely: { type: 'string', description: 'The objection as the prospect would say it.' },
                  frame: { type: 'string', description: 'How to reframe or respond.' },
                },
                required: ['likely', 'frame'],
              },
            },
            do_not: {
              type: 'array',
              description: 'Things to avoid in this specific conversation given the deal state.',
              items: { type: 'string' },
            },
          },
          required: ['line', 'read', 'angle', 'win_condition', 'questions', 'mirror', 'objections', 'do_not'],
        },
      },
    ],
    tool_choice: { type: 'any' as const },
    messages: [{
      role: 'user',
      content: `Generate a briefing for round ${round.round} of this deal. Focus on the lowest-scored variables as the priority questions. Use specific details from the capture notes for mirror terms.\n\n${context}`,
    }],
  })

  const toolUse = message.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return NextResponse.json({ error: 'No structured response from AI' }, { status: 500 })
  }

  const input = toolUse.input as Record<string, unknown>

  // Save to round
  await supabase.from('deal_rounds').update({
    briefing_line: input.line,
    briefing_read: input.read,
    briefing_angle: input.angle,
    briefing_win_condition: input.win_condition,
    briefing_questions: input.questions,
    briefing_mirror: input.mirror,
    briefing_objections: input.objections,
    briefing_do_not: input.do_not,
  }).eq('id', roundId)

  return NextResponse.json({ briefing: input })
}
