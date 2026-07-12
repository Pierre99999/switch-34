export const maxDuration = 300

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildVendorContext, buildProspectContext, buildScoresContext } from '@/lib/ai-context'
import { localeInstruction } from '@/lib/ai-locale'

const client = new Anthropic()

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 })

  const { dealId, roundId, locale } = await req.json()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: deal }, { data: round }, { data: vendor }] = await Promise.all([
    supabase.from('deals').select('*').eq('id', dealId).single(),
    supabase.from('deal_rounds').select('*').eq('id', roundId).single(),
    supabase.from('vendors').select('*').eq('user_id', user.id).single(),
  ])

  if (!deal || !round || !vendor) return NextResponse.json({ error: 'Data not found' }, { status: 404 })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 300,
    system: `You are a senior sales coach reading a deal diagnostic. Write a concise engine narrative — 3 sentences max. Be direct and specific. Identify the weakest point, what it means for the deal, and the single most important thing to focus on next. No fluff, no hedging. Write in second person ("you", "your deal").` + localeInstruction(locale),
    messages: [{
      role: 'user',
      content: `${buildVendorContext(vendor)}\n\n${buildProspectContext(deal)}\n\n${buildScoresContext(round)}`,
    }],
  })

  const narrative = message.content[0].type === 'text' ? message.content[0].text.trim() : ''

  // Save narrative to the round
  await supabase.from('deal_rounds').update({ narrative }).eq('id', roundId)

  return NextResponse.json({ narrative })
}
