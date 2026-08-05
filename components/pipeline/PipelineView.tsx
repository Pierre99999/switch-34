'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { LAYER_VARIABLES, type EvidenceLevel, EVIDENCE_LABELS } from '@/lib/types'
import { simpleStatus, gateScore } from '@/lib/scoring'
import type { Deal, DealRound } from '@/lib/types'
import EditableProspectName from '@/components/deal/EditableProspectName'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'
import PlaybookWelcome from '@/components/ui/PlaybookWelcome'
import { normalizePlaybook, playbookProgress } from '@/lib/playbook'
import { nextStep, type NextStepKind } from '@/lib/deal-rounds'
import { outcomeUpdate, reasonLabels, type DealOutcome } from '@/lib/deal-outcome'
import OutcomeDialog from './OutcomeDialog'


const EVIDENCE_ORDER: EvidenceLevel[] = ['declared', 'corroborated', 'verified']
const EVIDENCE_SHORT: Record<EvidenceLevel, string> = { declared: 'D', corroborated: 'C', verified: 'Ch' }
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

// The pipeline as a work queue: what is this deal waiting on, and where do I
// go to do it.
const NEXT_STEP: Record<NextStepKind, {
  label: { fr: string; en: string }
  short: { fr: string; en: string }
  pill: string
  button: string
  href: (dealId: string) => string
}> = {
  brief: {
    label: { fr: 'Créer le briefing', en: 'Create the briefing' },
    short: { fr: 'Briefing à créer', en: 'Briefing to create' },
    pill: 'bg-blue-50 text-blue-600 border-blue-200',
    button: 'bg-blue-500 text-white hover:bg-blue-600',
    href: id => `/deals/${id}/dashboard`,
  },
  capture: {
    label: { fr: 'Capturer la conversation', en: 'Capture the conversation' },
    short: { fr: 'Conversation à capturer', en: 'Conversation to capture' },
    pill: 'bg-violet-50 text-violet-600 border-violet-200',
    button: 'bg-violet-500 text-white hover:bg-violet-600',
    href: id => `/deals/${id}/capture`,
  },
  next_round: {
    label: { fr: 'Lancer le round suivant', en: 'Start the next round' },
    short: { fr: 'Round suivant', en: 'Next round' },
    pill: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    button: 'bg-emerald-500 text-white hover:bg-emerald-600',
    href: id => `/deals/${id}/dashboard`,
  },
  closed: {
    label: { fr: 'Deal clos', en: 'Deal closed' },
    short: { fr: 'Clos', en: 'Closed' },
    pill: 'bg-neutral-100 text-neutral-500 border-neutral-200',
    button: 'bg-neutral-200 text-neutral-600 hover:bg-neutral-300',
    href: id => `/deals/${id}/dashboard`,
  },
}

const VERDICT_COLORS: Record<string, { text: string; bg: string }> = {
  FRANCHIE:        { text: 'text-emerald-600', bg: 'bg-emerald-500' },
  EN_CONSTRUCTION: { text: 'text-amber-600',   bg: 'bg-amber-400' },
  A_RISQUE:        { text: 'text-rose-600',    bg: 'bg-rose-500' },
  PRETE:           { text: 'text-blue-600',    bg: 'bg-blue-500' },
  EMPTY:           { text: 'text-neutral-300', bg: 'bg-neutral-200' },
}

function ScoreCell({ round, layer, label }: { round: DealRound | null; layer: number; label: string }) {
  const verdict = simpleStatus(round, layer)
  const score = gateScore(round, layer)
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

// Remembered per browser, not in the database: "later" is a preference about
// this screen, not a fact about the account.
const WELCOME_DISMISSED_KEY = 'switch.playbookWelcomeDismissed'

// The pipeline, shared by the live app and the lab. What changes between them
// is where a deal opens and how much of the diagnostic the list repeats —
// duplicating this table would be the "two documents that diverge in six
// months" trap, applied to a screen.
//
// In the lab the four gate scores and the dashboard link are dropped: the deal
// screen shows both, one click away, and a list that answers "how is this deal
// doing?" competes with the one question the pipeline should answer — what do
// I do next.
export default function PipelineView({
  dealHref = (id: string) => `/deals/${id}/dashboard`,
  showScores = true,
  stepHref,
}: {
  dealHref?: (id: string) => string
  showScores?: boolean
  /** Where the next-step button goes; defaults to the live app's per-step routes. */
  stepHref?: (id: string) => string
} = {}) {
  const { t, locale } = useI18n()
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
  const [pendingClose, setPendingClose] = useState<{ deal: Deal; status: 'won' | 'lost' } | null>(null)
  const [stepFilter, setStepFilter] = useState<NextStepKind | 'all'>('all')
  const [showWelcome, setShowWelcome] = useState(false)

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
      // An empty Sales Playbook is the one thing worth interrupting for: every
      // deal is read against it. Only a director sees this — a rep inherits the
      // team's playbook and cannot edit it.
      if (isDirector) {
        const { data: vendor } = await supabase
          .from('vendors')
          .select('playbook, locale')
          .eq('user_id', user.id)
          .maybeSingle()
        const { started } = playbookProgress(
          normalizePlaybook(vendor?.playbook, vendor?.locale ?? 'fr'),
          vendor?.locale ?? 'fr',
        )
        const dismissed = typeof window !== 'undefined'
          && window.localStorage.getItem(WELCOME_DISMISSED_KEY) === '1'
        setShowWelcome(started === 0 && !dismissed)
      }

      setLoading(false)
    }
    load()
  }, [isDirector])

  function dismissWelcome() {
    setShowWelcome(false)
    try { window.localStorage.setItem(WELCOME_DISMISSED_KEY, '1') } catch { /* private mode */ }
  }

  // Closing a deal asks why first. Pausing and reactivating do not: a paused
  // deal is not an outcome, it is a deal you have not decided about yet.
  async function handleSetStatus(dealId: string, status: Deal['status'], outcome?: DealOutcome) {
    const supabase = createClient()
    const update = (status === 'won' || status === 'lost') && outcome
      ? outcomeUpdate(status, outcome)
      : { status }
    await supabase.from('deals').update(update).eq('id', dealId)
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
        setArchivedDeals(a => [...a, { ...deal, ...update, status } as Deal])
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
      return r && simpleStatus(r, 3) === 'FRANCHIE'
    }).length,
    atRisk: deals.filter((d: Deal) => {
      const r = latestRound(d.id)
      return r && [1, 2, 3, 4].some(l => simpleStatus(r, l) === 'A_RISQUE')
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

  const stepFor = (deal: Deal) => nextStep(deal, rounds.filter(r => r.deal_id === deal.id))
  const hrefForStep = (deal: Deal, kind: NextStepKind) =>
    stepHref ? stepHref(deal.id) : NEXT_STEP[kind].href(deal.id)
  const gridCols = showScores
    ? (isDirector ? '2.2fr 1.2fr 0.6fr 0.9fr 3.2fr 2.2fr 0.9fr' : '2.6fr 0.6fr 0.9fr 4fr 2.2fr 0.9fr')
    : (isDirector ? '2.6fr 1.4fr 0.6fr 1fr 2.4fr 0.6fr' : '3.2fr 0.6fr 1fr 2.4fr 0.6fr')
  const stepCount = (kind: NextStepKind) => deals.filter(d => stepFor(d).kind === kind).length

  const filteredDeals = stepFilter === 'all' ? deals : deals.filter(d => stepFor(d).kind === stepFilter)

  const sortedDeals = [...filteredDeals].sort((a, b) => {
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
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6">
      {showWelcome && <PlaybookWelcome locale={locale} onDismiss={dismissWelcome} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6 sm:mb-8">
        <div>
          <p className="text-sm text-neutral-400 mb-1">Switch</p>
          <h1 className="text-xl sm:text-2xl font-bold text-neutral-900">
            {t('pipeline.title')}
            {isDirector && <span className="text-sm font-medium text-neutral-400 ml-2">· {t('pipeline.allReps')}</span>}
          </h1>
        </div>
        <Link
          href="/deals/new"
          className="self-start sm:self-auto px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          {t('pipeline.newDeal')}
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8">
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

      {/* The pipeline read as a work queue: how many deals are waiting on
          what, and one click to filter down to them. */}
      {deals.length > 0 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {([['all', locale === 'fr' ? 'Tous' : 'All'], ...(['brief', 'capture', 'next_round'] as NextStepKind[]).map(k => [k, NEXT_STEP[k].short[locale === 'fr' ? 'fr' : 'en']] as const)] as [NextStepKind | 'all', string][]).map(([value, label]) => {
            const count = value === 'all' ? deals.length : stepCount(value)
            const active = stepFilter === value
            if (value !== 'all' && count === 0) return null
            return (
              <button
                key={value}
                onClick={() => setStepFilter(value)}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                  active ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-neutral-600 border-neutral-200 hover:border-neutral-400'
                }`}
              >
                {label} <span className={active ? 'opacity-70' : 'text-neutral-400'}>{count}</span>
              </button>
            )
          })}
        </div>
      )}

      {sortedDeals.length === 0 && deals.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm py-10 text-center mb-4">
          <p className="text-sm text-neutral-400">
            {locale === 'fr' ? 'Aucun deal à cette étape.' : 'No deal at this step.'}
          </p>
        </div>
      )}

      {/* Empty state (both views) */}
      {deals.length === 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm py-16 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">+</span>
          </div>
          <p className="text-sm text-neutral-500 mb-4">{t('pipeline.noDeals')}</p>
          <Link href="/deals/new" className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all">
            {t('pipeline.newDeal')}
          </Link>
        </div>
      )}

      {/* Mobile card list */}
      {deals.length > 0 && (
        <div className="md:hidden space-y-3">
          {sortedDeals.map((deal: Deal) => {
            const r = latestRound(deal.id)
            return (
              <div key={deal.id} className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <EditableProspectName dealId={deal.id} name={deal.prospect_name} />
                    {deal.contact_name && (
                      <div className="text-xs text-neutral-400 mt-0.5 truncate">{deal.contact_name}{deal.contact_title ? ` · ${deal.contact_title}` : ''}</div>
                    )}
                    {isDirector && (
                      <div className="text-xs text-neutral-500 mt-1">{repNames[deal.user_id] || '—'}</div>
                    )}
                  </div>
                  <div className="relative flex-shrink-0">
                    <button onClick={() => setOpenMenuId(openMenuId === deal.id ? null : deal.id)} className="text-neutral-300 hover:text-neutral-500 transition-colors text-lg leading-none px-1">···</button>
                    {openMenuId === deal.id && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-full mt-1 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30 min-w-[180px]">
                          <button onClick={() => { setPendingClose({ deal, status: 'won' }); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">{t('pipeline.markWon')}</button>
                          <button onClick={() => { setPendingClose({ deal, status: 'lost' }); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">{t('pipeline.markLost')}</button>
                          <button onClick={() => { handleSetStatus(deal.id, 'paused'); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">{t('pipeline.markPaused')}</button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className="font-medium text-neutral-500 bg-neutral-100 rounded-lg px-2 py-1">R{deal.current_round}</span>
                  <span className="font-semibold text-neutral-700">{deal.potential_revenue ? fmtRevenue(deal.potential_revenue) : '—'}</span>
                </div>
                {showScores && (
                  <div className="grid grid-cols-4 gap-2 pt-1 border-t border-neutral-100 min-w-0">
                    <ScoreCell round={r} layer={1} label="L1" />
                    <ScoreCell round={r} layer={2} label="L2" />
                    <ScoreCell round={r} layer={3} label="L3" />
                    <ScoreCell round={r} layer={4} label="L4" />
                  </div>
                )}
                {(() => {
                  const step = stepFor(deal)
                  const cfg = NEXT_STEP[step.kind]
                  return (
                    <div className="pt-2 border-t border-neutral-100 space-y-2">
                      <div className="text-[11px] text-neutral-400">
                        {locale === 'fr' ? 'Prochaine étape' : 'Next step'} · R{step.round}
                      </div>
                      <Link
                        href={hrefForStep(deal, step.kind)}
                        className={`block text-center text-sm font-medium rounded-xl py-2.5 transition-all ${cfg.button}`}
                      >
                        {cfg.label[locale === 'fr' ? 'fr' : 'en']}
                      </Link>
                      {showScores && (
                        <Link href={dealHref(deal.id)} className="block text-center text-xs text-neutral-400 hover:text-blue-500">
                          {t('pipeline.dashboard')}
                        </Link>
                      )}
                    </div>
                  )
                })()}
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop table */}
      <div className="hidden md:block bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto">
        <div className="min-w-[900px]">
        {/* Table header */}
        <div className={`grid gap-3 px-5 py-3 border-b border-neutral-100 bg-neutral-50/50`} style={{ gridTemplateColumns: gridCols }}>
          <button onClick={() => toggleSort('prospect')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.prospect')}{sortIndicator('prospect')}</button>
          {isDirector && <button onClick={() => toggleSort('rep')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.rep')}{sortIndicator('rep')}</button>}
          <button onClick={() => toggleSort('round')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-left hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.round')}{sortIndicator('round')}</button>
          <button onClick={() => toggleSort('revenue')} className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-right hover:text-neutral-600 transition-colors cursor-pointer">{t('pipeline.revenue')}{sortIndicator('revenue')}</button>
          {showScores && <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{t('pipeline.activity')}</div>}
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide">{locale === 'fr' ? 'Prochaine étape' : 'Next step'}</div>
          <div className="text-xs font-medium text-neutral-400 uppercase tracking-wide text-right">{t('pipeline.actions')}</div>
        </div>

        {sortedDeals.map((deal: Deal) => {
          const r = latestRound(deal.id)
          return (
            <div key={deal.id} className="grid gap-3 px-5 py-4 border-b border-neutral-100 items-center hover:bg-neutral-50/50 transition-colors" style={{ gridTemplateColumns: gridCols }}>
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
              {showScores && (
                <div className="grid grid-cols-4 gap-3">
                  <ScoreCell round={r} layer={1} label={t('layer.1')} />
                  <ScoreCell round={r} layer={2} label={t('layer.2')} />
                  <ScoreCell round={r} layer={3} label={t('layer.3')} />
                  <ScoreCell round={r} layer={4} label={t('layer.4')} />
                </div>
              )}
              {(() => {
                const step = stepFor(deal)
                const cfg = NEXT_STEP[step.kind]
                return (
                  <div className="flex items-center min-w-0">
                    <Link
                      href={hrefForStep(deal, step.kind)}
                      className={`text-xs font-medium rounded-lg px-3 py-2 transition-all truncate ${cfg.button}`}
                      title={`${cfg.label[locale === 'fr' ? 'fr' : 'en']} — R${step.round}`}
                    >
                      {cfg.label[locale === 'fr' ? 'fr' : 'en']}
                      <span className="opacity-70 ml-1.5">R{step.round}</span>
                    </Link>
                  </div>
                )
              })()}
              <div className="flex items-center justify-end gap-2">
                {showScores && (
                  <Link href={dealHref(deal.id)} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                    {t('pipeline.dashboard')}
                  </Link>
                )}
                <div className="relative">
                  <button onClick={() => setOpenMenuId(openMenuId === deal.id ? null : deal.id)} className="text-neutral-300 hover:text-neutral-500 transition-colors text-lg leading-none px-1">···</button>
                  {openMenuId === deal.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setOpenMenuId(null)} />
                      <div className="absolute right-0 bottom-full mb-1 bg-white border border-neutral-200 rounded-xl shadow-lg py-1 z-30 min-w-[180px]">
                        <button onClick={() => { setPendingClose({ deal, status: 'won' }); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
                          {t('pipeline.markWon')}
                        </button>
                        <button onClick={() => { setPendingClose({ deal, status: 'lost' }); setOpenMenuId(null) }} className="w-full text-left px-4 py-2.5 text-sm text-neutral-600 hover:bg-neutral-50 transition-colors">
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
      </div>

      {pendingClose && (
        <OutcomeDialog
          prospectName={pendingClose.deal.prospect_name}
          status={pendingClose.status}
          currentRound={pendingClose.deal.current_round}
          onCancel={() => setPendingClose(null)}
          onConfirm={outcome => {
            handleSetStatus(pendingClose.deal.id, pendingClose.status, outcome)
            setPendingClose(null)
          }}
        />
      )}

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
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-neutral-700">{deal.prospect_name}</span>
                    <span className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${statusColor}`}>{statusLabel}</span>
                  </div>
                  {reasonLabels(deal.close_reasons).length > 0 && (
                    <div className="text-xs text-neutral-400 mt-0.5 truncate">
                      {reasonLabels(deal.close_reasons).join(' · ')}
                      {deal.close_round ? ` · round ${deal.close_round}` : ''}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <Link href={dealHref(deal.id)} className="text-sm text-blue-500 hover:text-blue-600 font-medium transition-colors">
                    {showScores ? t('pipeline.dashboard') : (locale === 'fr' ? 'ouvrir →' : 'open →')}
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
