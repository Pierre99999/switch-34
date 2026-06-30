'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    company_name: '',
    company_url: '',
    product_description: '',
    value_proposition: '',
    differentiators: '',
    ideal_customer: '',
    past_wins: '',
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

    const { error } = await supabase.from('vendors').insert({
      user_id: user.id,
      ...form,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/pipeline')
    router.refresh()
  }

  const field = (label: string, key: string, placeholder: string, multiline = false) => (
    <div key={key}>
      <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">{label}</label>
      {multiline ? (
        <textarea
          value={form[key as keyof typeof form]}
          onChange={e => set(key, e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:outline-none focus:border-stone-900 resize-none"
        />
      ) : (
        <input
          type="text"
          value={form[key as keyof typeof form]}
          onChange={e => set(key, e.target.value)}
          placeholder={placeholder}
          className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
        />
      )}
    </div>
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto py-12 px-6">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch · setup</div>
          <h1 className="font-serif text-3xl text-stone-900 italic">Your company profile</h1>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            This is filled once. Switch uses it to pre-score deals and generate briefings that position your product correctly.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {field('Company name', 'company_name', 'Acme Corp', false)}
          {field('Company URL', 'company_url', 'acme.com', false)}
          {field('What does your product do?', 'product_description', 'Describe what you sell in 2-3 sentences.', true)}
          {field('Value proposition', 'value_proposition', 'Why should someone buy from you rather than do nothing?', true)}
          {field('Key differentiators', 'differentiators', 'What makes you concretely different from alternatives?', true)}
          {field('Ideal customer profile', 'ideal_customer', 'Who are you best for? Industry, size, situation.', true)}
          {field('2-3 recent wins (brief)', 'past_wins', 'Customer type, problem solved, outcome. Switch uses these to pre-score Concerns Fit.', true)}

          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}

          <button
            type="submit" disabled={!form.company_name || loading}
            className="w-full bg-stone-900 text-stone-50 py-3 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? 'saving…' : 'Save & go to pipeline →'}
          </button>
        </form>
      </div>
    </div>
  )
}
