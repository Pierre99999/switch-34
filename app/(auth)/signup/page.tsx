'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

const inputClass = "mt-1 w-full bg-white border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"

export default function SignupPage() {
  const router = useRouter()
  const { t, locale } = useI18n()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [alreadyTaken, setAlreadyTaken] = useState(false)
  const [checkEmail, setCheckEmail] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setAlreadyTaken(false)
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    // Supabase does not error on a duplicate email (it refuses to leak which
    // addresses exist). It returns a user with an empty identities array
    // instead. Without this check the signup looks like it worked, no email
    // ever arrives, and the person can never sign in.
    if (data.user && (data.user.identities?.length ?? 0) === 0) {
      setAlreadyTaken(true)
      setLoading(false)
      return
    }

    // Email confirmation is on: there is no session yet. Sending them to
    // /onboarding would just bounce them back to /login.
    if (!data.session) {
      setCheckEmail(true)
      setLoading(false)
      return
    }

    router.push('/onboarding')
    router.refresh()
  }

  if (checkEmail) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6">
        <div className="w-full max-w-sm text-center">
          <div className="text-2xl font-bold text-blue-500 tracking-tight mb-8">Switch</div>
          <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-8">
            <div className="text-4xl mb-4">✉️</div>
            <h1 className="text-xl font-bold text-neutral-900 mb-2">
              {locale === 'fr' ? 'Vérifiez votre boîte mail' : 'Check your inbox'}
            </h1>
            <p className="text-sm text-neutral-500 leading-relaxed">
              {locale === 'fr'
                ? <>Nous avons envoyé un lien de confirmation à <strong className="text-neutral-700">{email}</strong>. Cliquez dessus pour activer votre compte, puis revenez vous connecter.</>
                : <>We sent a confirmation link to <strong className="text-neutral-700">{email}</strong>. Click it to activate your account, then come back and sign in.</>}
            </p>
            <p className="text-xs text-neutral-400 mt-4">
              {locale === 'fr' ? 'Pensez à regarder dans les spams.' : 'Remember to check your spam folder.'}
            </p>
          </div>
          <p className="mt-6 text-sm text-neutral-500">
            <Link href="/login" className="text-blue-500 font-medium hover:text-blue-600 transition-colors">
              {t('auth.signInLink')}
            </Link>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4 sm:px-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-blue-500 tracking-tight">Switch</Link>
        </div>

        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-6 sm:p-8">
          <h1 className="text-xl font-bold text-neutral-900 mb-1">{t('auth.signup')}</h1>
          <p className="text-sm text-neutral-500 mb-6">
            {locale === 'fr' ? 'Vous configurerez votre profil entreprise ensuite.' : "You'll set up your company profile next."}
          </p>

          <form onSubmit={handleSignup} className="space-y-4">
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
                type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8}
                autoComplete="new-password"
                className={inputClass}
              />
              <p className="text-xs text-neutral-400 mt-1">{locale === 'fr' ? '8 caractères minimum' : 'At least 8 characters'}</p>
            </div>
            {error && <p className="text-sm text-rose-600">{error}</p>}
            {alreadyTaken && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                <p className="text-sm text-amber-800">
                  {locale === 'fr'
                    ? 'Un compte existe déjà avec cette adresse.'
                    : 'An account already exists with this address.'}
                </p>
                <Link href="/login" className="text-sm font-medium text-blue-600 hover:text-blue-700 mt-1 inline-block">
                  {locale === 'fr' ? 'Se connecter →' : 'Sign in →'}
                </Link>
              </div>
            )}
            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-500 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-50 transition-all"
            >
              {loading ? t('auth.creatingAccount') : `${t('auth.signup')} →`}
            </button>
          </form>
        </div>

        <p className="mt-6 text-sm text-neutral-500 text-center">
          {t('auth.hasAccount')}{' '}
          <Link href="/login" className="text-blue-500 font-medium hover:text-blue-600 transition-colors">{t('auth.signInLink')}</Link>
        </p>
      </div>
    </div>
  )
}
