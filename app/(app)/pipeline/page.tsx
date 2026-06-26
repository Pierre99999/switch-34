import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getLayerVerdict, LAYER_VARIABLES } from '@/lib/types'
import type { Deal, DealRound } from '@/lib/types'
import EditableProspectName from '@/components/deal/EditableProspectName'

function getLayerScore(round: DealRound | null, layer: number): number | null {
  if (!round) return null
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const scores = vars.map(v => round[v as keyof DealRound] as number | null).filter(s => s !== null) as number[]
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

function ScoreCell({ round, layer, label }: { round: DealRound | null; layer: number; label: string }) {
  const verdict = getLayerVerdict(round, layer)
  const score = getLayerScore(round, layer)

  const barColor = {
    PASS: 'bg-emerald-500',
    HOLD: 'bg-amber-400',
    'AT RISK': 'bg-rose-500',
    EMPTY: 'bg-stone-200',
    EMERGING: 'bg-amber-400',
    NASCENT: 'bg-amber-300',
  }[verdict]

  const textColor = {
    PASS: 'text-emerald-700',
    HOLD: 'text-amber-700',
    'AT RISK': 'text-rose-700',
    EMPTY: 'text-stone-400',
    EMERGING: 'text-amber-600',
    NASCENT: 'text-amber-500',
  }[verdict]

  return (
    <div className="flex flex-col gap-1">
      <div className="text-[9px] uppercase tracking-widest text-stone-400 font-mono">{label}</div>
      <div className={`text-base font-mono font-semibold leading-none ${textColor}`}>
        {score !== null ? score.toFixed(1) : '—'}
      </div>
      <div className="h-1 w-full bg-stone-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: score !== null ? `${(score / 5) * 100}%` : '0%' }}
        />
      </div>
    </div>
  )
}

export default async function PipelinePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: deals } = await supabase
    .from('deals')
    .select('*')
    .eq('user_id', user!.id)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })

  // Get latest round for each deal
  const dealIds = (deals || []).map((d: Deal) => d.id)
  const { data: rounds } = dealIds.length > 0
    ? await supabase
        .from('deal_rounds')
        .select('*')
        .in('deal_id', dealIds)
    : { data: [] }

  const latestRound = (dealId: string): DealRound | null => {
    const dealRounds = (rounds || [])
      .filter((r: DealRound) => r.deal_id === dealId)
      .sort((a: DealRound, b: DealRound) => b.round - a.round)
    return dealRounds[0] || null
  }

  const summary = {
    total: deals?.length || 0,
    nearClose: (deals || []).filter((d: Deal) => {
      const r = latestRound(d.id)
      return r && getLayerVerdict(r, 3) === 'PASS'
    }).length,
    atRisk: (deals || []).filter((d: Deal) => {
      const r = latestRound(d.id)
      return r && [1, 2, 3, 4].some(l => getLayerVerdict(r, l) === 'AT RISK')
    }).length,
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">ScoreJam · pipeline</div>
          <h1 className="font-serif text-2xl text-stone-900 italic mt-1">Active deals</h1>
        </div>
        <Link
          href="/deals/new"
          className="border border-stone-900 text-stone-900 px-4 py-2 text-xs uppercase tracking-widest font-mono hover:bg-stone-900 hover:text-stone-50"
        >
          + new deal
        </Link>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        <div className="bg-stone-50 p-3 border border-stone-200">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">active</div>
          <div className="font-mono text-2xl text-stone-900 mt-1">{summary.total}</div>
        </div>
        <div className="bg-stone-50 p-3 border border-stone-200">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">near close</div>
          <div className="font-mono text-2xl text-emerald-700 mt-1">{summary.nearClose}</div>
        </div>
        <div className="bg-stone-50 p-3 border border-stone-200">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">at risk</div>
          <div className="font-mono text-2xl text-rose-700 mt-1">{summary.atRisk}</div>
        </div>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-stone-300 text-[10px] uppercase tracking-widest text-stone-500 font-mono">
        <div className="col-span-4">prospect</div>
        <div className="col-span-1">round</div>
        <div className="col-span-5">scores · /5</div>
        <div className="col-span-2 text-right">actions</div>
      </div>

      {(deals || []).length === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-stone-500 font-serif italic mb-4">No deals yet.</p>
          <Link href="/deals/new" className="text-xs uppercase tracking-widest font-mono text-stone-900 border border-stone-900 px-4 py-2 hover:bg-stone-900 hover:text-stone-50">
            + start your first deal
          </Link>
        </div>
      )}

      {(deals || []).map((deal: Deal) => {
        const r = latestRound(deal.id)
        return (
          <div key={deal.id} className="grid grid-cols-12 gap-3 px-4 py-4 border-b border-stone-200 items-center hover:bg-stone-50">
            <div className="col-span-4">
              <EditableProspectName
                dealId={deal.id}
                name={deal.prospect_name}
              />
              {deal.contact_name && (
                <div className="text-[11px] text-stone-500">{deal.contact_name}{deal.contact_title ? ` · ${deal.contact_title}` : ''}</div>
              )}
            </div>
            <div className="col-span-1 text-xs font-mono text-stone-500">R{deal.current_round}</div>
            <div className="col-span-5 grid grid-cols-4 gap-3">
              <ScoreCell round={r} layer={1} label="Opportunity" />
              <ScoreCell round={r} layer={2} label="Winability" />
              <ScoreCell round={r} layer={3} label="Impact" />
              <ScoreCell round={r} layer={4} label="Momentum" />
            </div>
            <div className="col-span-2 text-right">
              <Link href={`/deals/${deal.id}/dashboard`} className="text-[11px] uppercase tracking-widest font-mono text-stone-700 hover:text-stone-900">
                open →
              </Link>
            </div>
          </div>
        )
      })}
    </div>
  )
}
