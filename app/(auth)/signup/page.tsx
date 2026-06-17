'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function SignupPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/onboarding')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-white px-6">
      <div className="w-full max-w-sm">
        <div className="mb-10">
          <div className="text-xs uppercase tracking-widest text-stone-500 font-mono mb-2">ScoreJam</div>
          <h1 className="font-serif text-3xl text-stone-900 italic">Create account</h1>
          <p className="text-sm text-stone-500 mt-2">You'll set up your company profile next.</p>
        </div>

        <form onSubmit={handleSignup} className="space-y-5">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Email</label>
            <input
              type="email" value={email} onChange={e => setEmail(e.target.value)} required
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-stone-500 font-mono">Password</label>
            <input
              type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
              className="mt-1 w-full border border-stone-300 bg-white px-3 py-2 text-sm font-mono text-stone-900 focus:outline-none focus:border-stone-900"
            />
          </div>
          {error && <p className="text-xs text-rose-700 font-mono">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-stone-900 text-stone-50 py-2.5 text-xs uppercase tracking-widest font-mono hover:bg-stone-800 disabled:opacity-50"
          >
            {loading ? 'creating account…' : 'Create account →'}
          </button>
        </form>

        <p className="mt-6 text-xs text-stone-500 font-mono text-center">
          Already have an account?{' '}
          <Link href="/login" className="text-stone-900 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
