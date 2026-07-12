'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function EditableProspectName({
  dealId,
  name,
}: {
  dealId: string
  name: string
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(name)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  async function save() {
    const trimmed = value.trim()
    if (!trimmed || trimmed === name) { setValue(name); setEditing(false); return }
    setSaving(true)
    const supabase = createClient()
    await supabase.from('deals').update({ prospect_name: trimmed }).eq('id', dealId)
    setSaving(false)
    setEditing(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') save()
    if (e.key === 'Escape') { setValue(name); setEditing(false) }
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={onKeyDown}
        disabled={saving}
        className="font-serif italic text-stone-900 text-sm w-full border-b border-stone-900 bg-transparent focus:outline-none disabled:opacity-50"
      />
    )
  }

  return (
    <div className="group/name flex items-center gap-1.5 min-w-0">
      <span
        className="font-serif italic text-stone-900 text-sm cursor-text truncate"
        onClick={() => setEditing(true)}
      >
        {value}
      </span>
      <button
        onClick={() => setEditing(true)}
        className="text-[9px] font-mono text-stone-300 hover:text-stone-600 opacity-0 group-hover/name:opacity-100 transition-opacity"
        tabIndex={-1}
      >
        edit
      </button>
    </div>
  )
}
