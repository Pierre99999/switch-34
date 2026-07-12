'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { type Deal, type DealRound, type DealBox, type BoxEntry } from '@/lib/types'

// ── Zone definitions (fixed methodology) ─────────────────────

type ZoneDef = {
  id: string
  nameKey: string
  descKey: string
  type: 'collected' | 'prepared' | 'built'
}

const ZONES: ZoneDef[] = [
  { id: 'perception',       nameKey: 'zones.perception',       descKey: 'zones.perceptionDesc',       type: 'collected' },
  { id: 'problems',         nameKey: 'zones.problems',         descKey: 'zones.problemsDesc',         type: 'collected' },
  { id: 'stakeholders',     nameKey: 'zones.stakeholders',     descKey: 'zones.stakeholdersDesc',     type: 'collected' },
  { id: 'human-pain',       nameKey: 'zones.humanPain',        descKey: 'zones.humanPainDesc',        type: 'collected' },
  { id: 'budget',           nameKey: 'zones.budget',           descKey: 'zones.budgetDesc',           type: 'collected' },
  { id: 'product',          nameKey: 'zones.product',          descKey: 'zones.productDesc',          type: 'prepared' },
  { id: 'fit',              nameKey: 'zones.fit',              descKey: 'zones.fitDesc',              type: 'prepared' },
  { id: 'necessary-actor',  nameKey: 'zones.necessaryActor',   descKey: 'zones.necessaryActorDesc',   type: 'prepared' },
  { id: 'buy-reason',       nameKey: 'zones.buyReason',        descKey: 'zones.buyReasonDesc',        type: 'built' },
  { id: 'implementation',   nameKey: 'zones.implementation',   descKey: 'zones.implementationDesc',   type: 'built' },
  { id: 'urgency',          nameKey: 'zones.urgency',          descKey: 'zones.urgencyDesc',          type: 'built' },
  { id: 'value',            nameKey: 'zones.value',            descKey: 'zones.valueDesc',            type: 'built' },
  { id: 'timing',           nameKey: 'zones.timing',           descKey: 'zones.timingDesc',           type: 'built' },
  { id: 'forces',           nameKey: 'zones.forces',           descKey: 'zones.forcesDesc',           type: 'built' },
]

const TYPE_LABEL_KEY: Record<string, string> = {
  collected: 'zones.collected',
  prepared: 'zones.prepared',
  built: 'zones.built',
}

const TYPE_STYLE = {
  collected: { badge: 'bg-sky-50 text-sky-600 border-sky-200',        bar: 'border-l-sky-400' },
  prepared:  { badge: 'bg-violet-50 text-violet-600 border-violet-200', bar: 'border-l-violet-400' },
  built:     { badge: 'bg-orange-50 text-orange-600 border-orange-200', bar: 'border-l-orange-400' },
}

const GROUP_LABEL_KEY: Record<string, string> = {
  collected: 'zones.groupCollected',
  prepared: 'zones.groupPrepared',
  built: 'zones.groupBuilt',
}

const GROUPS = [
  { key: 'collected', types: ['collected'] as const },
  { key: 'prepared',  types: ['prepared']  as const },
  { key: 'built',     types: ['built']     as const },
]

const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"

// ── ZoneCard ──────────────────────────────────────────────────

function ZoneCard({
  zone,
  entries,
  onAdd,
  onUpdate,
  onDelete,
  rounds,
}: {
  zone: ZoneDef
  entries: BoxEntry[]
  onAdd: (text: string, round: number) => Promise<void>
  onUpdate: (index: number, text: string) => Promise<void>
  onDelete: (index: number) => Promise<void>
  rounds: DealRound[]
}) {
  const { t } = useI18n()
  const ts = TYPE_STYLE[zone.type]
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
    <div className={`bg-white rounded-2xl border overflow-hidden shadow-sm ${entries.length === 0 ? 'border-neutral-200 opacity-60' : 'border-neutral-200'}`}>
      <div className="px-5 py-4">
        <div className="flex items-start justify-between mb-1.5">
          <h4 className="text-sm font-semibold text-neutral-800 leading-snug">{t(zone.nameKey as any)}</h4>
          <span className={`text-[10px] font-medium border rounded-full px-2 py-0.5 ml-3 flex-shrink-0 ${ts.badge}`}>
            {t(TYPE_LABEL_KEY[zone.type] as any)}
          </span>
        </div>
        <p className="text-xs text-neutral-400 mb-3 leading-snug">{t(zone.descKey as any)}</p>

        {entries.length === 0 ? (
          <div className="text-xs text-neutral-300 mb-3">{t('zones.empty')}</div>
        ) : (
          <div className="space-y-2 mb-3">
            {entries.map((entry, i) => (
              <div key={i} className={`border-l-2 pl-3 group ${ts.bar}`}>
                {editingIndex === i ? (
                  <div className="space-y-2">
                    <textarea
                      value={editText}
                      onChange={e => setEditText(e.target.value)}
                      rows={3}
                      autoFocus
                      className={inputClass}
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitEdit(i)}
                        disabled={editSaving || !editText.trim()}
                        className="px-4 py-2 bg-blue-500 text-white text-xs font-medium rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-all"
                      >
                        {editSaving ? t('zones.saving') : t('zones.save')}
                      </button>
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="px-4 py-2 bg-white border border-neutral-200 text-neutral-500 text-xs font-medium rounded-xl hover:border-neutral-400 transition-all"
                      >
                        {t('common.cancel')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-medium text-neutral-400 bg-neutral-100 rounded px-1.5 py-0.5">
                        {entry.round === 0 ? t('zones.initial') : `R${entry.round}`}
                      </span>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <button onClick={() => startEdit(i)} className="text-xs text-neutral-400 hover:text-blue-500 transition-colors">{t('zones.edit')}</button>
                        <button onClick={() => onDelete(i)} className="text-xs text-neutral-300 hover:text-rose-500 transition-colors">{t('zones.remove')}</button>
                      </div>
                    </div>
                    <p className="text-sm text-neutral-600 leading-relaxed mt-1">{entry.text}</p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        {!open ? (
          <button
            onClick={() => setOpen(true)}
            className="text-xs text-neutral-400 hover:text-blue-500 border border-dashed border-neutral-200 hover:border-blue-300 rounded-xl px-3 py-1.5 transition-all"
          >
            {t('zones.addEntry')}
          </button>
        ) : (
          <div className="mt-2 space-y-2">
            <select
              value={round}
              onChange={e => setRound(Number(e.target.value))}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all"
            >
              {rounds.map(r => (
                <option key={r.round} value={r.round}>
                  {r.round === 0 ? t('zones.initial') : `${t('zones.round')} ${r.round}`}
                </option>
              ))}
            </select>
            <textarea
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder={t('zones.whatDoYouKnow')}
              rows={3}
              className={inputClass}
            />
            <div className="flex gap-2">
              <button
                onClick={submit}
                disabled={saving || !text.trim()}
                className="px-4 py-2 bg-blue-500 text-white text-xs font-medium rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-all"
              >
                {saving ? t('zones.saving') : t('zones.add')}
              </button>
              <button
                onClick={() => { setOpen(false); setText('') }}
                className="px-4 py-2 bg-white border border-neutral-200 text-neutral-500 text-xs font-medium rounded-xl hover:border-neutral-400 transition-all"
              >
                {t('common.cancel')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────

export default function ZonesPage() {
  const params = useParams()
  const router = useRouter()
  const { t } = useI18n()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [rounds, setRounds] = useState<DealRound[]>([])
  const [boxData, setBoxData] = useState<Record<string, BoxEntry[]>>({})

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
    return <div className="max-w-6xl mx-auto py-12 px-6 text-sm text-neutral-400">{t('common.loading')}</div>
  }

  const totalFilled = ZONES.filter(b => (boxData[b.id] ?? []).length > 0).length

  return (
    <div className="max-w-6xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <button onClick={() => router.push('/pipeline')} className="text-sm text-neutral-400 hover:text-blue-500 transition-colors mb-1 block">
            {t('capture.backToPipeline')}
          </button>
          <h1 className="text-2xl font-bold text-neutral-900">{t('zones.title')}</h1>
        </div>
        <div className="text-right">
          <div className="text-xs font-medium text-neutral-400 mb-1">{deal.prospect_name}</div>
          <div className="text-lg font-bold text-neutral-900">{totalFilled}/{ZONES.length} {t('zones.filled')}</div>
        </div>
      </div>

      {/* Method info */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 mb-8">
        <p className="text-sm text-blue-700">
          {t('zones.methodInfo')}
        </p>
      </div>

      {/* Groups */}
      {GROUPS.map(group => {
        const zones = ZONES.filter(b => (group.types as readonly string[]).includes(b.type))
        const filledCount = zones.filter(b => (boxData[b.id] ?? []).length > 0).length
        return (
          <section key={group.key} className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wide">{t(GROUP_LABEL_KEY[group.key] as any)}</h2>
              <span className="text-xs font-medium text-neutral-400 bg-neutral-100 rounded-full px-3 py-1">{filledCount}/{zones.length}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {zones.map(zone => (
                <ZoneCard
                  key={zone.id}
                  zone={zone}
                  entries={boxData[zone.id] ?? []}
                  rounds={rounds}
                  onAdd={(text, round) => handleAddEntry(zone.id, text, round)}
                  onUpdate={(index, text) => handleUpdateEntry(zone.id, index, text)}
                  onDelete={(index) => handleDeleteEntry(zone.id, index)}
                />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}
