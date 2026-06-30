import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { getLayerVerdict, LAYER_VARIABLES, type EvidenceLevel, EVIDENCE_LABELS } from '@/lib/types'
import type { Deal, DealRound } from '@/lib/types'
import EditableProspectName from '@/components/deal/EditableProspectName'

function getLayerScore(round: DealRound | null, layer: number): number | null {
  if (!round) return null
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const scores = vars.map(v => round[v as keyof DealRound] as number | null).filter(s => s !== null) as number[]
  if (scores.length === 0) return null
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
}

const EVIDENCE_ORDER: EvidenceLevel[] = ['declared', 'corroborated', 'verified']
const EVIDENCE_SHORT: Record<EvidenceLevel, string> = { declared: 'D', corroborated: 'C', verified: 'V' }
const EVIDENCE_PILL: Record<EvidenceLevel, string> = {
  declared: 'bg-amber-50 text-amber-600 border-amber-200',
  corroborated: 'bg-blue-50 text-blue-600 border-blue-200',
  verified: 'bg-emerald-50 text-emerald-600 border-emerald-200',
}

function getLayerMinEvidence(round: DealRound | null, layer: number): EvidenceLevel | null {
  if (!round) return null
  const vars = LAYER_VARIABLES[layer as keyof typeof LAYER_VARIABLES]
  const ev = round.evidence_levels ?? {}
  const levels = vars.map(v => ev[v] as EvidenceLevel | undefined).filter(Boolean) as EvidenceLevel[]
  if (levels.length === 0) return null
  return EVIDENCE_ORDER[Math.min(...levels.map(l => EVIDENCE_ORDER.indexOf(l)))]
}

const VERDICT_COLORS: Record<string, { text: string; bg: string }> = {
  PASS:     { text: 'text-emerald-600', bg: 'bg-emerald-500' },
  HOLD:     { text: 'text-amber-600',   bg: 'bg-amber-400' },
  'AT RISK':{ text: 'text-rose-600',    bg: 'bg-rose-500' },
  EMPTY:    { text: 'text-neutral-300',  bg: 'bg-neutral-200' },
  EMERGING: { text: 'text-amber-500',   bg: 'bg-amber-400' },
  NASCENT:  { text: 'text-amber-400',   bg: 'bg-amber-300' },
}

function ScoreCell({ round, layer, label }: { round: DealRound | null; layer: number; label: string }) {
  const verdict = getLayerVerdict(round, layer)
  const score = getLayerScore(round, layer)
  const minEvidence = getLayerMinEvidence(round, layer)
  const vc = VERDICT_COLORS[verdict] ?? VERDICT_COLORS.EMPTY

  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide">{label}</div>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-semibold ${vc.text}`}>
          {score !== null ? score.toFixed(1) : '—'}
        </span>
        {minEvidence && (
          <span className={`text-[9px] font-medium border rounded-full px-1.5 py-0.5 leading-none ${EVIDENCE_PILL[minEvidence]}`} title={EVIDENCE_LABELS[minEvidence]}>
            {EVIDENCE_SHORT[minEvidence]}
          </span>
        )}
      </div>
      <div className="h-1.5 w-full bg-neutral-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${vc.bg} transition-all`}
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
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Switch</p>
          <h1 className="text-2xl font-bold text-neutral-900">Pipeline</h1>
        </div>
        <Link
          href="/deals/new"
          className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          + New deal
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Active</div>
          <div className="text-3xl font-bold text-neutral-900">{summary.total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">Near close</div>
          <div className="text-3xl font-bold text-emerald-600">{summary.nearClose}</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">At risk</div>
          <div className="text-3xl font-bold text-rose-500">{summary.atRisk}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-12 gap-3 px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
          <div className="col-span-4 text-xs font-medium text-neutral-400 uppercase tracking-wide">Prospect</div>
          <div className="col-span-1 text-xs font-medium text-neutral-400 uppercase tracking-wide">Round</div>
          <div className="col-span-5 text-xs font-medium text-neutral-400 uppercase tracking-wide">Scores</div>
          <div className="col-span-2 text-xs font-medium text-neutral-400 uppercase tracking-wide text-right">Actions</div>
        </div>

        {(deals || []).length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">+</span>
            </div>
            <p className="text-sm text-neutral-500 mb-4">No deals yet.</p>
            <Link href="/deals/new" className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
              + Start your first deal
            </Link>
          </div>
        )}

        {(deals || []).map((deal: Deal) => {
          const r = latestRound(deal.id)
          return (
            <div key={deal.id} className="grid grid-cols-12 gap-3 px-5 py-4 border-b border-neutral-100 items-center hover:bg-neutral-50/50 transition-colors">
              <div className="col-span-4">
                <EditableProspectName
                  dealId={deal.id}
                  name={deal.prospect_name}
                />
                {deal.contact_name && (
                  <div className="text-xs text-neutral-400 mt-0.5">{deal.contact_name}{deal.contact_title ? ` · ${deal.contact_title}` : ''}</div>
                )}
              </div>
              <div className="col-span-1">
                <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-lg px-2 py-1">R{deal.current_round}</span>
              </div>
              <div className="col-span-5 grid grid-cols-4 gap-3">
                <ScoreCell round={r} layer={1} label="Opp" />
                <ScoreCell round={r} layer={2} label="Win" />
                <ScoreCell round={r} layer={3} label="Imp" />
                <ScoreCell round={r} layer={4} label="Mom" />
              </div>
              <div className="col-span-2 text-right">
                <Link href={`/deals/${deal.id}/dashboard`} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  Open →
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
