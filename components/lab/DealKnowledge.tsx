'use client'

import { useState } from 'react'
import type { DealRound } from '@/lib/types'
import { criteriaOfLayer } from '@/lib/lab-view'
import type { Declaration } from '@/lib/voice-credit'

const GATE_NAME: Record<number, string> = { 1: 'L’opportunité', 2: 'Gagner', 3: 'L’impact', 4: 'Momentum' }
// Same hue per gate as the cards above, so the eye connects the two.
const GATE_TINT: Record<number, string> = {
  1: 'bg-emerald-50 text-emerald-500',
  2: 'bg-amber-50 text-amber-500',
  3: 'bg-violet-50 text-violet-500',
  4: 'bg-blue-50 text-blue-500',
}
const GATE_ICON: Record<number, string> = { 1: '◎', 2: '◈', 3: '◆', 4: '◇' }

// What we know about this deal, and on whose word — the dashboard's criteria
// reorganised as knowledge rather than as a grid.
//
// It shows only what the engine already stores. The counts at the top are the
// evidence levels, not a new taxonomy: a fact does not exist as an object of
// its own, and inventing a second classification alongside the criteria would
// guarantee the two drift apart.

const ROLE_LABEL: Record<string, string> = {
  decideur: 'Décideur', champion: 'Champion', acheteur_technique: 'Décideur technique',
  gardien_du_budget: 'Gardien du budget', utilisateur: 'Utilisateur', bloqueur: 'Bloqueur',
  unknown: 'Rôle inconnu',
}

const EVIDENCE_PILL: Record<string, string> = {
  declared: 'text-amber-700 bg-amber-100',
  corroborated: 'text-blue-700 bg-blue-100',
  verified: 'text-emerald-700 bg-emerald-100',
}
const EVIDENCE_LABEL: Record<string, string> = {
  declared: 'Déclaré', corroborated: 'Corroboré', verified: 'Chiffré',
}

export default function DealKnowledge({
  round, declarations, onClose,
}: {
  round: DealRound | null
  declarations: Record<string, Declaration[]>
  onClose: () => void
}) {
  const [openLayer, setOpenLayer] = useState<number | null>(1)
  const [query, setQuery] = useState('')

  const layers = [1, 2, 3, 4].map(l => ({ layer: l, criteria: criteriaOfLayer(round, l) }))

  const all = layers.flatMap(l => l.criteria)
  const counts = {
    known: all.filter(c => c.score !== null).length,
    declared: all.filter(c => c.evidence === 'declared').length,
    corroborated: all.filter(c => c.evidence === 'corroborated').length,
    verified: all.filter(c => c.evidence === 'verified').length,
  }
  const contradictions = Object.values(declarations).flat().filter(d => d.stance === 'contre').length

  const matches = (text: string) => !query.trim() || text.toLowerCase().includes(query.toLowerCase())

  return (
    <aside className="hidden xl:flex flex-col w-[380px] flex-shrink-0 border-l border-neutral-200 bg-white min-h-screen">
      <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-neutral-600 uppercase tracking-wide">Connaissance du deal</div>
        <button onClick={onClose} className="text-neutral-300 hover:text-neutral-600 text-sm">✕</button>
      </div>

      <div className="px-5 py-3 border-b border-neutral-100">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher dans la connaissance…"
          className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400 placeholder:text-neutral-300"
        />
      </div>

      <div className="grid grid-cols-4 divide-x divide-neutral-100 border-b border-neutral-100">
        {[
          { n: counts.known, l: 'Notés' },
          { n: counts.declared, l: 'Déclarés' },
          { n: counts.corroborated + counts.verified, l: 'Preuves' },
          { n: contradictions, l: 'Contre' },
        ].map(s => (
          <div key={s.l} className="px-3 py-3 text-center">
            <div className="text-lg font-bold text-neutral-900">{s.n}</div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-wide">{s.l}</div>
          </div>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {layers.map(({ layer, criteria }) => {
          const visible = criteria.filter(c => matches(`${c.label} ${c.rationale ?? ''}`))
          if (query.trim() && visible.length === 0) return null
          const open = query.trim() ? true : openLayer === layer
          const scored = criteria.filter(c => c.score !== null).length
          return (
            <div key={layer} className="border-b border-neutral-100">
              <button
                onClick={() => setOpenLayer(o => o === layer ? null : layer)}
                className="w-full flex items-center justify-between gap-2 px-5 py-3.5 hover:bg-neutral-50/70 transition-colors text-left"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${GATE_TINT[layer]}`}>{GATE_ICON[layer]}</span>
                  <span className="text-sm font-medium text-neutral-800 truncate">{GATE_NAME[layer]}</span>
                </span>
                <span className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-xs text-neutral-400">{scored}/{criteria.length}</span>
                  <span className="text-neutral-300 text-xs">{open ? '▲' : '▼'}</span>
                </span>
              </button>

              {open && (
                <div className="px-5 pb-4 space-y-3">
                  {visible.map(c => (
                    <div key={c.variable} className="border border-neutral-200/80 rounded-xl p-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium text-neutral-800 leading-snug">
                          {c.decisive && <span className="text-amber-500 mr-1" title="Critère décisif">⚡</span>}
                          {c.label}
                        </span>
                        <span className="text-sm font-semibold text-neutral-700 flex-shrink-0">
                          {c.score !== null ? `${c.score.toFixed(1)}` : '—'}
                        </span>
                      </div>

                      {c.evidence && (
                        <span className={`inline-block text-[10px] font-medium px-2 py-0.5 rounded-full mt-1.5 ${EVIDENCE_PILL[c.evidence]}`}>
                          {EVIDENCE_LABEL[c.evidence]}
                        </span>
                      )}

                      {c.rationale && (
                        <p className="text-xs text-neutral-600 leading-relaxed mt-2">{c.rationale}</p>
                      )}

                      {c.declarations.length > 0 && (
                        <ul className="mt-2 space-y-1.5 pt-2 border-t border-neutral-100">
                          {c.declarations.map((d, i) => (
                            <li key={i} className="text-[11px] leading-relaxed">
                              <span className="font-medium text-neutral-700">{d.contact || '?'}</span>
                              <span className="text-neutral-400"> · {ROLE_LABEL[d.role] ?? d.role}</span>
                              {d.stance === 'contre' && <span className="text-rose-600 font-medium"> · contre</span>}
                              {d.quantified && <span className="text-emerald-600 font-medium"> · chiffré</span>}
                              <div className="text-neutral-500 italic">« {d.text} »</div>
                            </li>
                          ))}
                        </ul>
                      )}

                      {c.score === null && !c.rationale && (
                        <p className="text-xs text-neutral-300 mt-1.5">Rien de capturé sur ce critère.</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </aside>
  )
}
