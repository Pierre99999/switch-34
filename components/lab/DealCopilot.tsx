'use client'

import { useState } from 'react'

// One input, not two. The suggestions are shortcuts into the same box, so
// there is never a question of which field to type in.
const SUGGESTIONS = [
  { icon: '◎', tint: 'bg-emerald-50 text-emerald-500', label: 'Pourquoi cette porte est-elle bloquée ?', hint: 'Le critère qui bloque, et ce qui le débloquerait', q: 'Quelle porte est bloquée aujourd’hui, par quel critère exactement, et qu’est-ce qui la débloquerait ?' },
  { icon: '◈', tint: 'bg-amber-50 text-amber-500', label: 'Que sait-on vraiment, et sur quelle preuve ?', hint: 'Ce qui est corroboré, ce qui n’est que déclaré', q: 'Résume ce qui est établi sur ce deal en distinguant ce qui est corroboré de ce qui n’est que déclaré, et par qui.' },
  { icon: '◆', tint: 'bg-violet-50 text-violet-500', label: 'Qui manque autour de la table ?', hint: 'Les rôles absents et le risque associé', q: 'Qui a parlé jusqu’ici, quel poids a sa voix, et quels rôles manquent encore dans ce deal ?' },
  { icon: '◇', tint: 'bg-blue-50 text-blue-500', label: 'Pourquoi le momentum est-il faible ?', hint: 'Ce qui stagne d’un round à l’autre', q: 'Pourquoi le momentum est-il à ce niveau, et qu’est-ce qui n’a pas bougé entre les rounds ?' },
]

export default function DealCopilot({ dealId, onRan }: { dealId: string; onRan?: () => void }) {
  const [question, setQuestion] = useState('')
  const [answer, setAnswer] = useState<string | null>(null)
  const [asked, setAsked] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function ask(q: string) {
    if (!q.trim() || loading) return
    setLoading(true); setError(null); setAnswer(null); setAsked(q.trim())
    try {
      const res = await fetch('/api/ai/copilot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dealId, question: q.trim(), locale: 'fr' }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? `Échec (${res.status})`)
      setAnswer(data.answer)
      setQuestion('')
      onRan?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Le copilote n’a pas répondu')
    }
    setLoading(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-neutral-200/80 shadow-[0_1px_2px_rgba(0,0,0,0.04)] p-5 flex flex-col min-h-[420px]">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-7 h-7 rounded-full bg-blue-50 text-blue-500 flex items-center justify-center text-sm">✦</span>
        <span className="text-[11px] font-semibold text-neutral-400 uppercase tracking-[0.08em]">Copilote</span>
      </div>

      {!asked && (
        <ul className="space-y-2 mb-4">
          {SUGGESTIONS.map(s => (
            <li key={s.label}>
              <button
                onClick={() => ask(s.q)}
                disabled={loading}
                className="w-full text-left px-3 py-3 rounded-xl border border-neutral-200/80 hover:border-blue-300 hover:bg-blue-50/40 transition-all disabled:opacity-50"
              >
                <div className="flex items-start gap-3">
                  <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${s.tint}`}>{s.icon}</span>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-neutral-800 leading-snug">{s.label}</div>
                    <div className="text-[11px] text-neutral-400 mt-0.5">{s.hint}</div>
                  </div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}

      {asked && (
        <div className="mb-4 min-h-[120px]">
          <p className="text-xs text-neutral-400 mb-2">{asked}</p>
          {loading && <p className="text-sm text-neutral-400">Le copilote consulte le diagnostic…</p>}
          {answer && <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap">{answer}</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {!loading && (
            <button onClick={() => { setAsked(null); setAnswer(null); setError(null) }} className="text-xs font-medium text-blue-500 hover:text-blue-600 mt-3">
              ← Revenir aux suggestions
            </button>
          )}
        </div>
      )}

      <div className="mt-auto">
        <div className="flex gap-2">
          <input
            value={question}
            onChange={e => setQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && ask(question)}
            placeholder="Posez une question sur ce deal…"
            disabled={loading}
            className="flex-1 bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-blue-400 placeholder:text-neutral-300"
          />
          <button
            onClick={() => ask(question)}
            disabled={loading || !question.trim()}
            className="px-3 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 disabled:opacity-40 transition-all"
          >
            ↑
          </button>
        </div>
        <p className="text-[11px] text-neutral-400 mt-2 leading-snug">
          Le copilote ne répond que depuis le diagnostic de ce deal. Il ne prédit pas l’issue et dit quand il ne sait pas.
        </p>
      </div>
    </div>
  )
}
