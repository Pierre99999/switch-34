'use client'

import { useState } from 'react'
import { ACTOR_TYPES, ACTOR_TYPE_LABEL, type Attendee } from '@/lib/attendees'
import type { DealContact } from '@/lib/playbook-fit'

// Asked once, before every briefing: who will be in the room.
//
// Nothing is pre-selected on purpose, even the contact met last time. A
// pre-ticked box is answered by not reading it, and the whole value of the
// question is that the answer changes between rounds — round 1 is the champion
// alone, round 3 is a committee.

export default function AttendeesDialog({
  roundNumber, contacts, previous, onCancel, onConfirm,
}: {
  roundNumber: number
  contacts: DealContact[]
  /** Who came last round — shown as a reminder, never as a default. */
  previous: Attendee[]
  onCancel: () => void
  onConfirm: (attendees: Attendee[], newContacts: Attendee[]) => void
}) {
  const known: Attendee[] = contacts.map(c => ({
    name: c.name,
    title: (c as { role?: string | null }).role ?? null,
    actor_types: (c.actor_types?.length ? c.actor_types : [c.actor_type ?? 'unknown']) as string[],
  }))

  const [picked, setPicked] = useState<string[]>([])
  const [added, setAdded] = useState<Attendee[]>([])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [roles, setRoles] = useState<string[]>([])

  const toggle = (n: string) =>
    setPicked(p => p.includes(n) ? p.filter(x => x !== n) : [...p, n])

  const toggleRole = (r: string) =>
    setRoles(rs => rs.includes(r) ? rs.filter(x => x !== r) : [...rs, r])

  function addPerson() {
    const n = name.trim()
    if (!n) return
    setAdded(a => [...a, { name: n, title: title.trim() || null, actor_types: roles.length ? roles : ['unknown'] }])
    setName(''); setTitle(''); setRoles([])
  }

  const chosen = [...known.filter(k => picked.includes(k.name)), ...added]

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-neutral-900/40 backdrop-blur-sm px-4 py-8 overflow-y-auto" role="dialog" aria-modal="true">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl my-auto p-6">
        <h3 className="text-lg font-bold text-neutral-900">Qui allez-vous rencontrer ?</h3>
        <p className="text-sm text-neutral-500 mt-1.5 leading-relaxed">
          Round {roundNumber}. Les questions seront écrites pour ces personnes — on ne demande pas
          le budget à un utilisateur, ni l’usage quotidien à un DAF.
        </p>

        {previous.length > 0 && (
          <p className="text-xs text-neutral-400 mt-2">
            Au round précédent : {previous.map(p => p.name).join(', ')}.
          </p>
        )}

        <div className="mt-5 space-y-1.5">
          {known.length === 0 && (
            <p className="text-sm text-neutral-400">Aucun contact enregistré sur ce deal. Ajoutez-en un ci-dessous.</p>
          )}
          {known.map(k => (
            <button
              key={k.name}
              onClick={() => toggle(k.name)}
              className={`w-full flex items-start gap-2.5 text-left text-sm rounded-xl px-3.5 py-2.5 border transition-colors ${
                picked.includes(k.name)
                  ? 'border-blue-300 bg-blue-50 text-neutral-900'
                  : 'border-neutral-200 text-neutral-600 hover:bg-neutral-50'
              }`}
            >
              <span className={`mt-[3px] w-4 h-4 flex-shrink-0 rounded-[5px] border flex items-center justify-center text-[10px] text-white ${
                picked.includes(k.name) ? 'bg-blue-500 border-blue-500' : 'border-neutral-300'
              }`}>
                {picked.includes(k.name) ? '✓' : ''}
              </span>
              <span className="min-w-0">
                <span className="font-medium">{k.name}</span>
                {k.title && <span className="text-neutral-400"> · {k.title}</span>}
                <span className="block text-[11px] text-neutral-400">
                  {k.actor_types.map(t => ACTOR_TYPE_LABEL[t] ?? t).join(', ')}
                </span>
              </span>
            </button>
          ))}

          {added.map((a, i) => (
            <div key={`${a.name}-${i}`} className="flex items-center justify-between gap-2 text-sm rounded-xl px-3.5 py-2.5 border border-blue-300 bg-blue-50">
              <span className="min-w-0">
                <span className="font-medium">{a.name}</span>
                {a.title && <span className="text-neutral-400"> · {a.title}</span>}
                <span className="block text-[11px] text-neutral-400">
                  {a.actor_types.map(t => ACTOR_TYPE_LABEL[t] ?? t).join(', ')} · nouveau contact
                </span>
              </span>
              <button onClick={() => setAdded(l => l.filter((_, j) => j !== i))} className="text-neutral-400 hover:text-rose-600 px-1">✕</button>
            </div>
          ))}
        </div>

        <details className="mt-4 group">
          <summary className="text-sm font-medium text-neutral-500 hover:text-neutral-800 cursor-pointer list-none">
            + Quelqu’un que je ne connais pas encore
          </summary>
          <div className="mt-3 space-y-2.5 border border-neutral-200 rounded-xl p-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              <input
                value={name} onChange={e => setName(e.target.value)} placeholder="Nom"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
              />
              <input
                value={title} onChange={e => setTitle(e.target.value)} placeholder="Fonction (optionnel)"
                className="w-full border border-neutral-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-neutral-400"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {ACTOR_TYPES.filter(t => t !== 'unknown').map(t => (
                <button
                  key={t}
                  onClick={() => toggleRole(t)}
                  className={`text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors ${
                    roles.includes(t)
                      ? 'border-blue-300 bg-blue-50 text-blue-700'
                      : 'border-neutral-200 text-neutral-500 hover:bg-neutral-50'
                  }`}
                >
                  {ACTOR_TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            <button
              onClick={addPerson}
              disabled={!name.trim()}
              className="text-sm font-medium text-blue-600 hover:text-blue-700 disabled:text-neutral-300"
            >
              Ajouter à la conversation
            </button>
          </div>
        </details>

        <div className="flex gap-2 mt-6">
          <button onClick={onCancel} className="flex-1 text-sm font-medium text-neutral-500 rounded-xl py-2.5 hover:bg-neutral-50 transition-colors">
            Annuler
          </button>
          <button
            disabled={chosen.length === 0}
            onClick={() => onConfirm(chosen, added)}
            className="flex-1 bg-blue-500 text-white text-sm font-semibold rounded-xl py-2.5 hover:bg-blue-600 disabled:bg-neutral-200 disabled:text-neutral-400 transition-colors"
          >
            Créer le briefing
          </button>
        </div>
      </div>
    </div>
  )
}
