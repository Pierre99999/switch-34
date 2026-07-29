'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'

type Sentiment = 'positive' | 'negative' | 'neutral'

// Floating feedback button — beta only. Lets testers send a reaction and a
// note from any page; the admin dashboard reads them back.
export default function FeedbackWidget() {
  const { locale } = useI18n()
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const [sentiment, setSentiment] = useState<Sentiment | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const fr = locale === 'fr'

  async function submit() {
    if (!message.trim()) return
    setSending(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('feedback').insert({
        user_id: user.id,
        sentiment: sentiment ?? 'neutral',
        message: message.trim(),
        page: pathname,
      })
    }
    setSending(false)
    setSent(true)
    setMessage('')
    setSentiment(null)
    setTimeout(() => { setSent(false); setOpen(false) }, 1600)
  }

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 px-4 py-2.5 bg-neutral-900 text-white text-sm font-medium rounded-full shadow-lg hover:bg-neutral-800 transition-all flex items-center gap-2"
        >
          <span>💬</span>
          {fr ? 'Votre avis' : 'Feedback'}
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-40 w-[min(22rem,calc(100vw-2.5rem))] bg-white rounded-2xl border border-neutral-200 shadow-xl p-5">
          {sent ? (
            <p className="text-sm font-medium text-emerald-600 py-4 text-center">
              {fr ? '✓ Merci, c’est envoyé !' : '✓ Thanks, sent!'}
            </p>
          ) : (
            <>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-900">{fr ? 'Votre avis' : 'Your feedback'}</h3>
                  <p className="text-xs text-neutral-400 mt-0.5">{fr ? 'Ce qui vous plaît, ce qui coince…' : 'What works, what doesn’t…'}</p>
                </div>
                <button onClick={() => setOpen(false)} className="text-neutral-300 hover:text-neutral-600 text-lg leading-none">✕</button>
              </div>

              <div className="flex gap-2 mb-3">
                {([['positive', '👍'], ['negative', '👎']] as [Sentiment, string][]).map(([s, icon]) => (
                  <button
                    key={s}
                    onClick={() => setSentiment(sentiment === s ? null : s)}
                    className={`flex-1 py-2 rounded-xl border text-lg transition-all ${
                      sentiment === s ? 'border-blue-500 bg-blue-50' : 'border-neutral-200 hover:border-neutral-400'
                    }`}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={4}
                autoFocus
                placeholder={fr ? 'Dites-nous tout…' : 'Tell us anything…'}
                className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"
              />

              <button
                onClick={submit}
                disabled={sending || !message.trim()}
                className="mt-3 w-full bg-blue-500 text-white py-2.5 text-sm font-semibold rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 transition-all"
              >
                {sending ? (fr ? 'Envoi…' : 'Sending…') : (fr ? 'Envoyer' : 'Send')}
              </button>
            </>
          )}
        </div>
      )}
    </>
  )
}
