'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PortfolioPosition } from '@/lib/mission-control'
import { layoutBubbles, type Seed } from '@/lib/bubble-layout'

// The portfolio on two axes: the passage of the three gates, against momentum.
//
// The abscissa is graduated in gates, not in a percentage: a deal sits in the
// band of the gate it is working on, and crossing a graduation means that gate
// is carried. « 62 % du chemin » says nothing a seller can act on; « porte 2,
// momentum 2,1 » says which conversation to have.
//
// Small dots rather than large bubbles, and a relaxation pass so no deal hides
// another. A map where a bubble covers a bubble is worse than a list: it does
// not merely omit a deal, it makes you believe you have seen all of them. The
// relaxation is walled inside each band — room is never worth showing a deal
// one gate further than it is.
//
// The dot carries no number. The score out of five is in the tooltip and on
// the deal; a percentage of signature is nowhere, because nothing in the
// method computes one.

const RISK = {
  low: { fill: '#34d399', ring: '#059669' },
  medium: { fill: '#fbbf24', ring: '#d97706' },
  high: { fill: '#fb7185', ring: '#e11d48' },
}

const GATES = [
  { n: 1, name: 'L’opportunité' },
  { n: 2, name: 'La capacité à gagner' },
  { n: 3, name: 'L’impact' },
]

const W = 1000
const H = 470
const PAD = { left: 56, right: 28, top: 42, bottom: 64 }

/** What the abscissa says of a deal, in words, for the tooltip. */
function gatePhrase(p: PortfolioPosition): string {
  if (p.activeGate > 3) return 'Les trois portes franchies'
  const carried = p.activeGate - 1
  if (carried === 0) return 'Porte 1 en cours'
  return `Porte ${p.activeGate} en cours · ${carried} franchie${carried > 1 ? 's' : ''}`
}

export default function PortfolioMap({ positions }: { positions: PortfolioPosition[] }) {
  const router = useRouter()
  const [hover, setHover] = useState<string | null>(null)

  const plotW = W - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const bandW = plotW / 3
  /** Gate units (0 → 3) to pixels. */
  const gx = (u: number) => PAD.left + (u / 3) * plotW

  const placed = useMemo(() => {
    const maxRevenue = Math.max(...positions.map(p => p.revenue ?? 0), 1)
    const seeds: Seed[] = positions.map(p => {
      // The band of the gate being worked on — the last one once all are
      // carried, where advancement pins the deal to the right edge anyway.
      const band = Math.min(p.activeGate, 3) - 1
      return {
        id: p.dealId,
        x: PAD.left + p.advancement * plotW,
        y: PAD.top + plotH - ((p.momentum ?? 0) / 5) * plotH,
        // Between 9 and 19: big enough to click, small enough to stay a dot.
        r: 9 + Math.sqrt((p.revenue ?? 0) / maxRevenue) * 10,
        xMin: PAD.left + band * bandW,
        xMax: PAD.left + (band + 1) * bandW,
      }
    })
    return layoutBubbles(seeds, {
      minX: PAD.left, maxX: W - PAD.right, minY: PAD.top, maxY: PAD.top + plotH,
    })
  }, [positions, plotW, plotH, bandW])

  const byId = useMemo(
    () => Object.fromEntries(positions.map(p => [p.dealId, p])),
    [positions],
  )

  if (positions.length === 0) return null
  const hovered = hover ? byId[hover] : null
  const hoveredDot = hover ? placed.find(p => p.id === hover) : null
  const axisY = PAD.top + plotH

  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[560px]" role="img"
        aria-label="Carte du portefeuille : les portes 1, 2 et 3 en abscisse, le momentum en ordonnée">
        {/* The middle gate, tinted, so the three bands read without counting. */}
        <rect x={gx(1)} y={PAD.top} width={bandW} height={plotH} fill="#fafafa" />

        <line x1={PAD.left} y1={PAD.top + plotH / 2} x2={W - PAD.right} y2={PAD.top + plotH / 2}
          stroke="#e5e5e5" strokeDasharray="4 6" />
        {[1, 2].map(u => (
          <line key={u} x1={gx(u)} y1={PAD.top} x2={gx(u)} y2={axisY} stroke="#e5e5e5" strokeDasharray="4 6" />
        ))}
        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={axisY} stroke="#d4d4d4" />
        <line x1={PAD.left} y1={axisY} x2={W - PAD.right} y2={axisY} stroke="#d4d4d4" />

        {/* Ordinate: momentum, 0 to 5. */}
        <text x={PAD.left - 10} y={PAD.top + 10} textAnchor="end" fill="#a3a3a3" fontSize="13">5</text>
        <text x={PAD.left - 10} y={PAD.top + plotH / 2 + 4} textAnchor="end" fill="#d4d4d4" fontSize="12">2,5</text>
        <text x={PAD.left - 10} y={axisY} textAnchor="end" fill="#a3a3a3" fontSize="13">0</text>
        <text x={16} y={PAD.top + plotH / 2} fill="#a3a3a3" fontSize="13" textAnchor="middle"
          transform={`rotate(-90 16 ${PAD.top + plotH / 2})`}>Momentum</text>

        {/* Abscissa: the three gates. The band names sit above the plot, the
            graduations under it — a dot before a graduation has not carried it. */}
        {GATES.map(g => (
          <text key={g.n} x={gx(g.n - 0.5)} y={PAD.top - 14} textAnchor="middle" fill="#a3a3a3" fontSize="12">
            <tspan fontWeight={700} fill="#737373">{g.n}</tspan>
            <tspan> · {g.name}</tspan>
          </text>
        ))}
        {/* No graduation at the origin: « Début » says it, and a deal with no
            momentum sits there, where a number would collide with its name. */}
        {[1, 2, 3].map(u => (
          <text key={u} x={gx(u)} y={axisY + 24} textAnchor="middle" fill="#a3a3a3" fontSize="13" fontWeight={600}>
            {u}
          </text>
        ))}
        <text x={PAD.left} y={H - 14} fill="#d4d4d4" fontSize="12">Début</text>
        <text x={PAD.left + plotW / 2} y={H - 14} textAnchor="middle" fill="#a3a3a3" fontSize="13">
          Portes franchies
        </text>
        <text x={W - PAD.right} y={H - 14} textAnchor="end" fill="#d4d4d4" fontSize="12">Signature</text>

        {placed.map(dot => {
          const p = byId[dot.id]
          if (!p) return null
          const tone = RISK[p.risk]
          const active = hover === dot.id
          const short = p.prospect.length > 12 ? `${p.prospect.slice(0, 11)}…` : p.prospect
          return (
            <g
              key={dot.id}
              className="cursor-pointer"
              onClick={() => router.push(`/lab/deals/${dot.id}`)}
              onMouseEnter={() => setHover(dot.id)}
              onMouseLeave={() => setHover(h => (h === dot.id ? null : h))}
            >
              <circle
                cx={dot.x} cy={dot.y} r={dot.r}
                fill={tone.fill} stroke={active ? tone.ring : '#ffffff'} strokeWidth={active ? 3 : 2}
                opacity={active ? 1 : 0.9}
              />
              {p.alert && <circle cx={dot.x + dot.r * 0.75} cy={dot.y - dot.r * 0.75} r={4.5} fill="#e11d48" stroke="#fff" strokeWidth={1.5} />}
              <text x={dot.x} y={dot.y + dot.r + 15} textAnchor="middle" fontSize="12"
                fill={active ? '#171717' : '#737373'} fontWeight={active ? 700 : 500}>
                {short}
              </text>
            </g>
          )
        })}
      </svg>

      {/* The detail on hover: what a dot cannot carry without becoming a label. */}
      {hovered && hoveredDot && (
        <div
          className="pointer-events-none absolute z-10 bg-white border border-neutral-200 rounded-xl shadow-lg px-3.5 py-2.5 text-xs"
          style={{
            left: `${(hoveredDot.x / W) * 100}%`,
            top: `${(hoveredDot.y / H) * 100}%`,
            transform: 'translate(-50%, -130%)',
            minWidth: 160,
          }}
        >
          <div className="font-semibold text-neutral-900">{hovered.prospect}</div>
          <div className="text-neutral-500 mt-0.5">
            {hovered.score !== null ? `${hovered.score.toFixed(1)}/5` : 'Rien de noté'}
            {hovered.revenue ? ` · ${hovered.revenue >= 1000 ? `${Math.round(hovered.revenue / 1000)}k€` : `${hovered.revenue}€`}` : ''}
          </div>
          <div className="text-neutral-400">
            {gatePhrase(hovered)}
          </div>
          <div className="text-neutral-400">
            Momentum {hovered.momentum !== null ? hovered.momentum.toFixed(1).replace('.', ',') : '—'}
          </div>
        </div>
      )}
    </div>
  )
}
