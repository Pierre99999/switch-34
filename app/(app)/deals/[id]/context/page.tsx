'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { type Deal, type Stakeholder } from '@/lib/types'

function SectionHeader({ label, subtitle }: { label: string; subtitle?: string }) {
  return (
    <div className="flex items-baseline justify-between border-b border-stone-300 pb-2 mb-4">
      <h3 className="font-serif text-lg text-stone-900 italic">{label}</h3>
      {subtitle && <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{subtitle}</div>}
    </div>
  )
}

const ACTOR_LABELS: Record<string, string> = {
  champion: 'Champion',
  decision_maker: 'Decision Maker',
  user: 'End User',
  reviewer: 'Reviewer',
  blocker: 'Blocker',
  unknown: 'Unknown',
}

export default function AccountContextPage() {
  const params = useParams()
  const router = useRouter()
  const dealId = params.id as string

  const [deal, setDeal] = useState<Deal | null>(null)
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Editable deal context fields
  const [prospectUrl, setProspectUrl] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactTitle, setContactTitle] = useState('')
  const [contactLinkedin, setContactLinkedin] = useState('')

  // New stakeholder form
  const [newStk, setNewStk] = useState({ name: '', role: '', actor_type: 'unknown' as Stakeholder['actor_type'], notes: '' })
  const [addingStk, setAddingStk] = useState(false)
  const [stkError, setStkError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const supabase = createClient()
    const [{ data: dealData }, { data: stkData }] = await Promise.all([
      supabase.from('deals').select('*').eq('id', dealId).single(),
      supabase.from('deal_stakeholders').select('*').eq('deal_id', dealId).order('created_at', { ascending: true }),
    ])
    if (dealData) {
      setDeal(dealData)
      setProspectUrl(dealData.prospect_url ?? '')
      setContactName(dealData.contact_name ?? '')
      setContactTitle(dealData.contact_title ?? '')
      setContactLinkedin(dealData.contact_linkedin ?? '')
    }
    if (stkData) setStakeholders(stkData)
  }, [dealId])

  useEffect(() => { load() }, [load])

  async function handleSaveDeal() {
    if (!deal) return
    setSaving(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase
      .from('deals')
      .update({ prospect_url: prospectUrl, contact_name: contactName, contact_title: contactTitle, contact_linkedin: contactLinkedin })
      .eq('id', dealId)
    if (error) setError(error.message)
    else await load()
    setSaving(false)
  }

  async function handleAddStakeholder() {
    if (!newStk.name) return
    setAddingStk(true)
    setStkError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('deal_stakeholders').insert({
      deal_id: dealId,
      name: newStk.name,
      role: newStk.role || null,
      actor_type: newStk.actor_type,
      notes: newStk.notes || null,
    })
    if (error) { setStkError(error.message); setAddingStk(false); return }
    setNewStk({ name: '', role: '', actor_type: 'unknown', notes: '' })
    await load()
    setAddingStk(false)
  }

  async function handleDeleteStakeholder(id: string) {
    const supabase = createClient()
    await supabase.from('deal_stakeholders').delete().eq('id', id)
    await load()
  }

  if (!deal) {
    return <div className="max-w-4xl mx-auto py-12 px-6 text-xs font-mono text-stone-400">Loading…</div>
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      {/* Header */}
      <div className="flex items-baseline justify-between pb-4 mb-8 border-b border-stone-300">
        <div>
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono">
            <button onClick={() => router.push('/pipeline')} className="hover:text-stone-900 mr-2">← pipeline</button>
            {deal.prospect_name}
          </div>
          <h2 className="font-serif text-xl text-stone-900 italic mt-1">Account context</h2>
        </div>
      </div>

      {/* Prospect company */}
      <section className="mb-10">
        <SectionHeader label="Prospect company" />
        <div className="space-y-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Company name</label>
            <div className="mt-1 border border-stone-200 bg-stone-50 px-3 py-2 text-sm font-mono text-stone-700">
              {deal.prospect_name}
              <span className="text-stone-400 ml-2">· set at deal creation</span>
            </div>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Website</label>
            <input
              value={prospectUrl}
              onChange={e => setProspectUrl(e.target.value)}
              placeholder="acme.com"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
        </div>
      </section>

      {/* Key contact */}
      <section className="mb-10">
        <SectionHeader label="Key contact" />
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Name</label>
            <input
              value={contactName}
              onChange={e => setContactName(e.target.value)}
              placeholder="Sarah Chen"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Title</label>
            <input
              value={contactTitle}
              onChange={e => setContactTitle(e.target.value)}
              placeholder="VP Operations"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div className="col-span-2">
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">LinkedIn URL</label>
            <input
              value={contactLinkedin}
              onChange={e => setContactLinkedin(e.target.value)}
              placeholder="linkedin.com/in/sarah-chen"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={handleSaveDeal}
            disabled={saving}
            className="px-4 py-2 bg-stone-900 text-stone-50 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {saving ? 'saving…' : 'save'}
          </button>
          {error && <span className="text-xs font-mono text-rose-700">{error}</span>}
        </div>
      </section>

      {/* Stakeholder ecosystem */}
      <section className="mb-10">
        <SectionHeader label="Stakeholder ecosystem" subtitle={`${stakeholders.length} identified`} />

        {stakeholders.length === 0 && (
          <p className="text-xs text-stone-400 font-mono mb-4">No stakeholders added yet.</p>
        )}

        <div className="space-y-3 mb-6">
          {stakeholders.map(s => (
            <div key={s.id} className="border-l border-stone-300 pl-4 group">
              <div className="flex items-baseline justify-between">
                <h5 className="font-serif italic text-stone-900">{s.name}</h5>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{ACTOR_LABELS[s.actor_type]}</span>
                  {s.role && <span className="text-[10px] text-stone-400 font-mono">{s.role}</span>}
                  <button
                    onClick={() => handleDeleteStakeholder(s.id)}
                    className="text-[10px] font-mono text-stone-300 hover:text-rose-700 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    remove
                  </button>
                </div>
              </div>
              {s.notes && <p className="text-xs text-stone-700 mt-1 leading-relaxed">{s.notes}</p>}
            </div>
          ))}
        </div>

        {/* Add stakeholder */}
        <div className="border border-dashed border-stone-300 p-4">
          <div className="text-[10px] uppercase tracking-widest text-stone-500 font-mono mb-3">Add stakeholder</div>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <input
              value={newStk.name}
              onChange={e => setNewStk(n => ({ ...n, name: e.target.value }))}
              placeholder="Name"
              className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900"
            />
            <input
              value={newStk.role}
              onChange={e => setNewStk(n => ({ ...n, role: e.target.value }))}
              placeholder="Title / Role"
              className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900"
            />
          </div>
          <div className="mb-3">
            <select
              value={newStk.actor_type}
              onChange={e => setNewStk(n => ({ ...n, actor_type: e.target.value as Stakeholder['actor_type'] }))}
              className="border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900 w-full"
            >
              {Object.entries(ACTOR_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <textarea
            value={newStk.notes}
            onChange={e => setNewStk(n => ({ ...n, notes: e.target.value }))}
            placeholder="Notes — what do you know about this person's position, motivations, influence?"
            rows={2}
            className="w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono focus:outline-none focus:border-stone-900 resize-none mb-3"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={handleAddStakeholder}
              disabled={addingStk || !newStk.name}
              className="px-4 py-2 border border-stone-900 text-stone-900 text-xs uppercase tracking-widest font-mono hover:bg-stone-900 hover:text-stone-50 disabled:opacity-40"
            >
              {addingStk ? 'adding…' : '+ add'}
            </button>
            {stkError && <span className="text-xs font-mono text-rose-700">{stkError}</span>}
          </div>
        </div>
      </section>
    </div>
  )
}
