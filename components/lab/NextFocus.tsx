'use client'

import { useState } from 'react'
import type { Deal, DealRound } from '@/lib/types'
import { criterionLabel, gateName } from '@/lib/lab-view'
import { prescriptions, type DealState } from '@/lib/scoring'
import { nextStep } from '@/lib/deal-rounds'
import { normalizeFit, FIT_AXIS_LABELS, type ActorCoverage } from '@/lib/playbook-fit'
import { firstSentences, isTruncated } from '@/lib/text'

// The objective, stated as something to go and do, with what it would take.
//
// Everything here already exists in the engine — the prescriptions, the gate
// lock, the playbook fit, the post-conversation read. What was missing was
// saying it in one place, as an instruction rather than as four panels to
// cross-reference.

type Item = { label: string; tag: string; hint: string; source: string; tint: string }

// Lowercase the first letter so a criterion label reads inside a sentence.
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

export default function NextFocus({
  deal, rounds, current, dealState, coverage, busy, error, onRun, onOpenBriefing,
}: {
  deal: Deal
  rounds: DealRound[]
  current: DealRound | null
  dealState: DealState
  coverage: ActorCoverage | null
  busy: boolean
  error: string | null
  onRun: (kind: 'brief' | 'capture' | 'next_round') => void
  onOpenBriefing: () => void
}) {
  const [showAnalysis, setShowAnalysis] = useState(false)
  const step = nextStep(deal, rounds)
  // Written by the engine right after it analysed the conversation: an
  // objective, then one line of reason. Composing it from the prescriptions
  // gave mechanical phrasing, so that is only the fallback.
  const written = ((current as unknown as { focus_objective?: string } | null)?.focus_objective ?? '').trim()
  const [writtenObjective, writtenWhy] = written ? written.split('\n').map(x => x.trim()) : [null, null]
  const gate = dealState.gates[dealState.activeGate]
  const fit = normalizeFit(deal.playbook_fit)

  // What the next conversation owes this deal, most blocking first.
  const items: Item[] = []
  // The same list as verbs, to compose the objective sentence.
  const aims: string[] = []

  for (const p of prescriptions(current).slice(0, 3)) {
    const label = criterionLabel(p.variable)
    items.push({
      label,
      source: `Porte ${dealState.activeGate}`,
      tint: p.kind === 'NEGATIF' ? 'bg-rose-50 text-rose-600' : 'bg-neutral-100 text-neutral-500',
      tag: p.kind === 'MANQUANT' ? 'zone aveugle'
        : p.kind === 'CORROBORER' ? 'à corroborer'
          : p.kind === 'PRECISER' ? 'à préciser' : 'à trancher',
      hint: p.kind === 'MANQUANT'
        ? 'Rien n’a encore été dit là-dessus — c’est une zone aveugle, pas un score bas.'
        : p.kind === 'CORROBORER'
          ? 'Une seule voix pour l’instant. Qui d’autre peut le confirmer, et quel chiffre le prouverait ?'
          : p.kind === 'PRECISER'
            ? 'Le fait est corroboré mais le signal reste vague — il manque un chiffre, une date, une conséquence.'
            : 'Le signal est défavorable et corroboré. Il faut trancher, ou partir.',
    })
    aims.push(
      p.kind === 'MANQUANT' ? `ouvrir ${lower(label)}`
        : p.kind === 'CORROBORER' ? `corroborer ${lower(label)}`
          : p.kind === 'PRECISER' ? `préciser ${lower(label)}`
            : `trancher sur ${lower(label)}`,
    )
  }

  for (const m of (coverage?.missing ?? []).slice(0, 2)) {
    items.push({
      label: m.label,
      source: 'Playbook A5',
      tint: 'bg-amber-50 text-amber-600',
      tag: 'absent',
      hint: m.risk || 'Ouvrir un chemin vers cette personne.',
    })
    aims.push(`faire entrer ${lower(m.label)} dans la boucle`)
  }

  for (const a of (fit?.axes ?? []).filter(x => x.verdict === 'mismatch' || x.verdict === 'unknown').slice(0, 2)) {
    items.push({
      label: FIT_AXIS_LABELS[a.key].fr,
      source: 'Adéquation playbook',
      tint: 'bg-violet-50 text-violet-600',
      tag: a.verdict === 'mismatch' ? 'hors cadre' : 'inconnu',
      hint: a.gap?.trim() || a.reason?.trim() || 'À trancher lors du prochain échange.',
    })
  }

  // The objective of the conversation ahead, as an action.
  //
  // Once the briefing exists the state becomes 'capture', and this used to
  // print two fixed sentences — "Mener la conversation" / "Le briefing est
  // prêt" — on every deal, throwing away the prescriptions that had just been
  // computed and the angle the briefing engine had just written. The objective
  // does not become generic because a briefing was produced; that is the
  // moment it is at its most precise.
  const objectiveFromAims = (() => {
    if (aims.length === 0) return null
    const [a, b] = aims
    const phrase = b ? `${a} et ${b}` : a
    return `${phrase.charAt(0).toUpperCase()}${phrase.slice(1)}.`
  })()

  const title = (() => {
    if (step.kind === 'closed') return 'Ce deal est clos.'
    if (step.kind !== 'capture' && writtenObjective) return writtenObjective
    if (rounds.length === 0 && step.kind !== 'capture') return 'Préparer la première conversation.'
    if (objectiveFromAims) return objectiveFromAims
    if (step.kind === 'capture') {
      return current?.briefing_line?.trim() || 'Mener la conversation, puis en importer le transcript.'
    }
    return gate?.lockVariable
      ? `Lever ce qui bloque la porte ${dealState.activeGate} — ${gateName(dealState.activeGate)}.`
      : `Préparer la conversation du round ${step.round}.`
  })()

  const hypothesis = (current?.briefing_hypothesis ?? '').trim() || null

  const gateLine = `Porte ${dealState.activeGate} · ${gateName(dealState.activeGate)}${gate?.lockVariable ? ` — ${criterionLabel(gate.lockVariable)}` : ''}`
  const subtitle = step.kind === 'closed' ? null
    : step.kind === 'capture' ? `${gateLine} · briefing du round ${step.round} prêt`
      : gateLine

  // The full engine read, and the short version shown on the card.
  const fullWhy = (() => {
    if (step.kind === 'capture') {
      // The angle is the briefing engine's own statement of what this
      // conversation must resolve — written for this deal, this round, these
      // people. It is the answer to "why this objective".
      const angle = current?.briefing_angle?.trim()
      const win = current?.briefing_win_condition?.trim()
      if (angle) return win ? `${angle}\n\nCette conversation est réussie si : ${win}` : angle
      if (win) return `Cette conversation est réussie si : ${win}`
      return 'Le briefing est prêt. Rien ne bouge tant que la conversation n’est pas capturée : les scores ne se déduisent que de ce qui a été dit, jamais de ce qu’on suppose.'
    }
    if (rounds.length === 0) {
      return 'Aucune conversation n’a encore eu lieu. Le briefing part de votre Sales Playbook et du contexte prospect — les portes se rempliront à partir du premier échange.'
    }
    const read = current?.briefing_read?.trim()
    if (read) return read
    if (gate?.lockVariable) return `${criterionLabel(gate.lockVariable)} reste sous le seuil. Tant que c’est le cas, la porte ne se franchit pas et les suivantes restent en attente.`
    return 'Le round est capturé et noté. La prochaine conversation peut être préparée.'
  })()

  // A couple of sentences on the card — whole ones. Anything longer stops
  // being read, and a fragment is worse than a short paragraph.
  const shortWhy = writtenWhy || firstSentences(fullWhy, 200)
  const truncated = !writtenWhy && isTruncated(fullWhy, 200)

  const action = step.kind === 'closed' ? null
    : step.kind === 'capture' ? { label: '📄 Importer le transcript', run: 'capture' as const }
      : step.kind === 'brief' ? { label: '✦ Générer le briefing', run: 'brief' as const }
        : { label: `✦ Créer le briefing du round ${step.round}`, run: 'next_round' as const }

  return (
    <>
      <div className="bg-white rounded-2xl border border-neutral-200/80 p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04)] mb-6">
        <div className="flex items-center gap-2 mb-3">
          <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm">◈</span>
          <span className="text-[11px] font-semibold text-blue-500 uppercase tracking-[0.08em]">L’hypothèse du round</span>
          {step.kind !== 'closed' && <span className="text-[11px] text-neutral-300">Round {step.round}</span>}
        </div>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6">
          <div>
            {/* The bet the round is making. A round is not a list of
                questions: it is something that can turn out to be false, and
                saying so out loud is what makes the next capture decisive. */}
            {hypothesis ? (
              <>
                <blockquote className="border-l-[3px] border-blue-400 pl-4 text-[22px] leading-[1.35] font-bold text-neutral-900 tracking-tight">
                  {hypothesis}
                </blockquote>
                <p className="text-sm text-neutral-400 mt-2.5">{title}{subtitle ? ` · ${subtitle}` : ''}</p>
              </>
            ) : (
              <>
                <h2 className="text-[26px] leading-[1.25] font-bold text-neutral-900 tracking-tight">{title}</h2>
                {subtitle && <p className="text-sm text-neutral-400 mt-1.5">{subtitle}</p>}
              </>
            )}

            {items.length > 0 && (
              <>
                <div className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em] mt-5 mb-3">
                  Ce que cette conversation doit confirmer
                </div>
                <ul className="space-y-2.5">
                  {items.map((it, i) => (
                    <li key={i} className="flex items-center gap-3" title={`${it.hint} · ${it.source}`}>
                      <span className={`w-6 h-6 rounded-full text-[11px] font-semibold flex items-center justify-center flex-shrink-0 ${it.tint}`}>
                        ✓
                      </span>
                      <span className="text-[15px] text-neutral-800 truncate">{it.label}</span>
                      <span className="text-[11px] text-neutral-400 flex-shrink-0">{it.tag}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}

            {action && (
              <div className="flex gap-2 flex-wrap mt-6">
                <button
                  onClick={() => onRun(action.run)}
                  disabled={busy}
                  className="px-5 py-3 bg-blue-500 text-white text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/25 disabled:opacity-40 transition-all"
                >
                  {busy ? 'En cours…' : action.label}
                </button>
                {/* Only while the conversation is still ahead. Once the round
                    is captured, the briefing belongs to the past and the
                    timeline is where you go back to it. */}
                {step.kind === 'capture' && (current?.briefing_questions?.length ?? 0) > 0 && (
                  <button
                    onClick={onOpenBriefing}
                    className="px-5 py-3 bg-white border border-neutral-200 text-neutral-700 text-sm font-medium rounded-xl hover:border-neutral-400 transition-all"
                  >
                    Lire le briefing
                  </button>
                )}
              </div>
            )}
            {error && <p className="text-sm text-rose-600 mt-3">{error}</p>}
          </div>

          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-5 self-start">
            <div className="text-sm font-semibold text-blue-800 mb-2">Pourquoi cet objectif ?</div>
            <p className="text-[15px] text-neutral-600 leading-relaxed">{shortWhy}</p>
            {truncated && (
              <button
                onClick={() => setShowAnalysis(true)}
                className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-3"
              >
                Voir l’analyse →
              </button>
            )}
          </div>
        </div>
      </div>

      {showAnalysis && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-10 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowAnalysis(false)}
        >
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-neutral-100">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">
                  {step.kind === 'capture' ? `L’objectif du round ${current?.round ?? step.round}` : `L’analyse du round ${current?.round ?? step.round}`}
                </h3>
                <p className="text-xs text-neutral-400 mt-0.5">
                  {step.kind === 'capture'
                    ? 'Ce que cette conversation doit résoudre, écrit avec le briefing.'
                    : 'Lecture produite après la conversation, à partir des scores et de ce qui a été dit.'}
                </p>
              </div>
              <button onClick={() => setShowAnalysis(false)} className="text-neutral-400 hover:text-neutral-700 text-xl leading-none px-1">✕</button>
            </div>
            <div className="px-6 py-5">
              {current?.briefing_line && (
                <p className="text-base font-medium text-neutral-800 leading-relaxed mb-4 pb-4 border-b border-neutral-100">
                  {current.briefing_line}
                </p>
              )}
              <p className="text-[15px] text-neutral-700 leading-[1.75] whitespace-pre-wrap">{fullWhy}</p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
