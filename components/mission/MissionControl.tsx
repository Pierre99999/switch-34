'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Deal, DealRound } from '@/lib/types'
import { portfolioActions, portfolioPositions, type PortfolioAction } from '@/lib/mission-control'
import { normalizePlaybook } from '@/lib/playbook'
import { actorCoverage, type ActorCoverage, type DealContact } from '@/lib/playbook-fit'
import PortfolioMap from './PortfolioMap'
import PipelineView from '@/components/pipeline/PipelineView'

// Mission Control: what is happening across the deals, and what to do first.
//
// Three readings of the same portfolio — ask it a question, act on what it
// prescribes, or look at where everything sits. The list of rows is still
// here, below: a map is good for seeing, a table is good for finding.

const READY_QUESTIONS = [
  { icon: '⚡', label: 'Que puis-je gagner rapidement ?', q: 'Quels deals sont les plus proches d’aboutir, et sur quelles preuves ? Dis-moi ce qui reste à établir sur chacun.' },
  { icon: '👤', label: 'Où dois-je intervenir ?', q: 'Sur quels deals mon intervention change quelque chose aujourd’hui, et pourquoi maintenant ?' },
  { icon: '⚠', label: 'Quels deals sont en danger ?', q: 'Quels deals sont en danger, sur quel critère exactement, et qu’est-ce qui les sauverait ?' },
  { icon: '📊', label: 'Où est mon plus gros risque ?', q: 'Quel deal représente le plus gros risque pour mon portefeuille, en tenant compte du CA et de ce qui n’est pas établi ?' },
]

const SEVERITY: Record<PortfolioAction['severity'], string> = {
  high: 'bg-rose-50 text-rose-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-blue-50 text-blue-600',
}

export default function MissionControl() {
  const [deals, setDeals] = useState<Deal[]>([])
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [coverage, setCoverage] = useState<Record<string, ActorCoverage | null>>({})
  const [firstName, setFirstName] = useState<string>('')
  const [loading, setLoading] = useState(true)
  // Stamped when the data is read, not during render: "12 days ago" must mean
  // the same thing everywhere on the screen, and Date.now() in a render body
  // is a different answer every pass.
  const [now, setNow] = useState(0)
  const [showAll, setShowAll] = useState(false)

  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: vendor }, { data: dealRows }] = await Promise.all([
      supabase.from('vendors').select('full_name, playbook, locale').eq('user_id', user.id).maybeSingle(),
      supabase.from('deals').select('*').eq('status', 'active'),
    ])

    setFirstName((vendor?.full_name ?? '').trim().split(' ')[0] ?? '')
    const list = (dealRows ?? []) as Deal[]
    setDeals(list)

    if (list.length > 0) {
      const ids = list.map(d => d.id)
      const [{ data: roundRows }, { data: contactRows }] = await Promise.all([
        supabase.from('deal_rounds').select('*').in('deal_id', ids).order('round', { ascending: true }),
        supabase.from('deal_stakeholders').select('deal_id, name, actor_type, actor_types').in('deal_id', ids),
      ])
      setRounds((roundRows ?? []) as DealRound[])

      // Actor coverage is a playbook reading, so it is computed per deal from
      // the same socle rather than asked of the server twice.
      const playbook = normalizePlaybook(vendor?.playbook, vendor?.locale ?? 'fr')
      const byDeal: Record<string, DealContact[]> = {}
      for (const c of (contactRows ?? []) as (DealContact & { deal_id: string })[]) {
        (byDeal[c.deal_id] ??= []).push(c)
      }
      setCoverage(Object.fromEntries(ids.map(id => [id, actorCoverage(playbook, byDeal[id] ?? [])])))
    }
    setNow(Date.now())
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const roundsByDeal = useMemo(() => {
    const map: Record<string, DealRound[]> = {}
    for (const r of rounds) (map[r.deal_id] ??= []).push(r)
    return map
  }, [rounds])

  const actions = useMemo(
    () => portfolioActions({ deals, roundsByDeal, coverageByDeal: coverage, now }),
    [deals, roundsByDeal, coverage, now],
  )
  const positions = useMemo(
    () => portfolioPositions({ deals, roundsByDeal, now }),
    [deals, roundsByDeal, now],
  )

  async function ask(q: string) {
    const text = q.trim()
    if (!text) return
    setAsking(true); setAskError(null); setAnswer(null); setQuestion(text)
    try {
      const res = await fetch('/api/ai/portfolio', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: text, locale: 'fr' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Échec (${res.status})`)
      setAnswer(data.answer)
    } catch (e) {
      setAskError(e instanceof Error ? e.message : 'Question impossible')
    }
    setAsking(false)
  }

  if (loading) return <div className="p-8 text-sm text-neutral-400">Chargement…</div>

  const shown = showAll ? actions : actions.slice(0, 5)

  return (
    <div className="max-w-6xl mx-auto py-6 sm:py-8 px-4 sm:px-6 space-y-5">
      <header className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-[28px] leading-tight font-bold text-neutral-900">
            Bonjour {firstName || 'à vous'} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-neutral-400 mt-1">Voici ce qui se passe dans vos deals aujourd’hui.</p>
        </div>
        <Link
          href="/lab/deals/new"
          className="bg-blue-500 text-white text-sm font-semibold rounded-xl px-5 py-2.5 hover:bg-blue-600 shadow-sm shadow-blue-500/20 transition-all"
        >
          + Nouveau deal
        </Link>
      </header>

      {/* ── Ask ── */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-lg font-bold text-neutral-900">Que voulez-vous savoir ?</h2>
        <p className="text-sm text-neutral-400 mt-1">
          Posez n’importe quelle question sur votre portefeuille. La réponse ne sort que du diagnostic — pas de pronostic.
        </p>

        <form
          onSubmit={e => { e.preventDefault(); ask(question) }}
          className="mt-4 flex items-center gap-2"
        >
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            placeholder="Posez votre question ici…"
            className="flex-1 border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 placeholder:text-neutral-300"
          />
          <button
            type="submit"
            disabled={asking || !question.trim()}
            className="w-11 h-11 flex-shrink-0 rounded-xl bg-blue-500 text-white text-lg hover:bg-blue-600 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
            aria-label="Envoyer"
          >
            {asking ? '…' : '↑'}
          </button>
        </form>

        {(answer || askError) && (
          <div className={`mt-4 rounded-xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            askError ? 'bg-rose-50 text-rose-700' : 'bg-neutral-50 text-neutral-700'
          }`}>
            {askError ?? answer}
          </div>
        )}

        <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mt-5 mb-2">
          Questions prêtes à l’emploi
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {READY_QUESTIONS.map(r => (
            <button
              key={r.label}
              onClick={() => ask(r.q)}
              disabled={asking}
              className="flex items-start gap-2.5 text-left border border-neutral-200 rounded-xl px-3.5 py-3 hover:border-neutral-400 disabled:opacity-50 transition-colors"
            >
              <span aria-hidden>{r.icon}</span>
              <span className="text-sm font-medium text-neutral-700 leading-snug">{r.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* ── Do ── */}
      <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-neutral-900">Ce que vous devriez faire cette semaine</h2>
            <p className="text-sm text-neutral-400 mt-1">
              Par ordre de ce que la méthode traite en premier — trancher avant d’avancer.
            </p>
          </div>
          {actions.length > 5 && (
            <button onClick={() => setShowAll(s => !s)} className="text-sm text-neutral-400 hover:text-neutral-700 flex-shrink-0">
              {showAll ? 'Réduire' : `Voir tout (${actions.length})`}
            </button>
          )}
        </div>

        {actions.length === 0 ? (
          <p className="text-sm text-neutral-400 mt-5">
            Rien ne réclame d’action aujourd’hui. Un pipeline silencieux est soit propre, soit vide.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-neutral-100">
            {shown.map((a, i) => (
              <li key={`${a.dealId}-${i}`} className="py-4 flex items-start gap-4 flex-wrap sm:flex-nowrap">
                <span className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${SEVERITY[a.severity]}`}>
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-neutral-900">{a.prospect}</div>
                  <div className="text-sm text-neutral-600 leading-relaxed">{a.title}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{a.why}</div>
                </div>
                <div className="text-xs text-neutral-400 sm:w-52 flex-shrink-0">
                  <div className="font-medium text-neutral-500">Ce que ça débloque</div>
                  <div>{a.unlocks}</div>
                </div>
                <Link
                  href={`/lab/deals/${a.dealId}`}
                  className="text-sm font-medium text-blue-600 hover:text-blue-700 border border-neutral-200 rounded-xl px-4 py-2.5 whitespace-nowrap flex-shrink-0"
                >
                  {a.cta} →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ── See ── */}
      {positions.length > 0 && (
        <section className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h2 className="text-lg font-bold text-neutral-900">Votre portefeuille en un coup d’œil</h2>
              <p className="text-sm text-neutral-400 mt-1">
                Chaque bulle est un deal : sa position dit les portes franchies et le momentum, sa taille le CA.
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-400">
              <span>Risque</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" />Faible</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" />Moyen</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-400" />Élevé</span>
            </div>
          </div>
          <div className="mt-4">
            <PortfolioMap positions={positions} />
          </div>
          <p className="text-[11px] text-neutral-300 mt-2">
            La note est celle du diagnostic, sur 5. Ce n’est pas une probabilité de signature : rien dans la méthode ne la calcule.
          </p>
        </section>
      )}

      {/* ── Find ── */}
      <section>
        <PipelineView dealHref={id => `/lab/deals/${id}`} stepHref={id => `/lab/deals/${id}`} showScores={false} />
      </section>
    </div>
  )
}
