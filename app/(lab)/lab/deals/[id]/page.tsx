'use client'

import { useCallback, useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type DealRound } from '@/lib/types'
import { computeDealState, prescriptions } from '@/lib/scoring'
import { nextStep, roundState } from '@/lib/deal-rounds'
import { normalizeSellerRead, readGap } from '@/lib/seller-read'
import { normalizeFit } from '@/lib/playbook-fit'
import type { Declaration } from '@/lib/voice-credit'
import LabSidebar from '@/components/lab/LabSidebar'
import DealCopilot from '@/components/lab/DealCopilot'
import DealKnowledge from '@/components/lab/DealKnowledge'
import DealTimeline from '@/components/lab/DealTimeline'

// One screen per deal. The five tabs of the current app — context, dashboard,
// briefing, conversation, analysis — become one page whose parts answer, in
// order: where does this deal stand, what is the next move, what happened,
// and what do we actually know.
//
// Same engine, same database. Nothing here computes a score of its own.

const GATE_STYLE: Record<number, { ring: string; bar: string; icon: string }> = {
  1: { ring: 'bg-emerald-50 text-emerald-600', bar: 'bg-emerald-500', icon: '◎' },
  2: { ring: 'bg-amber-50 text-amber-600', bar: 'bg-amber-500', icon: '◈' },
  3: { ring: 'bg-violet-50 text-violet-600', bar: 'bg-violet-500', icon: '◆' },
  4: { ring: 'bg-blue-50 text-blue-600', bar: 'bg-blue-500', icon: '◇' },
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
    <div className="bg-white rounded-2xl border border-neutral-200 p-4 shadow-sm">
      <div className="flex items-center gap-2.5 mb-3">
        <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm ${st.ring}`}>{st.icon}</span>
        <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wide leading-tight">
          {GATE_NAME[layer]}
        </div>
      </div>
      <div className="text-2xl font-bold text-neutral-900 mb-2">
        {score !== null ? score.toFixed(1) : '—'}<span className="text-sm font-medium text-neutral-400">/5</span>
      </div>
      <div className="h-1.5 bg-neutral-100 rounded-full overflow-hidden mb-2">
        <div className={`h-full rounded-full ${st.bar} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <div className="text-xs text-neutral-500">{STATUS_WORDING[status] ?? status}</div>
      {sub && <div className="text-[11px] text-rose-600 mt-1 leading-snug">{sub}</div>}
    </div>
  )
}

export default function LabDealPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [selectedRound, setSelectedRound] = useState<number | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [knowledgeOpen, setKnowledgeOpen] = useState(true)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: d }, { data: r }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
    ])
    if (d) setDeal(d)
    setRounds(r ?? [])
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
  const step = nextStep(deal, rounds)
  const sellerRead = normalizeSellerRead((current as unknown as { seller_read?: unknown } | null)?.seller_read)
  const gap = readGap(sellerRead, current)
  const fit = normalizeFit(deal.playbook_fit)
  const presc = prescriptions(current)

  // The objective, stated as a directive rather than a table to interpret.
  const focus = (() => {
    if (step.kind === 'closed') return { title: 'Ce deal est clos.', why: null, action: null }
    if (step.kind === 'brief') {
      return {
        title: `Préparer la conversation du round ${step.round}.`,
        why: rounds.length === 0
          ? 'Aucune conversation n’a encore eu lieu : le briefing part de votre Sales Playbook et du contexte prospect.'
          : 'Le round précédent est capturé et noté. Le briefing suivant s’appuiera sur ce qu’il a révélé.',
        action: { label: '✦ Générer le briefing', run: 'brief' as const },
      }
    }
    if (step.kind === 'capture') {
      return {
        title: `Mener la conversation, puis en importer le transcript.`,
        why: 'Le briefing du round est prêt. Rien ne bouge tant que la conversation n’est pas capturée — les scores ne se déduisent que de ce qui a été dit.',
        action: { label: '→ Aller capturer', run: 'capture' as const },
      }
    }
    // next_round: name what is actually blocking, from the active gate.
    const g = dealState.gates[dealState.activeGate]
    const blocked = g?.lockMessage
    const top = presc[0]
    return {
      title: blocked
        ? `Lever ce qui bloque la porte ${dealState.activeGate} — ${GATE_NAME[dealState.activeGate]}.`
        : `Ouvrir le round ${step.round}.`,
      why: blocked
        ? `${blocked}. ${top ? `Le critère le plus faible attend encore ${top.kind === 'MANQUANT' ? 'une première preuve' : top.kind === 'CORROBORER' ? 'une corroboration' : 'une décision assumée'}.` : ''}`
        : 'Le round est capturé et noté. La prochaine conversation peut être préparée.',
      action: { label: `✦ Créer le briefing du round ${step.round}`, run: 'next_round' as const },
    }
  })()

  async function runAction(kind: 'brief' | 'capture' | 'next_round') {
    if (kind === 'capture') { router.push(`/deals/${dealId}/capture`); return }
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
        <main className="flex-1 min-w-0 px-5 sm:px-8 py-6">
          {/* Header */}
          <Link href="/lab" className="text-sm text-neutral-400 hover:text-blue-500 transition-colors">← Retour au pipeline</Link>
          <div className="flex items-start justify-between gap-4 mt-2 mb-6 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold text-neutral-900">{deal.prospect_name}</h1>
              <p className="text-sm text-neutral-500 mt-0.5">
                {deal.contact_name ?? '—'}{deal.contact_title ? ` · ${deal.contact_title}` : ''}
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
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
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

          {/* Next focus */}
          <div className="bg-white rounded-2xl border border-neutral-200 p-5 shadow-sm mb-6">
            <div className="text-[11px] font-semibold text-blue-500 uppercase tracking-wide mb-2">Prochain focus</div>
            <div className="grid lg:grid-cols-[1fr_360px] gap-5">
              <div>
                <h2 className="text-xl font-bold text-neutral-900 leading-snug mb-4">{focus.title}</h2>
                {focus.action && (
                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => runAction(focus.action!.run)}
                      disabled={!!busy}
                      className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
                    >
                      {busy ? 'En cours…' : focus.action.label}
                    </button>
                    {current?.briefing_line && (
                      <Link href={`/deals/${dealId}/briefing`} className="px-5 py-2.5 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 transition-all">
                        Voir le briefing actuel
                      </Link>
                    )}
                  </div>
                )}
                {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
              </div>

              {focus.why && (
                <div className="bg-blue-50/60 border border-blue-100 rounded-xl p-4">
                  <div className="text-xs font-semibold text-blue-700 mb-1">Pourquoi cet objectif ?</div>
                  <p className="text-sm text-neutral-600 leading-relaxed">{focus.why}</p>
                </div>
              )}
            </div>

            {/* The two parallel readings, when they have something to say. */}
            {(gap && gap.kind !== 'aligned') && (
              <p className={`mt-4 text-sm rounded-xl px-4 py-2.5 ${gap.kind === 'optimistic' ? 'bg-amber-50 text-amber-800' : 'bg-blue-50 text-blue-800'}`}>
                {gap.kind === 'optimistic'
                  ? 'Vous sentez ce deal mieux que les preuves ne le montrent.'
                  : 'Les preuves sont meilleures que votre ressenti.'}
              </p>
            )}
            {fit?.avoid_list_hit && (
              <p className="mt-2 text-sm rounded-xl px-4 py-2.5 bg-rose-50 text-rose-800">
                ⚠ Ce prospect ressemble à un segment que vous avez décidé de fuir.
              </p>
            )}
          </div>

          {/* History + copilot */}
          <div className="grid lg:grid-cols-[1fr_340px] gap-5">
            <DealTimeline deal={deal} rounds={rounds} dealId={dealId} />
            <DealCopilot dealId={dealId} onRan={load} />
          </div>
        </main>

        {/* Knowledge panel */}
        {knowledgeOpen && (
          <DealKnowledge
            round={current}
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
