'use client'

import { getLayerVerdict, type DealRound } from '@/lib/types'

type RoundNode = {
  round: number
  created_at: string
  roundData: DealRound | null
}

type Props = {
  nodes: RoundNode[]
  currentRound: number
  onSelect: (round: number) => void
  onAddRound?: () => void
  addingRound?: boolean
}

function VerdictDot({ verdict }: { verdict: string }) {
  const color = {
    PASS: 'bg-emerald-600',
    HOLD: 'bg-amber-500',
    'AT RISK': 'bg-rose-600',
    EMPTY: 'bg-stone-200',
    EMERGING: 'bg-amber-400',
    NASCENT: 'bg-amber-300',
  }[verdict] ?? 'bg-stone-200'
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function RoundTimeline({ nodes, currentRound, onSelect, onAddRound, addingRound }: Props) {
  return (
    <div className="flex items-center mb-8 overflow-x-auto pb-1">
      {nodes.map((node, i) => {
        const isSelected = currentRound === node.round
        const verdicts = node.roundData
          ? { 1: getLayerVerdict(node.roundData, 1), 2: getLayerVerdict(node.roundData, 2), 3: getLayerVerdict(node.roundData, 3), 4: getLayerVerdict(node.roundData, 4) }
          : { 1: 'EMPTY', 2: 'EMPTY', 3: 'EMPTY', 4: 'EMPTY' }
        const label = node.round === 0 ? 'Initial' : `R${node.round}`
        return (
          <div key={node.round} className="flex items-center flex-shrink-0">
            {i > 0 && <div className="w-8 h-px bg-stone-300" />}
            <button
              onClick={() => onSelect(node.round)}
              className={`flex flex-col items-center px-4 py-2 border transition-colors ${
                isSelected
                  ? 'border-stone-900 bg-stone-900 text-stone-50'
                  : 'border-stone-300 bg-white text-stone-500 hover:border-stone-600 hover:text-stone-900'
              }`}
            >
              <div className="text-[9px] uppercase tracking-widest font-mono mb-1.5">
                {label} · {fmt(node.created_at)}
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4].map(l => (
                  <VerdictDot key={l} verdict={verdicts[l as 1 | 2 | 3 | 4]} />
                ))}
              </div>
            </button>
          </div>
        )
      })}
      <div className="w-8 h-px bg-stone-200 flex-shrink-0" />
      {onAddRound && (
        <button
          onClick={onAddRound}
          disabled={addingRound}
          className="flex flex-col items-center px-4 py-2 border border-dashed border-stone-200 text-stone-300 hover:border-stone-400 hover:text-stone-500 flex-shrink-0 transition-colors disabled:opacity-40"
        >
          <div className="text-[9px] uppercase tracking-widest font-mono mb-1.5">
            {addingRound ? 'adding…' : '+ next'}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(l => <span key={l} className="inline-block w-2 h-2 rounded-full border border-stone-200" />)}
          </div>
        </button>
      )}
    </div>
  )
}
