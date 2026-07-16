import type { SupabaseClient } from '@supabase/supabase-js'

type Usage = { input_tokens?: number; output_tokens?: number } | null | undefined

// Best-effort logging of a single AI call's token usage. Never throws — a
// logging failure must not break the feature that generated the tokens.
export async function recordUsage(
  supabase: SupabaseClient,
  args: { userId: string; route: string; model: string; usage: Usage; dealId?: string | null },
) {
  try {
    await supabase.from('ai_usage').insert({
      user_id: args.userId,
      deal_id: args.dealId ?? null,
      route: args.route,
      model: args.model,
      input_tokens: args.usage?.input_tokens ?? 0,
      output_tokens: args.usage?.output_tokens ?? 0,
    })
  } catch { /* ignore */ }
}

// USD per million tokens, by model.
const PRICING: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
  'claude-haiku-4-5-20251001': { in: 1, out: 5 },
  'claude-opus-4-8': { in: 5, out: 25 },
}
const DEFAULT_PRICE = { in: 3, out: 15 }
export const USD_TO_EUR = 0.92

export function costEur(model: string, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model] ?? DEFAULT_PRICE
  const usd = (inputTokens / 1e6) * p.in + (outputTokens / 1e6) * p.out
  return usd * USD_TO_EUR
}
