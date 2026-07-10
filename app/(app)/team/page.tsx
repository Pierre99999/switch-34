'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useI18n } from '@/lib/i18n/context'
import { useRole } from '@/lib/role-context'
import { useRouter } from 'next/navigation'
import type { QuestionTemplate, Vendor } from '@/lib/types'

const inputClass = "w-full bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 placeholder:text-neutral-300 transition-all"

export default function TeamPage() {
  const { t } = useI18n()
  const { role, organizationId, loading: roleLoading } = useRole()
  const router = useRouter()

  const [inviteCode, setInviteCode] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [members, setMembers] = useState<Vendor[]>([])
  const [templates, setTemplates] = useState<QuestionTemplate[]>([])
  const [newQuestion, setNewQuestion] = useState('')
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    if (roleLoading || !organizationId) return
    const supabase = createClient()

    const [{ data: org }, { data: vendorData }, { data: templateData }] = await Promise.all([
      supabase.from('organizations').select('invite_code').eq('id', organizationId).single(),
      supabase.from('vendors').select('*').eq('organization_id', organizationId).order('created_at'),
      supabase.from('question_templates').select('*').eq('organization_id', organizationId).order('created_at'),
    ])

    if (org) setInviteCode(org.invite_code)
    if (vendorData) setMembers(vendorData as Vendor[])
    if (templateData) setTemplates(templateData as QuestionTemplate[])
  }, [organizationId, roleLoading])

  useEffect(() => {
    if (!roleLoading && role !== 'director') { router.push('/pipeline'); return }
    load()
  }, [load, role, roleLoading, router])

  async function handleAddQuestion() {
    if (!newQuestion.trim() || !organizationId) return
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('question_templates').insert({
      organization_id: organizationId,
      text: newQuestion.trim(),
      created_by: user?.id,
    })
    setNewQuestion('')
    await load()
    setSaving(false)
  }

  async function handleDeleteQuestion(id: string) {
    const supabase = createClient()
    await supabase.from('question_templates').delete().eq('id', id)
    setTemplates(t => t.filter(q => q.id !== id))
  }

  async function handleUpdateQuestion(id: string, text: string) {
    const supabase = createClient()
    await supabase.from('question_templates').update({ text }).eq('id', id)
    setTemplates(ts => ts.map(q => q.id === id ? { ...q, text } : q))
  }

  function copyCode() {
    navigator.clipboard.writeText(inviteCode)
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 2000)
  }

  if (roleLoading) return <div className="max-w-4xl mx-auto py-12 px-6 text-sm text-neutral-400">Loading…</div>

  return (
    <div className="max-w-4xl mx-auto py-8 px-6">
      <div className="mb-8">
        <p className="text-sm text-neutral-400 mb-1">Switch</p>
        <h1 className="text-2xl font-bold text-neutral-900">{t('nav.team')}</h1>
      </div>

      {/* Invite Code */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-700 mb-3">{t('onboarding.inviteCode')}</h2>
        <div className="flex items-center gap-4">
          <div className="text-2xl font-mono font-bold text-neutral-900 tracking-widest bg-neutral-50 px-6 py-3 rounded-xl border border-neutral-200">
            {inviteCode}
          </div>
          <button onClick={copyCode} className="px-4 py-2 text-sm font-medium text-neutral-600 border border-neutral-200 rounded-xl hover:border-blue-400 hover:text-blue-600 transition-all">
            {codeCopied ? t('onboarding.codeCopied') : t('onboarding.copyCode')}
          </button>
        </div>
        <p className="text-xs text-neutral-400 mt-2">{t('onboarding.teamStepDesc')}</p>
      </div>

      {/* Team Members */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-700 mb-4">{t('team.members')}</h2>
        {members.length === 0 ? (
          <p className="text-sm text-neutral-400">{t('team.noMembers')}</p>
        ) : (
          <div className="space-y-2">
            {members.map(m => (
              <div key={m.id} className="flex items-center justify-between py-2 px-3 bg-neutral-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${m.role === 'director' ? 'bg-blue-500' : 'bg-neutral-400'}`} />
                  <span className="text-sm font-medium text-neutral-800">{m.full_name || m.company_name}</span>
                </div>
                <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${m.role === 'director' ? 'bg-blue-50 text-blue-600' : 'bg-neutral-100 text-neutral-500'}`}>
                  {t(('role.' + m.role) as any)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Question Templates */}
      <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-neutral-700 mb-1">{t('onboarding.questionsStep')}</h2>
        <p className="text-xs text-neutral-400 mb-4">{t('team.questionsDesc')}</p>

        <div className="space-y-2 mb-4">
          {templates.map(q => (
            <div key={q.id} className="flex gap-2 items-center group">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 flex-shrink-0" />
              <input
                value={q.text}
                onChange={e => handleUpdateQuestion(q.id, e.target.value)}
                className="flex-1 bg-red-50 border border-red-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500/20"
              />
              <button onClick={() => handleDeleteQuestion(q.id)} className="text-neutral-300 hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100">✕</button>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <input
            value={newQuestion}
            onChange={e => setNewQuestion(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAddQuestion()}
            placeholder={t('onboarding.questionPlaceholder')}
            className={inputClass}
          />
          <button
            onClick={handleAddQuestion}
            disabled={!newQuestion.trim() || saving}
            className="px-5 py-2.5 bg-blue-500 text-white text-sm font-medium rounded-xl hover:bg-blue-600 shadow-sm shadow-blue-500/20 disabled:opacity-40 whitespace-nowrap transition-all"
          >
            {t('onboarding.addQuestion')}
          </button>
        </div>
      </div>
    </div>
  )
}
