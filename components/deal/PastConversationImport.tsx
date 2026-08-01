'use client'

import { useState } from 'react'
import AIProgress from '@/components/ui/AIProgress'

// A deal that was already running before it reached Switch has conversations
// behind it. Starting at "generate the round 1 briefing" would throw them
// away and pretend the deal begins now. Import them instead: each transcript
// becomes a round, scored like any other captured conversation.
export default function PastConversationImport({
  locale, busy, error, onImport,
}: {
  locale: string
  busy: boolean
  error: string | null
  onImport: (payload: { file?: File; text?: string }) => void
}) {
  const fr = locale === 'fr'
  const [open, setOpen] = useState(false)
  const [pasted, setPasted] = useState('')

  const steps = fr
    ? ['Lecture du transcript', 'Attribution des propos', 'Notation des critères', 'Mise à jour du tableau de bord']
    : ['Reading the transcript', 'Attributing what was said', 'Scoring the criteria', 'Updating the dashboard']

  if (busy) {
    return (
      <div className="bg-white rounded-xl border border-neutral-200 p-5">
        <AIProgress steps={steps} durationSec={90} />
        <p className="text-xs text-neutral-400 mt-4 text-center">
          {fr ? 'Environ 90 secondes. Restez sur cette page.' : 'About 90 seconds. Stay on this page.'}
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-neutral-200 px-5 py-4">
      <div className="text-sm font-semibold text-neutral-800">
        {fr ? 'Ce deal a déjà commencé ?' : 'Has this deal already started?'}
      </div>
      <p className="text-sm text-neutral-600 mt-1">
        {fr
          ? 'Importez les conversations déjà eues : chacune devient un round, noté comme si vous l’aviez capturée ici. Vous repartez de l’état réel du deal, pas de zéro.'
          : 'Import the conversations you have already had: each becomes a round, scored as if you had captured it here. You start from where the deal actually stands, not from zero.'}
      </p>

      <div className="flex items-center gap-3 flex-wrap mt-3">
        <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-neutral-300 text-sm font-medium cursor-pointer hover:border-violet-400 hover:bg-violet-50 transition-all">
          <span>📄</span>
          <span>{fr ? 'Importer un transcript' : 'Import a transcript'}</span>
          <input
            type="file"
            accept=".txt,.atxt,.pdf,.md,.vtt,.srt,.docx"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0]
              if (file) onImport({ file })
              e.target.value = ''
            }}
          />
        </label>
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-dashed text-sm font-medium transition-all ${open ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-neutral-300 text-neutral-600 hover:border-violet-400 hover:bg-violet-50'}`}
        >
          <span>📋</span>
          <span>{fr ? 'Coller un transcript' : 'Paste a transcript'}</span>
        </button>
      </div>

      {open && (
        <div className="mt-3">
          <textarea
            value={pasted}
            onChange={e => setPasted(e.target.value)}
            rows={8}
            placeholder={fr
              ? 'Collez le transcript de la conversation. Gardez les noms des intervenants : Switch pondère chaque propos selon le rôle de celui qui l’a dit.'
              : 'Paste the conversation transcript. Keep the speaker names: Switch weighs each statement by the role of whoever said it.'}
            className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 resize-none placeholder:text-neutral-300 transition-all"
          />
          <button
            onClick={() => onImport({ text: pasted.trim() })}
            disabled={pasted.trim().length < 50}
            className="mt-2 px-5 py-2.5 bg-violet-500 text-white text-sm font-medium rounded-xl hover:bg-violet-600 shadow-sm shadow-violet-500/20 disabled:opacity-40 transition-all"
          >
            {fr ? '✦ Analyser cette conversation' : '✦ Analyze this conversation'}
          </button>
        </div>
      )}

      <p className="text-xs text-neutral-400 mt-3">
        {fr
          ? 'Une conversation à la fois — importez-les dans l’ordre chronologique pour que le momentum se calcule.'
          : 'One conversation at a time — import them in chronological order so momentum can be computed.'}
      </p>

      {error && <p className="mt-2 text-sm text-rose-600">{error}</p>}
    </div>
  )
}
