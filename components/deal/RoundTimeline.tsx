'use client'

import { type DealRound } from '@/lib/types'
import { simpleStatus } from '@/lib/scoring'
import { useI18n } from '@/lib/i18n/context'

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
    FRANCHIE: 'bg-emerald-500',
    EN_CONSTRUCTION: 'bg-amber-400',
    A_RISQUE: 'bg-rose-500',
    PRETE: 'bg-blue-500',
    EMPTY: 'bg-neutral-200',
  }[verdict] ?? 'bg-neutral-200'
  return <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${color}`} />
}

function fmt(iso: string) {
  const d = new Date(iso)
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

export default function RoundTimeline({ nodes, currentRound, onSelect, onAddRound, addingRound }: Props) {
  const { t } = useI18n()
  return (
    <div className="flex items-center mb-8 overflow-x-auto pb-1 gap-2">
      {nodes.map((node) => {
        const isSelected = currentRound === node.round
        const verdicts = node.roundData
          ? { 1: simpleStatus(node.roundData, 1), 2: simpleStatus(node.roundData, 2), 3: simpleStatus(node.roundData, 3), 4: simpleStatus(node.roundData, 4) }
          : { 1: 'EMPTY', 2: 'EMPTY', 3: 'EMPTY', 4: 'EMPTY' }
        const label = node.round === 0 ? t('timeline.initial' as never) : `R${node.round}`
        return (
          <button
            key={node.round}
            onClick={() => onSelect(node.round)}
            className={`flex flex-col items-center px-4 py-2.5 rounded-xl transition-all flex-shrink-0 ${
              isSelected
                ? 'bg-blue-500 text-white shadow-md shadow-blue-500/20'
                : 'bg-white text-neutral-500 hover:bg-neutral-100 hover:shadow-sm border border-neutral-200'
            }`}
          >
            <div className={`text-[10px] font-semibold tracking-wide mb-1.5 ${isSelected ? 'text-blue-100' : 'text-neutral-400'}`}>
              {label} · {fmt(node.created_at)}
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map(l => (
                <VerdictDot key={l} verdict={verdicts[l as 1 | 2 | 3 | 4]} />
              ))}
            </div>
          </button>
        )
      })}
      {onAddRound && (
        <button
          onClick={onAddRound}
          disabled={addingRound}
          className="flex flex-col items-center px-4 py-2.5 rounded-xl border-2 border-dashed border-neutral-200 text-neutral-300 hover:border-neutral-400 hover:text-neutral-500 flex-shrink-0 transition-all disabled:opacity-40"
        >
          <div className="text-[10px] font-semibold tracking-wide mb-1.5">
            {addingRound ? 'adding…' : '+ next'}
          </div>
          <div className="flex gap-1">
            {[1, 2, 3, 4].map(l => <span key={l} className="inline-block w-2 h-2 rounded-full border border-neutral-200" />)}
          </div>
        </button>
      )}
    </div>
  )
}
