'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

const inputClass = "mt-1 w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"

export default function LoginPage() {
  const router = useRouter()
  const { t } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/pipeline')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-500 tracking-tight">Switch</Link>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-neutral-900 mb-6">{t('auth.login')}</h1>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('auth.email')}</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)} required
                autoComplete="email"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">{t('auth.password')}</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)} required
                autoComplete="current-password"
                className={inputClass}
              />
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-500 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? t('auth.signingIn') : `${t('auth.login')} →`}
            </button>
          </form>
        </div>

        <p className="mt-6 text-sm text-neutral-500 text-center">
          {t('auth.noAccount')}{' '}
          <Link href="/signup" className="text-blue-500 font-medium hover:text-blue-600 transition-colors">{t('auth.signUpLink')}</Link>
        </p>
      </div>
    </div>
  )
}
