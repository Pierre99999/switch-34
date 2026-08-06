import type { DealRound, BriefingQuestion, BriefingObjection } from './types'

// The briefing as a letter rather than a form: the angle, the questions, the
// objections to expect, what not to do, and what winning this conversation
// looks like. Same content as the briefing page — one source, two renderings.

export function briefingToText(round: DealRound | null, prospectName: string): string {
  if (!round) return ''
  const q = (round.briefing_questions ?? []) as BriefingQuestion[]
  const pressing = q.filter(x => x.priority !== 'opportunistic')
  const opportunistic = q.filter(x => x.priority === 'opportunistic')
  const objections = (round.briefing_objections ?? []) as BriefingObjection[]
  const doNot = (round.briefing_do_not ?? []) as string[]

  const out: string[] = [`Briefing — ${prospectName}, round ${round.round}`, '']

  if (round.briefing_line) out.push(round.briefing_line, '')
  if (round.briefing_angle) out.push("L'ANGLE", round.briefing_angle, '')

  const renderQuestions = (title: string, list: BriefingQuestion[]) => {
    if (list.length === 0) return
    out.push(title)
    list.forEach((item, i) => {
      out.push(`${i + 1}. ${item.text}`)
      if (item.intent) out.push(`   Intention : ${item.intent}`)
      for (const sub of item.sub_questions ?? []) out.push(`   ↳ ${sub}`)
      out.push('')
    })
  }
  renderQuestions('LES QUESTIONS À POSER', pressing)
  renderQuestions('SI LA CONVERSATION S’OUVRE', opportunistic)

  if (objections.length > 0) {
    out.push('LES OBJECTIONS PROBABLES')
    for (const o of objections) {
      out.push(`• ${o.likely}`)
      if (o.frame) out.push(`  Réponse : ${o.frame}`)
    }
    out.push('')
  }

  if (doNot.length > 0) {
    out.push('À NE PAS FAIRE')
    for (const d of doNot) out.push(`• ${d}`)
    out.push('')
  }

  if (round.briefing_win_condition) {
    out.push('LA CONDITION DE VICTOIRE', round.briefing_win_condition)
  }

  return out.join('\n').trim()
}
