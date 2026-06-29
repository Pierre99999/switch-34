'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type DealRound, type DealBox, type BoxEntry } from '@/lib/types'

// ── Box definitions (fixed methodology) ─────────────────────

type BoxDef = {
  id: string
  name: string
  description: string
  type: 'collected' | 'prepared' | 'built'
}

const BOXES: BoxDef[] = [
  { id: 'perception',       name: 'Perception',                    type: 'collected', description: 'How the market sees you before meeting you' },
  { id: 'problems',         name: 'Business Problems',             type: 'collected', description: "The prospect's real operational problems" },
  { id: 'stakeholders',     name: 'Real Stakeholders',             type: 'collected', description: 'Who is actually involved in this deal' },
  { id: 'human-pain',       name: 'Human Pain',                    type: 'collected', description: 'What individuals feel personally' },
  { id: 'budget',           name: 'Budget',                        type: 'collected', description: 'Budget existence, size, and approval process' },
  { id: 'product',          name: 'Product & Positioning',         type: 'prepared',  description: 'Your real strengths and why you are different' },
  { id: 'fit',              name: 'Terrain (Concern Fit)',         type: 'prepared',  description: 'Who you are genuinely relevant to' },
  { id: 'necessary-actor',  name: 'Necessary Actor',               type: 'prepared',  description: 'Who you need for the deal to close' },
  { id: 'buy-reason',       name: 'Legitimate Reason to Buy',      type: 'built',     description: 'Why this client should buy — now' },
  { id: 'implementation',   name: 'Implementation',                type: 'built',     description: "How the solution fits into their reality" },
  { id: 'urgency',          name: 'Urgency',                       type: 'built',     description: 'Why now — frequency, intensity, stakes' },
  { id: 'value',            name: 'Value, Solution, Impact',       type: 'built',     description: 'The minimum value that triggers a decision' },
  { id: 'timing',           name: 'Timing',                        type: 'built',     description: 'When a decision must happen' },
  { id: 'forces',           name: 'Decision Forces',               type: 'built',     description: 'Forces that accelerate, slow, or are ambivalent' },
]

const TYPE_STYLE = {
  collected: { badge: 'text-sky-700 border-sky-300 bg-sky-50',        bar: 'border-sky-400',    label: 'collected' },
  prepared:  { badge: 'text-violet-700 border-violet-300 bg-violet-50', bar: 'border-violet-400', label: 'prepared'  },
  built:     { badge: 'text-orange-700 border-orange-300 bg-orange-50', bar: 'border-orange-400', label: 'built'     },
}

const GROUPS = [
  { label: 'Inputs · collected across conversations', types: ['collected'] as const },
  { label: 'Inputs · prepared upfront',               types: ['prepared']  as const },
  { label: 'Outputs · built by synthesis',            types: ['built']     as const },
]

// ── BoxCard ──────────────────────────────────────────────────

function BoxCard({
  box,
  entries,
  onAdd,
  onUpdate,
  onDelete,
  rounds,
}: {
  box: BoxDef
  entries: BoxEntry[]
  onAdd: (text: string, round: number) => Promise<void>
  onUpdate: (index: number, text: string) => Promise<void>
  onDelete: (index: number) => Promise<void>
  rounds: DealRound[]
}) {
  const ts = TYPE_STYLE[box.type]
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [round, setRound] = useState(rounds[rounds.length - 1]?.round ?? 0)
  const [saving, setSaving] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [editSaving, setEditSaving] = useState(false)

  async function submit() {
    if (!text.trim()) return
    setSaving(true)
    await onAdd(text.trim(), round)
    setText('')
    setSaving(false)
    setOpen(false)
  }

  function startEdit(i: number) {
    setEditingIndex(i)
    setEditText(entries[i].text)
  }

  async function submitEdit(i: number) {
    if (!editText.trim()) return
    setEditSaving(true)
    await onUpdate(i, editText.trim())
    setEditingIndex(null)
    setEditSaving(false)
  }

  return (
    <div className={`border p-4 ${entries.length === 0 ? 'border-stone-200 bg-white opacity-60' : 'border-stone-300 bg-stone-50'}`}>
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-serif italic text-stone-900 text-sm leading-snug">{box.name}</h4>
        <span className={`text-[9px] uppercase tracking-widest font-mono border px-1.5 py-0.5 ml-3 flex-shrink-0 ${ts.badge}`}>
          {ts.label}
        </span>
      </div>
      <p className="text-[11px] text-stone-500 mb-3 leading-snug">{box.description}</p>

      {entries.length === 0 ? (
        <div className="text-[10px] font-mono text-stone-400 uppercase tracking-widest mb-3">— empty</div>
      ) : (
        <div className="space-y-2 mb-3">
          {entries.map((entry, i) => (
            <div key={i} className={`border-l-2 pl-3 group ${ts.bar}`}>
              {editingIndex === i ? (
                <div className="space-y-1.5">
                  <textarea
                    value={editText}
                    onChange={e => setEditText(e.target.value)}
                    rows={3}
                    autoFocus
                    className="w-full border border-stone-300 bg-white px-2 py-1.5 text-xs font-mono focus:outline-none resize-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => submitEdit(i)}
                      disabled={editSaving || !editText.trim()}
                      className="px-3 py-1 bg-stone-900 text-stone-50 text-[10px] uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
                    >
                      {editSaving ? 'saving…' : 'save'}
                    </button>
                    <button
                      onClick={() => setEditingIndex(null)}
                      className="px-3 py-1 border border-stone-300 text-stone-500 text-[10px] uppercase tracking-widest font-mono hover:border-stone-600"
                    >
                      cancel
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-[9px] uppercase tracking-widest text-stone-400 font-mono mb-0.5 flex-shrink-0">
                      {entry.round === 0 ? 'Initial' : `R${entry.round}`}
                    </div>
                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => startEdit(i)}
                        className="text-[9px] font-mono text-stone-400 hover:text-stone-700"
                      >
                        edit
                      </button>
                      <button
                        onClick={() => onDelete(i)}
                        className="text-[9px] font-mono text-stone-300 hover:text-rose-700"
                      >
                        remove
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-stone-700 leading-relaxed">{entry.text}</p>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="text-[10px] uppercase tracking-widest font-mono text-stone-400 hover:text-stone-700 border border-dashed border-stone-200 hover:border-stone-400 px-2 py-1"
        >
          + add entry
        </button>
      ) : (
        <div className="mt-2 space-y-2">
          <select
            value={round}
            onChange={e => setRound(Number(e.target.value))}
            className="border border-stone-300 text-xs font-mono px-2 py-1 focus:outline-none w-full"
          >
            {rounds.map(r => (
              <option key={r.round} value={r.round}>
                {r.round === 0 ? 'Initial' : `Round ${r.round}`}
              </option>
            ))}
          </select>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="What do you know about this box?"
            rows={3}
            className="w-full border border-stone-300 bg-white px-2 py-1.5 text-xs font-mono focus:outline-none resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={submit}
              disabled={saving || !text.trim()}
              className="px-3 py-1 bg-stone-900 text-stone-50 text-[10px] uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
            >
              {saving ? 'saving…' : 'add'}
            </button>
            <button
              onClick={() => { setOpen(false); setText('') }}
              className="px-3 py-1 border border-stone-300 text-stone-500 text-[10px] uppercase tracking-widest font-mono hover:border-stone-600"
            >
              cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function BoxesPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [boxData, setBoxData] = useState<Record<string, BoxEntry[]>>({})
  const [fillingPrepared, setFillingPrepared] = useState(false)
  const [preparedError, setPreparedError] = useState<string | null>(null)
  const [updatingBoxes, setUpdatingBoxes] = useState(false)
  const [updateBoxesError, setUpdateBoxesError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: roundData }, { data: dbBoxes }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_rounds').select('*').eq('deal_id', dealId).order('round', { ascending: true }),
      supabase.from('deal_boxes').select('*').eq('deal_id', dealId),
    ])
    if (dealData) setDeal(dealData)
    if (roundData) setRounds(roundData)
    if (dbBoxes) {
      const map: Record<string, BoxEntry[]> = {}
      for (const row of dbBoxes as DealBox[]) {
        map[row.box_id] = row.entries ?? []
      }
      setBoxData(map)
    }
  }, [dealId])

  useEffect(() => { load() }, [load])

  async function handleFillPrepared() {
    setFillingPrepared(true)
    setPreparedError(null)
    try {
      const res = await fetch('/api/ai/fill-prepared-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      await load()
    } catch (e) {
      setPreparedError(e instanceof Error ? e.message : 'Failed')
    }
    setFillingPrepared(false)
  }

  async function handleUpdateBoxes() {
    if (!deal) return
    setUpdatingBoxes(true)
    setUpdateBoxesError(null)
    // Use the last round that has capture notes or scores; fall back to latest round
    const bestRound = [...rounds].reverse().find(r => {
      const notes = r.capture_notes as Record<string, string> | null
      const hasNotes = notes && Object.values(notes).some(v => v?.trim())
      const hasScores = Object.values(r).some(v => typeof v === 'number' && v > 0)
      return hasNotes || hasScores
    }) ?? rounds[rounds.length - 1]
    if (!bestRound) { setUpdatingBoxes(false); return }
    const currentRound = bestRound
    try {
      const res = await fetch('/api/ai/update-boxes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, roundId: currentRound.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'AI error')
      await load()
    } catch (e) {
      setUpdateBoxesError(e instanceof Error ? e.message : 'Failed')
    }
    setUpdatingBoxes(false)
  }

  async function saveEntries(boxId: string, entries: BoxEntry[]) {
    const supabase = createClient()
    const { error } = await supabase
      .from('deal_boxes')
      .upsert({ deal_id: dealId, box_id: boxId, entries }, { onConflict: 'deal_id,box_id' })
    if (!error) await load()
  }

  async function handleAddEntry(boxId: string, text: string, round: number) {
    const existing = boxData[boxId] ?? []
    await saveEntries(boxId, [...existing, { round, text }])
  }

  async function handleUpdateEntry(boxId: string, index: number, text: string) {
    const existing = [...(boxData[boxId] ?? [])]
    existing[index] = { ...existing[index], text }
    await saveEntries(boxId, existing)
  }

  async function handleDeleteEntry(boxId: string, index: number) {
    const existing = boxData[boxId] ?? []
    await saveEntries(boxId, existing.filter((_, i) => i !== index))
  }

  if (!deal) {
    return <div className="max-w-6xl mx-auto py-12 px-6 text-xs font-mono text-stone-400">Loading…</div>
  }

  const totalFilled = BOXES.filter(b => (boxData[b.id] ?? []).length > 0).length

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-6 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            <button onClick={() => router.push('/pipeline')} className="hover:text-stone-900 mr-2">← pipeline</button>
            ScoreJam · knowledge boxes
          </div>
          <h1 className="font-serif text-2xl text-stone-900 italic mt-1">Knowledge boxes</h1>
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{deal.prospect_name}</div>
          <div className="font-mono text-lg text-stone-900 mt-0.5">{totalFilled}/{BOXES.length} filled</div>
        </div>
      </div>

      {/* Method blurb */}
      <div className="border-l-2 border-stone-900 pl-4 py-2 mb-10 bg-stone-50">
        <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-1">method</div>
        <p className="text-sm text-stone-800 font-serif italic leading-relaxed">
          Inputs are collected across conversations, in any order. Outputs are not found — they are built by crossing everything else together. The puzzle fills conversation by conversation.
        </p>
      </div>

      {/* Groups */}
      {GROUPS.map(group => {
        const boxes = BOXES.filter(b => (group.types as readonly string[]).includes(b.type))
        const filledCount = boxes.filter(b => (boxData[b.id] ?? []).length > 0).length
        return (
          <section key={group.label} className="mb-12">
            <div className="flex items-center justify-between border-b border-stone-300 pb-2 mb-5">
              <div className="text-[10px] uppercase tracking-widest text-stone-600 font-mono">{group.label}</div>
              <div className="flex items-center gap-3">
                {(group.types[0] === 'collected' || group.types[0] === 'built') && (
                  <>
                    {updateBoxesError && (
                      <span className="text-[10px] font-mono text-rose-700">{updateBoxesError}</span>
                    )}
                    <button
                      onClick={handleUpdateBoxes}
                      disabled={updatingBoxes}
                      className="px-3 py-1 border border-stone-500 text-stone-600 text-[10px] uppercase tracking-widest font-mono hover:bg-stone-100 disabled:opacity-40"
                    >
                      {updatingBoxes ? 'updating…' : '✦ update from capture'}
                    </button>
                  </>
                )}
                {group.types[0] === 'prepared' && (
                  <>
                    {preparedError && <span className="text-[10px] font-mono text-rose-700">{preparedError}</span>}
                    <button
                      onClick={handleFillPrepared}
                      disabled={fillingPrepared}
                      className="px-3 py-1 border border-stone-500 text-stone-600 text-[10px] uppercase tracking-widest font-mono hover:bg-stone-100 disabled:opacity-40"
                    >
                      {fillingPrepared ? 'generating…' : '✦ fill from profile'}
                    </button>
                  </>
                )}
                <div className="text-[10px] uppercase tracking-widest text-stone-400 font-mono">{filledCount}/{boxes.length} filled</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {boxes.map(box => (
                <BoxCard
                  key={box.id}
                  box={box}
                  entries={boxData[box.id] ?? []}
                  rounds={rounds}
                  onAdd={(text, round) => handleAddEntry(box.id, text, round)}
                  onUpdate={(index, text) => handleUpdateEntry(box.id, index, text)}
                  onDelete={(index) => handleDeleteEntry(box.id, index)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
