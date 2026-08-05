'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Deal, DealRound } from '@/lib/types'
import { simpleStatus, computeDealState } from '@/lib/scoring'
import { nextStep, type NextStepKind } from '@/lib/deal-rounds'
import LabSidebar from '@/components/lab/LabSidebar'

const STEP: Record<NextStepKind, { label: string; pill: string }> = {
  brief: { label: 'Briefing à créer', pill: 'bg-blue-50 text-blue-600 border-blue-200' },
  capture: { label: 'Conversation à capturer', pill: 'bg-violet-50 text-violet-600 border-violet-200' },
  next_round: { label: 'Round suivant', pill: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  closed: { label: 'Clos', pill: 'bg-neutral-100 text-neutral-500 border-neutral-200' },
}

export default function LabPipeline() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [archived, setArchived] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: d } = await supabase.from('deals').select('*').eq('status', 'active').order('updated_at', { ascending: false })
      const { count } = await supabase.from('deals').select('id', { count: 'exact', head: true }).neq('status', 'active')
      setDeals(d ?? [])
      setArchived(count ?? 0)
      const ids = (d ?? []).map(x => x.id)
      if (ids.length) {
        const { data: r } = await supabase.from('deal_rounds').select('*').in('deal_id', ids)
        setRounds(r ?? [])
      }
      setLoading(false)
    })()
  }, [])

  const roundsOf = (id: string) => rounds.filter(r => r.deal_id === id)
  const latest = (id: string) => roundsOf(id).sort((a, b) => b.round - a.round)[0] ?? null

  const counts = {
    active: deals.length,
    nearClose: deals.filter(d => { const r = latest(d.id); return r && [1, 2, 3].every(l => simpleStatus(r, l) === 'FRANCHIE') }).length,
    atRisk: deals.filter(d => { const r = latest(d.id); return r && [1, 2, 3, 4].some(l => simpleStatus(r, l) === 'A_RISQUE') }).length,
    archived,
  }

  return (
    <div className="flex">
      <LabSidebar counts={counts} />
      <main className="flex-1 min-w-0 px-5 sm:px-8 py-6">
        <h1 className="text-2xl font-bold text-neutral-900 mb-1">Deals</h1>
        <p className="text-sm text-neutral-500 mb-6">Interface en construction — visible de vous seul.</p>

        {loading && <p className="text-sm text-neutral-400">Chargement…</p>}
        {!loading && deals.length === 0 && <p className="text-sm text-neutral-400">Aucun deal actif.</p>}

        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {deals.map(d => {
            const rs = roundsOf(d.id)
            const state = computeDealState(rs, d.current_round)
            const step = STEP[nextStep(d, rs).kind]
            return (
              <Link
                key={d.id}
                href={`/lab/deals/${d.id}`}
                className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 hover:border-blue-300 hover:shadow transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-neutral-900 truncate">{d.prospect_name}</div>
                    <div className="text-xs text-neutral-400 truncate">
                      {d.contact_name ?? '—'}{d.contact_title ? ` · ${d.contact_title}` : ''}
                    </div>
                  </div>
                  <span className="text-xs font-medium text-neutral-500 bg-neutral-100 rounded-lg px-2 py-1 flex-shrink-0">R{d.current_round}</span>
                </div>

                <div className="grid grid-cols-4 gap-2 mt-3">
                  {[1, 2, 3].map(l => (
                    <div key={l}>
                      <div className="text-[10px] text-neutral-400 uppercase">P{l}</div>
                      <div className="text-sm font-semibold text-neutral-700">{state.gates[l]?.score?.toFixed(1) ?? '—'}</div>
                    </div>
                  ))}
                  <div>
                    <div className="text-[10px] text-neutral-400 uppercase">Mom.</div>
                    <div className="text-sm font-semibold text-neutral-700">{state.momentum.score?.toFixed(1) ?? '—'}</div>
                  </div>
                </div>

                <span className={`inline-block text-[11px] font-medium border rounded-full px-2.5 py-1 mt-3 ${step.pill}`}>
                  {step.label}
                </span>
              </Link>
            )
          })}
        </div>
      </main>
    </div>
  )
}
