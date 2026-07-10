'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

export default function NewDealPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prospectUrl, setProspectUrl] = useState('')
  const [form, setForm] = useState({
    prospect_name: '',
    contact_name: '',
    contact_title: '',
    potential_revenue: '',
  })

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { potential_revenue, ...rest } = form
    const { data: deal, error } = await supabase
      .from('deals')
      .insert({ user_id: user.id, ...rest, prospect_url: prospectUrl.trim() || null, potential_revenue: potential_revenue ? Number(potential_revenue) : null, current_round: 0 })
      .select()
      .single()

    if (error) { setError(error.message); setLoading(false); return }

    await supabase.from('deal_rounds').insert({ deal_id: deal.id, round: 0 })

    if (prospectUrl.trim()) {
      fetch('/api/context/from-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: prospectUrl.trim(), locale }),
      })
        .then(r => r.json())
        .then(data => {
          if (data.dimensions) {
            supabase.from('deals').update({ prospect_dimensions: data.dimensions }).eq('id', deal.id)
          }
        })
        .catch(() => {})
    }

    router.push(`/deals/${deal.id}/dashboard`)
    router.refresh()
  }

  return (
    <div className="max-w-2xl mx-auto py-12 px-6">
      <div className="mb-10">
        <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch</div>
        <h1 className="font-serif text-3xl text-stone-900 italic">{t('newDeal.title')}</h1>
        <p className="text-sm text-stone-500 mt-2">{t('newDeal.subtitle')}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.prospectCompany')} *</label>
          <input
            type="text" value={form.prospect_name} onChange={e => set('prospect_name', e.target.value)} required
            placeholder="Acme Manufacturing"
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
          />
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.prospectUrl')}</label>
          <input
            type="text" value={prospectUrl} onChange={e => setProspectUrl(e.target.value)}
            placeholder={t('newDeal.prospectUrlPlaceholder')}
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
          />
          {prospectUrl.trim() && (
            <p className="mt-1 text-[10px] text-stone-400 font-mono">{t('newDeal.fetchContext')}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.contactName')}</label>
            <input
              type="text" value={form.contact_name} onChange={e => set('contact_name', e.target.value)}
              placeholder="Sarah Chen"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.contactTitle')}</label>
            <input
              type="text" value={form.contact_title} onChange={e => set('contact_title', e.target.value)}
              placeholder="VP Operations"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
        </div>
        <div>
          <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{t('newDeal.potentialRevenue')}</label>
          <input
            type="number" value={form.potential_revenue} onChange={e => set('potential_revenue', e.target.value)}
            placeholder="50000"
            min="0"
            className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
          />
        </div>
        {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}

        <div className="flex gap-3">
          <button
            type="button" onClick={() => router.back()}
            className="px-6 py-2.5 text-xs uppercase tracking-widest font-mono text-stone-600 border border-stone-300 hover:border-stone-600"
          >
            {t('common.cancel')}
          </button>
          <button
            type="submit" disabled={!form.prospect_name || loading}
            className="flex-1 bg-stone-900 text-stone-50 py-2.5 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? t('newDeal.creating') : t('newDeal.create')}
          </button>
        </div>
      </form>
    </div>
  )
}
