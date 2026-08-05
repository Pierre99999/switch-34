'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type DealRound } from '@/lib/types'
import { computeDealState } from '@/lib/scoring'
import { roundState } from '@/lib/deal-rounds'
import { normalizeSellerRead, readGap } from '@/lib/seller-read'
import { normalizeFit } from '@/lib/playbook-fit'
import type { Declaration } from '@/lib/voice-credit'
import LabSidebar from '@/components/lab/LabSidebar'
import DealCopilot from '@/components/lab/DealCopilot'
import DealKnowledge from '@/components/lab/DealKnowledge'
import DealTimeline from '@/components/lab/DealTimeline'
import NextFocus from '@/components/lab/NextFocus'
import { copilotSuggestions } from '@/lib/copilot-suggestions'
import BriefingLetter from '@/components/lab/BriefingLetter'
import TranscriptImport from '@/components/lab/TranscriptImport'
import { normalizePlaybook } from '@/lib/playbook'
import { actorCoverage, type ActorCoverage, type DealContact } from '@/lib/playbook-fit'

// One screen per deal. The five tabs of the current app — context, dashboard,
// briefing, conversation, analysis — become one page whose parts answer, in
// order: where does this deal stand, what is the next move, what happened,
// and what do we actually know.
//
// Same engine, same database. Nothing here computes a score of its own.

// One hue per gate, kept identical wherever that gate appears — the cards,
// the knowledge panel, the focus. Colour is the fastest way to know which
// gate you are looking at without reading.
const GATE_STYLE: Record<number, { ring: string; bar: string; track: string; icon: string }> = {
  1: { ring: 'bg-emerald-50 text-emerald-500', bar: 'bg-emerald-500', track: 'bg-emerald-100', icon: '◎' },
  2: { ring: 'bg-amber-50 text-amber-500', bar: 'bg-amber-500', track: 'bg-amber-100', icon: '◈' },
  3: { ring: 'bg-violet-50 text-violet-500', bar: 'bg-violet-500', track: 'bg-violet-100', icon: '◆' },
  4: { ring: 'bg-blue-50 text-blue-500', bar: 'bg-blue-500', track: 'bg-blue-100', icon: '◇' },
}

// LAYER_LABELS in types.ts is the English internal name used in AI prompts.
// The screen shows the method's own wording.
const GATE_NAME: Record<number, string> = {
  1: 'L’opportunité',
  2: 'Gagner',
  3: 'L’impact',
  4: 'Momentum',
}

const STATUS_WORDING: Record<string, string> = {
  FRANCHIE: 'Franchie',
  PRETE: 'Prête, en attente',
  EN_CONSTRUCTION: 'En construction',
  A_RISQUE: 'À risque',
  EMPTY: 'Rien de renseigné',
  VIVANT: 'Dynamique vivante',
  FRAGILE: 'Dynamique fragile',
  EN_PANNE: 'Faible dynamique',
  EN_OBSERVATION: 'En observation',
}

function GateCard({ layer, score, status, sub }: { layer: number; score: number | null; status: string; sub: string | null }) {
  const st = GATE_STYLE[layer]
  const pct = score !== null ? (score / 5) * 100 : 0
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <div className="flex items-center gap-2.5 mb-4">
        <span className={`w-9 h-9 rounded-full flex items-center justify-center text-base ${st.ring}`}>{st.icon}</span>
        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] leading-tight">
          {GATE_NAME[layer]}
        </div>
      </div>
      <div className="text-[28px] leading-none font-bold text-neutral-900 mb-3">
        {score !== null ? score.toFixed(1) : '—'}<span className="text-base font-medium text-neutral-300">/5</span>
      </div>
      <div className={`h-1.5 rounded-full overflow-hidden mb-2.5 ${st.track}`}>
        <div className={`h-full rounded-full ${st.bar} transition-all duration-500`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-neutral-500">{STATUS_WORDING[status] ?? status}</div>
      {sub && <div className="text-[11px] text-rose-500 mt-1 leading-snug">{sub}</div>}
    </div>
  )
}

export default function LabDealPage() {
  const params = useParams()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [knowledgeOpen, setKnowledgeOpen] = useState(true)
  const [showBriefing, setShowBriefing] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [coverage, setCoverage] = useState<ActorCoverage | null>(null)
  const [stakeholders, setStakeholders] = useState<DealContact[]>([])

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const [{ data: d }, { data: r }, { data: sh }, { data: v }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
      supabase.from('deal_stakeholders').select('name, role, actor_type, actor_types').eq('deal_id', dealId),
      user
        ? supabase.from('vendors').select('playbook, locale').eq('user_id', user.id).maybeSingle()
        : Promise.resolve({ data: null }),
    ])
    if (d) setDeal(d)
    setRounds(r ?? [])
    setStakeholders((sh ?? []) as DealContact[])
    setCoverage(v?.playbook ? actorCoverage(normalizePlaybook(v.playbook, v.locale ?? 'fr'), sh ?? []) : null)
    setSelectedRound(prev => prev ?? (d?.current_round ?? 0))
  }, [dealId])

  useEffect(() => { load() }, [load])

  if (!deal) {
    return (
      <div className="flex">
        <LabSidebar />
        <div className="flex-1 p-8 text-sm text-neutral-400">Chargement…</div>
      </div>
    )
  }

  const shownRound = selectedRound ?? deal.current_round
  const current = rounds.find(r => r.round === shownRound) ?? null
  const dealState = computeDealState(rounds, shownRound)
  const sellerRead = normalizeSellerRead((current as unknown as { seller_read?: unknown } | null)?.seller_read)
  const gap = readGap(sellerRead, current)
  const fit = normalizeFit(deal.playbook_fit)

  async function runAction(kind: 'brief' | 'capture' | 'next_round') {
    if (kind === 'capture') { setShowImport(true); return }
    setBusy(kind); setError(null)
    try {
      const supabase = createClient()
      let roundId = current?.id
      if (kind === 'next_round' || roundState(current) !== 'UNSTARTED') {
        if (kind === 'next_round') {
          const { data: nr, error: e } = await supabase
            .from('deal_rounds').insert({ deal_id: dealId, round: deal!.current_round + 1 }).select().single()
          if (e || !nr) throw new Error(e?.message ?? 'Création du round impossible')
          await supabase.from('deals').update({ current_round: nr.round }).eq('id', dealId)
          roundId = nr.id
        }
      }
      if (!roundId) {
        const { data: nr, error: e } = await supabase
          .from('deal_rounds').insert({ deal_id: dealId, round: Math.max(deal!.current_round, 1) }).select().single()
        if (e || !nr) throw new Error(e?.message ?? 'Création du round impossible')
        await supabase.from('deals').update({ current_round: nr.round }).eq('id', dealId)
        roundId = nr.id
      }
      const res = await fetch('/api/ai/briefing', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId, locale: 'fr' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Échec (${res.status})`)
      await load()
      setSelectedRound(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    }
    setBusy(null)
  }

  const fmtRevenue = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 1)}k€` : `${n}€`

  return (
    <div className="flex">
      <LabSidebar />

      <div className="flex-1 min-w-0 flex">
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-7">
          {/* Header */}
          <Link href="/lab" className="text-sm text-neutral-400 hover:text-blue-500 transition-colors">← Retour au pipeline</Link>
          <div className="flex items-start justify-between gap-4 mt-2 mb-6 flex-wrap">
            <div>
              <h1 className="text-[32px] leading-tight font-bold text-neutral-900">{deal.prospect_name}</h1>
              <p className="text-sm text-neutral-400 mt-1">
                {deal.contact_name ?? '—'}{deal.contact_title ? <span className="text-neutral-300"> · {deal.contact_title}</span> : null}
              </p>
            </div>
            <div className="flex items-center gap-4">
              {deal.potential_revenue && (
                <div className="text-right">
                  <div className="text-sm font-semibold text-neutral-800">{fmtRevenue(deal.potential_revenue)}</div>
                  <div className="text-[11px] text-neutral-400">CA potentiel</div>
                </div>
              )}
              <select
                value={shownRound}
                onChange={e => setSelectedRound(Number(e.target.value))}
                className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium rounded-xl px-3 py-2 focus:outline-none"
              >
                <option value={0}>Départ</option>
                {rounds.map(r => <option key={r.id} value={r.round}>Round {r.round}</option>)}
              </select>
            </div>
          </div>

          {/* The four gates */}
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
            {[1, 2, 3].map(l => (
              <GateCard
                key={l}
                layer={l}
                score={dealState.gates[l]?.score ?? null}
                status={dealState.gates[l]?.status ?? 'EMPTY'}
                sub={dealState.gates[l]?.lockMessage ?? null}
              />
            ))}
            <GateCard
              layer={4}
              score={dealState.momentum.score}
              status={dealState.momentum.status}
              sub={dealState.momentum.stagnant ? 'Stagnation sur 3 captures' : null}
            />
          </div>

          <NextFocus
            deal={deal}
            rounds={rounds}
            current={current}
            dealState={dealState}
            coverage={coverage}
            busy={!!busy}
            error={error}
            onRun={runAction}
            onOpenBriefing={() => setShowBriefing(true)}
          />

          {/* The two parallel readings, when they have something to say. */}
          {(gap && gap.kind !== 'aligned') && (
            <p className={`mb-3 text-sm rounded-xl px-4 py-2.5 ${gap.kind === 'optimistic' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
              {gap.kind === 'optimistic'
                ? 'Vous sentez ce deal mieux que les preuves ne le montrent.'
                : 'Les preuves sont meilleures que votre ressenti.'}
            </p>
          )}
          {fit?.avoid_list_hit && (
            <p className="mb-3 text-sm rounded-xl px-4 py-2.5 bg-rose-50 text-rose-800">
              ⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir.
            </p>
          )}

          {/* History + copilot */}
          <div className="grid lg:grid-cols-[1fr_340px] gap-5 items-start">
            <DealCopilot
              dealId={dealId}
              suggestions={copilotSuggestions({ deal, rounds, current, dealState, coverage })}
              onRan={load}
            />
            <DealTimeline deal={deal} rounds={rounds} dealId={dealId} />
          </div>
        </main>

        {showBriefing && current && (
        <BriefingLetter round={current} prospectName={deal.prospect_name} onClose={() => setShowBriefing(false)} />
      )}
      {showImport && current && (
        <TranscriptImport
          dealId={dealId}
          round={current}
          onDone={load}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* Knowledge panel */}
        {knowledgeOpen && (
          <DealKnowledge
            deal={deal}
            round={current}
            contacts={stakeholders}
            fit={fit}
            coverage={coverage}
            declarations={(current?.declarations ?? {}) as Record<string, Declaration[]>}
            onClose={() => setKnowledgeOpen(false)}
          />
        )}
        {!knowledgeOpen && (
          <button
            onClick={() => setKnowledgeOpen(true)}
            className="hidden xl:block w-10 border-l border-neutral-200 bg-white text-neutral-400 hover:text-neutral-700 text-xs"
            title="Connaissance du deal"
          >
            ◀
          </button>
        )}
      </div>
    </div>
  )
}
