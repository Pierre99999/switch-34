'use client'

import { createContext, useCallback, useContext, useState } from 'react'

type Toast = { id: number; message: string; kind: 'success' | 'error' }

const ToastContext = createContext<{ toast: (message: string, kind?: 'success' | 'error') => void }>({ toast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export default function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const toast = useCallback((message: string, kind: 'success' | 'error' = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(ts => [...ts, { id, message, kind }])
    setTimeout(() => setToasts(ts => ts.filter(t => t.id !== id)), kind === 'error' ? 6000 : 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2 px-4 w-full max-w-md pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto w-full sm:w-auto px-4 py-3 rounded-xl shadow-lg text-sm font-medium flex items-center gap-2 animate-[toast-in_.2s_ease-out] ${
              t.kind === 'success' ? 'bg-neutral-900 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            <span>{t.kind === 'success' ? '✓' : '⚠'}</span>
            <span className="flex-1">{t.message}</span>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </ToastContext.Provider>
  )
}
