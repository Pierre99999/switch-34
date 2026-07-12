'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type Locale, type TranslationKey, t as translate } from './translations'
import { createClient } from '@/lib/supabase/client'

type I18nContextType = {
  locale: Locale
  setLocale: (l: Locale) => void
  t: (key: TranslationKey, params?: Record<string, string | number>) => string
}

const I18nContext = createContext<I18nContextType>({
  locale: 'fr',
  setLocale: () => {},
  t: (key) => key,
})

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('fr')

  useEffect(() => {
    async function loadLocale() {
      const saved = localStorage.getItem('switch-locale') as Locale | null
      if (saved === 'en' || saved === 'fr') setLocaleState(saved)

      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: vendor } = await supabase.from('vendors').select('locale').eq('user_id', user.id).single()
      if (vendor?.locale === 'en' || vendor?.locale === 'fr') {
        setLocaleState(vendor.locale)
        localStorage.setItem('switch-locale', vendor.locale)
      }
    }
    loadLocale()
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem('switch-locale', l)
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('vendors').update({ locale: l }).eq('user_id', user.id).then(() => {})
    })
  }

  function t(key: TranslationKey, params?: Record<string, string | number>) {
    return translate(key, locale, params)
  }

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  )
}

export function useI18n() {
  return useContext(I18nContext)
}

export function useLocale() {
  return useContext(I18nContext).locale
}
