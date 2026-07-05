'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { type Locale, type TranslationKey, t as translate } from './translations'

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
    const saved = localStorage.getItem('switch-locale') as Locale | null
    if (saved === 'en' || saved === 'fr') setLocaleState(saved)
  }, [])

  function setLocale(l: Locale) {
    setLocaleState(l)
    localStorage.setItem('switch-locale', l)
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
