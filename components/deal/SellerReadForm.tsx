'use client'

import {
  ENGAGEMENT_LEVELS, TONE_LEVELS, CONFIDENCE_LEVELS, type SellerRead,
} from '@/lib/seller-read'

// Defined outside the component: a component re-created on every render is
// remounted rather than updated, which loses focus and state inside it.
function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-medium text-neutral-600">{label}</div>
      {hint && <div className="text-[11px] text-neutral-400 mb-1.5">{hint}</div>}
      <div className={`flex gap-1.5 flex-wrap ${hint ? '' : 'mt-1.5'}`}>{children}</div>
    </div>
  )
}

// Three taps and one optional line, at the moment the conversation closes.
// Deliberately optional: a form nobody can skip gets answered at random, and
// a random feeling is worse than no feeling — it would sit next to the scores
// looking like data.
export default function SellerReadForm({
  value, onChange, locale, readOnly,
}: {
  value: SellerRead
  onChange: (v: SellerRead) => void
  locale: string
  readOnly?: boolean
}) {
  const fr = locale === 'fr'

  const chip = (active: boolean) =>
    `text-xs font-medium px-3 py-1.5 rounded-full border transition-all text-left ${
      active
        ? 'bg-violet-500 text-white border-violet-500'
        : 'bg-white text-neutral-600 border-neutral-200 hover:border-violet-300'
    } ${readOnly ? 'pointer-events-none opacity-70' : ''}`

  // Clicking the selected value again clears it — nothing here is compulsory.
  const pick = <K extends keyof SellerRead>(key: K, v: number) =>
    onChange({ ...value, [key]: value[key] === v ? undefined : v })

  return (
    <div className="bg-violet-50/40 border border-violet-200 rounded-2xl px-5 py-4 space-y-4">
      <div>
        <div className="text-[11px] font-semibold text-violet-600 uppercase tracking-wide">
          {fr ? 'Votre lecture de l’échange' : 'Your read of the conversation'}
        </div>
        <p className="text-xs text-neutral-500 mt-0.5">
          {fr
            ? 'Facultatif, vingt secondes. Cela n’entre jamais dans les scores — c’est l’écart avec les preuves qui est intéressant.'
            : 'Optional, twenty seconds. It never enters the scores — the gap with the evidence is what matters.'}
        </p>
      </div>

      <Row
        label={fr ? 'Engagement du prospect' : 'Prospect engagement'}
        hint={fr ? 'ce qu’il a fait, pas ce que vous avez ressenti' : 'what they did, not how it felt'}
      >
        {ENGAGEMENT_LEVELS.map(l => (
          <button
            key={l.value}
            onClick={() => pick('engagement', l.value)}
            className={chip(value.engagement === l.value)}
            title={fr ? l.hintFr : l.hintEn}
          >
            {fr ? l.fr : l.en}
          </button>
        ))}
      </Row>

      <Row label={fr ? 'Tonalité ressentie' : 'Tone you felt'}>
        {TONE_LEVELS.map(l => (
          <button key={l.value} onClick={() => pick('tone', l.value)} className={chip(value.tone === l.value)}>
            {fr ? l.fr : l.en}
          </button>
        ))}
      </Row>

      <Row label={fr ? 'Si vous deviez parier aujourd’hui, ce deal se signe' : 'If you had to bet today, this deal closes'}>
        {CONFIDENCE_LEVELS.map(l => (
          <button key={l.value} onClick={() => pick('confidence', l.value)} className={chip(value.confidence === l.value)}>
            {fr ? l.fr : l.en}
          </button>
        ))}
      </Row>

      <div>
        <div className="text-xs font-medium text-neutral-600 mb-1.5">
          {fr ? 'Ce qui vous a marqué, ou ce qui vous gêne' : 'What struck you, or what nags at you'}
        </div>
        <textarea
          value={value.note ?? ''}
          onChange={e => !readOnly && onChange({ ...value, note: e.target.value })}
          readOnly={readOnly}
          rows={2}
          placeholder={fr
            ? 'Une phrase suffit. Même une impression que vous n’arrivez pas à justifier — le prochain briefing ira la vérifier.'
            : 'One sentence is enough. Even a hunch you cannot justify — the next briefing will go and check it.'}
          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 resize-none placeholder:text-neutral-300 transition-all"
        />
      </div>
    </div>
  )
}
