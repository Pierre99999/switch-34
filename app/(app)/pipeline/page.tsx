'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { getLayerVerdict, LAYER_VARIABLES, type EvidenceLevel, EVIDENCE_LABELS } from '@/lib/types'
import type { Deal, DealRound } from '@/lib/types'
import EditableProspectName from '@/components/deal/EditableProspectName'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'

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

type SortKey = 'prospect' | 'rep' | 'round' | 'revenue' | null
type SortDir = 'asc' | 'desc'

export default function PipelinePage() {
  const { t } = useI18n()
  const { role } = useRole()
  const isDirector = role === 'director'
  const [deals, setDeals] = useState<Deal[]>([])
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [repNames, setRepNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [archivedDeals, setArchivedDeals] = useState<Deal[]>([])
  const [showArchived, setShowArchived] = useState(false)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      let query = supabase
        .from('deals')
        .select('*')
        .eq('status', 'active')
        .order('updated_at', { ascending: false })

      if (!isDirector) {
        query = query.eq('user_id', user.id)
      }

      const { data: dealData } = await query
      const d = dealData || []
      setDeals(d)

      if (isDirector && d.length > 0) {
        const userIds = [...new Set(d.map((x: Deal) => x.user_id))]
        const { data: vendors } = await supabase
          .from('vendors')
          .select('user_id, full_name, company_name')
          .in('user_id', userIds)
        const names: Record<string, string> = {}
        for (const v of vendors || []) {
          names[v.user_id] = v.full_name || v.company_name
        }
        setRepNames(names)
      }

      const ids = d.map((x: Deal) => x.id)
      if (ids.length > 0) {
        const { data: roundData } = await supabase
          .from('deal_rounds')
          .select('*')
          .in('deal_id', ids)
        setRounds(roundData || [])
      }
      setLoading(false)
    }
    load()
  }, [isDirector])

  async function handleSetStatus(dealId: string, status: Deal['status']) {
    const supabase = createClient()
    await supabase.from('deals').update({ status }).eq('id', dealId)
    if (status === 'active') {
      const deal = archivedDeals.find(d => d.id === dealId)
      if (deal) {
        setArchivedDeals(a => a.filter(d => d.id !== dealId))
        setDeals(d => [...d, { ...deal, status: 'active' }])
      }
    } else {
      const deal = deals.find(d => d.id === dealId)
      if (deal) {
        setDeals(d => d.filter(dd => dd.id !== dealId))
        setArchivedDeals(a => [...a, { ...deal, status }])
      }
    }
  }

  async function loadArchived() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    let query = supabase.from('deals').select('*').in('status', ['lost', 'won', 'paused']).order('updated_at', { ascending: false })
    if (!isDirector) query = query.eq('user_id', user.id)
    const { data } = await query
    setArchivedDeals(data || [])
  }

  const latestRound = (dealId: string): DealRound | null => {
    const dealRounds = rounds
      .filter((r: DealRound) => r.deal_id === dealId)
      .sort((a: DealRound, b: DealRound) => b.round - a.round)
    return dealRounds[0] || null
  }

  const totalRevenue = deals.reduce((sum, d) => sum + (d.potential_revenue ?? 0), 0)

  const summary = {
    total: deals.length,
    nearClose: deals.filter((d: Deal) => {
      const r = latestRound(d.id)
      return r && getLayerVerdict(r, 3) === 'PASS'
    }).length,
    atRisk: deals.filter((d: Deal) => {
      const r = latestRound(d.id)
      return r && [1, 2, 3, 4].some(l => getLayerVerdict(r, l) === 'AT RISK')
    }).length,
  }

  const fmtRevenue = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k€` : `${n}€`

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir(key === 'revenue' ? 'desc' : 'asc')
    }
  }

  const sortIndicator = (key: SortKey) => sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''

  const sortedDeals = [...deals].sort((a, b) => {
    if (!sortKey) return 0
    const dir = sortDir === 'asc' ? 1 : -1
    switch (sortKey) {
      case 'prospect':
        return dir * a.prospect_name.localeCompare(b.prospect_name)
      case 'rep':
        return dir * (repNames[a.user_id] || '').localeCompare(repNames[b.user_id] || '')
      case 'round':
        return dir * (a.current_round - b.current_round)
      case 'revenue':
        return dir * ((a.potential_revenue ?? 0) - (b.potential_revenue ?? 0))
      default:
        return 0
    }
  })

  if (loading) return null

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Switch</p>
          <h1 className="text-2xl font-bold text-neutral-900">
            {t('pipeline.title')}
            {isDirector && <span className="text-sm font-medium text-neutral-400 ml-2">· {t('pipeline.allReps')}</span>}
          </h1>
        </div>
        <Link
          href="/deals/new"
          className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          {t('pipeline.newDeal')}
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">{t('pipeline.active')}</div>
          <div className="text-3xl font-bold text-neutral-900">{summary.total}</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">{t('pipeline.nearClose')}</div>
          <div className="text-3xl font-bold text-emerald-600">{summary.nearClose}</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">{t('pipeline.atRisk')}</div>
          <div className="text-3xl font-bold text-rose-500">{summary.atRisk}</div>
        </div>
        <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm">
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1">{t('pipeline.totalRevenue')}</div>
          <div className="text-3xl font-bold text-blue-600">{totalRevenue > 0 ? fmtRevenue(totalRevenue) : '—'}</div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-visible">
        {/* Table header */}
        <div className={`grid gap-3 px-5 py-3 border-b border-neutral-100 bg-neutral-50/50`} style={{ gridTemplateColumns: isDirector ? '2.5fr 1.5fr 0.6fr 1fr 4fr 1fr' : '3fr 0.6fr 1fr 5fr 1fr' }}>
          <button onClick={() => toggleSort('prospect')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.prospect')}{sortIndicator('prospect')}</button>
          {isDirector && <button onClick={() => toggleSort('rep')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.rep')}{sortIndicator('rep')}</button>}
          <button onClick={() => toggleSort('round')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.round')}{sortIndicator('round')}</button>
          <button onClick={() => toggleSort('revenue')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-right hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.revenue')}{sortIndicator('revenue')}</button>
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{t('pipeline.activity')}</div>
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-right">{t('pipeline.actions')}</div>
        </div>

        {deals.length === 0 && (
          <div className="py-16 text-center">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl">+</span>
            </div>
            <p className="text-sm text-neutral-500 mb-4">{t('pipeline.noDeals')}</p>
            <Link href="/deals/new" className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
              {t('pipeline.newDeal')}
            </Link>
          </div>
        )}

        {sortedDeals.map((deal: Deal) => {
          const r = latestRound(deal.id)
          return (
            <div key={deal.id} className="grid gap-3 px-5 py-4 border-b border-neutral-100 items-center hover:bg-neutral-50/50 transition-colors" style={{ gridTemplateColumns: isDirector ? '2.5fr 1.5fr 0.6fr 1fr 4fr 1fr' : '3fr 0.6fr 1fr 5fr 1fr' }}>
              <div>
                <EditableProspectName
                  dealId={deal.id}
                  name={deal.prospect_name}
                />
                {deal.contact_name && (
                  <div className="text-xs text-neutral-400 mt-0.5">{deal.contact_name}{deal.contact_title ? ` · ${deal.contact_title}` : ''}</div>
                )}
              </div>
              {isDirector && (
                <div>
                  <span className="text-xs font-medium text-neutral-600">{repNames[deal.user_id] || '—'}</span>
                </div>
              )}
              <div>
                <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-lg px-2 py-1">R{deal.current_round}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-semibold text-neutral-700">{deal.potential_revenue ? fmtRevenue(deal.potential_revenue) : '—'}</span>
              </div>
              <div className="grid grid-cols-4 gap-3">
                <ScoreCell round={r} layer={1} label={t('layer.1')} />
                <ScoreCell round={r} layer={2} label={t('layer.2')} />
                <ScoreCell round={r} layer={3} label={t('layer.3')} />
                <ScoreCell round={r} layer={4} label={t('layer.4')} />
              </div>
              <div className="flex items-center justify-end gap-2">
                <Link href={`/deals/${deal.id}/dashboard`} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                  {t('pipeline.dashboard')}
                </Link>
                <div className="relative">
                  <button onClick={() => setOpenMenuId(openMenuId === deal.id ? null : deal.id)} className="text-neutral-300 hover:text-neutral-500 transition-colors text-lg leading-none px-1">···</button>
                  {openMenuId === deal.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 bottom-full mb-1 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30 min-w-[180px]">
                        <button onClick={() => { handleSetStatus(deal.id, 'won'); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          {t('pipeline.markWon')}
                        </button>
                        <button onClick={() => { handleSetStatus(deal.id, 'lost'); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          {t('pipeline.markLost')}
                        </button>
                        <button onClick={() => { handleSetStatus(deal.id, 'paused'); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          {t('pipeline.markPaused')}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Archived toggle */}
      <div className="mt-6 text-center">
        <button
          onClick={() => { if (!showArchived) loadArchived(); setShowArchived(s => !s) }}
          className="text-sm text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          {showArchived ? t('pipeline.hideArchived') : t('pipeline.showArchived')}
        </button>
      </div>

      {/* Archived deals */}
      {showArchived && archivedDeals.length > 0 && (
        <div className="mt-4 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50/50">
            <span className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{t('pipeline.archived')}</span>
          </div>
          {archivedDeals.map(deal => {
            const statusLabel = deal.status === 'won' ? t('pipeline.won') : deal.status === 'lost' ? t('pipeline.lost') : t('pipeline.paused')
            const statusColor = deal.status === 'won' ? 'bg-emerald-50 text-emerald-600' : deal.status === 'lost' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'
            return (
              <div key={deal.id} className="flex items-center justify-between px-5 py-3 border-b border-neutral-100">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-neutral-700">{deal.prospect_name}</span>
                  <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/deals/${deal.id}/dashboard`} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                    {t('pipeline.dashboard')}
                  </Link>
                  <button onClick={() => handleSetStatus(deal.id, 'active')} className="text-xs text-neutral-400 hover:text-blue-500 transition-colors">
                    {t('pipeline.markActive')}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
