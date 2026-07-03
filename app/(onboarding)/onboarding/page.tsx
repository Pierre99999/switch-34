'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function OnboardingPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [companyName, setCompanyName] = useState('')
  const [companyUrl, setCompanyUrl] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { error } = await supabase.from('vendors').insert({
      user_id: user.id,
      company_name: companyName,
      company_url: companyUrl,
    })

    if (error) { setError(error.message); setLoading(false); return }
    router.push('/profile')
    router.refresh()
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-md mx-auto py-20 px-6">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">Switch · setup</div>
          <h1 className="font-serif text-3xl text-stone-900 italic">Welcome</h1>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            Enter your company name to get started. You'll import your profile from your website or a document on the next screen.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Company name</label>
            <input
              type="text"
              value={companyName}
              onChange={e => setCompanyName(e.target.value)}
              placeholder="Acme Corp"
              required
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Website (optional)</label>
            <input
              type="text"
              value={companyUrl}
              onChange={e => setCompanyUrl(e.target.value)}
              placeholder="acme.com"
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2.5 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>

          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}

          <button
            type="submit"
            disabled={!companyName.trim() || loading}
            className="w-full bg-stone-900 text-stone-50 py-3 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-40"
          >
            {loading ? 'creating…' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
