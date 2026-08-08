'use client'

import Link from 'next/link'
import type { PortfolioPosition } from '@/lib/mission-control'

// The portfolio on two axes: how far the gates are carried, against momentum.
//
// The bubble carries the deal's score out of five, not a probability of
// signature. A percentage would be the most reassuring number on the screen
// and the only one nothing in the engine can produce — the diagnostic says
// what is established, never how likely a signature is.

const RISK = {
  low: { fill: 'fill-emerald-100', stroke: 'stroke-emerald-300', text: 'text-emerald-800' },
  medium: { fill: 'fill-amber-100', stroke: 'stroke-amber-300', text: 'text-amber-800' },
  high: { fill: 'fill-rose-100', stroke: 'stroke-rose-300', text: 'text-rose-800' },
}

const W = 1000
const H = 460
const PAD = { left: 54, right: 24, top: 22, bottom: 46 }

export default function PortfolioMap({ positions }: { positions: PortfolioPosition[] }) {
  if (positions.length === 0) return null

  const maxRevenue = Math.max(...positions.map(p => p.revenue ?? 0), 1)
  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom

  // Radius by revenue, floored so a small deal stays clickable and capped so a
  // large one does not swallow the map.
  const radius = (revenue: number | null) => {
    const share = Math.sqrt((revenue ?? 0) / maxRevenue)
    return 26 + share * 34
  }

  const x = (p: PortfolioPosition) => PAD.left + p.advancement * plotW
  const y = (p: PortfolioPosition) => PAD.top + plotH - ((p.momentum ?? 0) / 5) * plotH

  return (
    <div className="overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Carte du portefeuille">
        {/* Quadrants, drawn faintly: the map is read by position, not by grid. */}
        <line x1={PAD.left} y1={PAD.top + plotH / 2} x2={W - PAD.right} y2={PAD.top + plotH / 2}
          className="stroke-neutral-200" strokeDasharray="4 6" />
        <line x1={PAD.left + plotW / 2} y1={PAD.top} x2={PAD.left + plotW / 2} y2={PAD.top + plotH}
          className="stroke-neutral-200" strokeDasharray="4 6" />

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + plotH} className="stroke-neutral-300" />
        <line x1={PAD.left} y1={PAD.top + plotH} x2={W - PAD.right} y2={PAD.top + plotH} className="stroke-neutral-300" />

        <text x={PAD.left - 8} y={PAD.top + 10} textAnchor="end" className="fill-neutral-400 text-[13px]">5</text>
        <text x={PAD.left - 8} y={PAD.top + plotH} textAnchor="end" className="fill-neutral-400 text-[13px]">0</text>
        <text x={12} y={PAD.top + plotH / 2} className="fill-neutral-400 text-[13px]"
          transform={`rotate(-90 12 ${PAD.top + plotH / 2})`} textAnchor="middle">Momentum</text>
        <text x={PAD.left} y={H - 12} className="fill-neutral-400 text-[13px]">Début</text>
        <text x={W - PAD.right} y={H - 12} textAnchor="end" className="fill-neutral-400 text-[13px]">Signature</text>
        <text x={PAD.left + plotW / 2} y={H - 12} textAnchor="middle" className="fill-neutral-400 text-[13px]">
          Portes franchies
        </text>

        {positions.map(p => {
          const r = radius(p.revenue)
          const tone = RISK[p.risk]
          return (
            <Link key={p.dealId} href={`/lab/deals/${p.dealId}`}>
              <g className="cursor-pointer">
                <circle cx={x(p)} cy={y(p)} r={r} className={`${tone.fill} ${tone.stroke}`} strokeWidth={1.5} />
                <text x={x(p)} y={y(p) - 6} textAnchor="middle" className="fill-neutral-900 text-[13px] font-bold">
                  {p.prospect.length > 14 ? `${p.prospect.slice(0, 13)}…` : p.prospect}
                </text>
                <text x={x(p)} y={y(p) + 11} textAnchor="middle" className="fill-neutral-700 text-[13px] font-semibold">
                  {p.score !== null ? `${p.score.toFixed(1)}/5` : '—'}
                </text>
                {p.revenue ? (
                  <text x={x(p)} y={y(p) + 26} textAnchor="middle" className="fill-neutral-500 text-[11px]">
                    {p.revenue >= 1000 ? `${Math.round(p.revenue / 1000)}k€` : `${p.revenue}€`}
                  </text>
                ) : null}
                {p.alert && (
                  <circle cx={x(p) + r * 0.72} cy={y(p) - r * 0.72} r={9} className="fill-rose-500" />
                )}
              </g>
            </Link>
          )
        })}
      </svg>
    </div>
  )
}
