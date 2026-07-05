import type { Locale } from './translations'
import type { ProspectDimensions } from '@/lib/types'

type SubQ = { key: string; label: string; hint: string }
export type ContextDimDef = { key: keyof ProspectDimensions; label: string; questions: SubQ[] }

const DIMENSIONS_EN: ContextDimDef[] = [
  {
    key: 'company', label: '1 · Company',
    questions: [
      { key: 'core_business', label: 'Core business', hint: 'What they do, their main product or service, business model.' },
      { key: 'industry', label: 'Industry & market', hint: 'Sector, competitive environment, market they operate in.' },
      { key: 'size_stage', label: 'Size & stage', hint: 'Headcount, revenue signals, growth phase, funding status.' },
      { key: 'geography', label: 'Geography', hint: 'HQ, regions, markets served, operating model.' },
    ],
  },
  {
    key: 'strategic_context', label: '2 · Strategic Context',
    questions: [
      { key: 'priorities', label: 'Strategic priorities', hint: 'What they are focused on — growth, efficiency, compliance, transformation.' },
      { key: 'challenges', label: 'Known challenges', hint: 'Operational pain points, recurring problems, friction areas.' },
      { key: 'recent_signals', label: 'Recent signals', hint: 'News, announcements, leadership changes, new initiatives.' },
      { key: 'pressures', label: 'Pressures', hint: 'Regulatory, competitive, financial, or market pressures.' },
    ],
  },
  {
    key: 'buying_environment', label: '3 · Buying Environment',
    questions: [
      { key: 'decision_process', label: 'Decision process', hint: 'How buying decisions are made, approval layers, stakeholders involved.' },
      { key: 'budget_signals', label: 'Budget signals', hint: 'Budget cycle, existing tools spend, procurement style.' },
      { key: 'timeline', label: 'Timeline', hint: 'Known deadlines, board commitments, fiscal pressures, urgency triggers.' },
      { key: 'history', label: 'History with similar solutions', hint: 'Have they tried before? Switched vendors? Failed implementations?' },
    ],
  },
  {
    key: 'key_contact', label: '4 · Key Contact',
    questions: [
      { key: 'role_accountability', label: 'Role & accountability', hint: 'What they own, what they are measured on, what keeps them up at night.' },
      { key: 'background', label: 'Background', hint: 'Career history, domain expertise, how long in role.' },
      { key: 'personal_priorities', label: 'Personal priorities', hint: 'What they care about given their position — visibility, risk, performance.' },
      { key: 'influence_level', label: 'Influence level', hint: 'Their authority in the buying process — champion, gatekeeper, decision maker?' },
    ],
  },
  {
    key: 'fit_signals', label: '5 · Fit Signals',
    questions: [
      { key: 'problem_mapping', label: 'Problem mapping', hint: 'Which of their problems map to what you solve?' },
      { key: 'implementation_readiness', label: 'Implementation readiness', hint: 'Org capacity, tech stack, change tolerance, bandwidth.' },
      { key: 'timing_trigger', label: 'Timing trigger', hint: 'Is there a real trigger for action now? What makes this urgent?' },
    ],
  },
]

const DIMENSIONS_FR: ContextDimDef[] = [
  {
    key: 'company', label: '1 · Entreprise',
    questions: [
      { key: 'core_business', label: 'Activité principale', hint: 'Ce qu\'ils font, leur produit ou service principal, modèle économique.' },
      { key: 'industry', label: 'Industrie et marché', hint: 'Secteur, environnement concurrentiel, marché adressé.' },
      { key: 'size_stage', label: 'Taille et stade', hint: 'Effectifs, signaux de revenus, phase de croissance, financement.' },
      { key: 'geography', label: 'Géographie', hint: 'Siège, régions, marchés desservis, modèle opérationnel.' },
    ],
  },
  {
    key: 'strategic_context', label: '2 · Contexte stratégique',
    questions: [
      { key: 'priorities', label: 'Priorités stratégiques', hint: 'Sur quoi ils se concentrent — croissance, efficacité, conformité, transformation.' },
      { key: 'challenges', label: 'Défis connus', hint: 'Points de friction opérationnels, problèmes récurrents, zones de friction.' },
      { key: 'recent_signals', label: 'Signaux récents', hint: 'Actualités, annonces, changements de direction, nouvelles initiatives.' },
      { key: 'pressures', label: 'Pressions', hint: 'Pressions réglementaires, concurrentielles, financières ou de marché.' },
    ],
  },
  {
    key: 'buying_environment', label: '3 · Environnement d\'achat',
    questions: [
      { key: 'decision_process', label: 'Processus de décision', hint: 'Comment les décisions d\'achat sont prises, niveaux d\'approbation, parties prenantes impliquées.' },
      { key: 'budget_signals', label: 'Signaux budget', hint: 'Cycle budgétaire, dépenses outils existants, style d\'achat.' },
      { key: 'timeline', label: 'Calendrier', hint: 'Échéances connues, engagements board, pressions fiscales, déclencheurs d\'urgence.' },
      { key: 'history', label: 'Historique avec des solutions similaires', hint: 'Ont-ils déjà essayé ? Changé de fournisseur ? Implémentations échouées ?' },
    ],
  },
  {
    key: 'key_contact', label: '4 · Contact clé',
    questions: [
      { key: 'role_accountability', label: 'Rôle et responsabilités', hint: 'Ce qu\'ils gèrent, sur quoi ils sont évalués, ce qui les empêche de dormir.' },
      { key: 'background', label: 'Parcours', hint: 'Historique de carrière, expertise domaine, ancienneté dans le poste.' },
      { key: 'personal_priorities', label: 'Priorités personnelles', hint: 'Ce qui les intéresse vu leur position — visibilité, risque, performance.' },
      { key: 'influence_level', label: 'Niveau d\'influence', hint: 'Leur autorité dans le processus d\'achat — champion, gardien, décideur ?' },
    ],
  },
  {
    key: 'fit_signals', label: '5 · Signaux d\'adéquation',
    questions: [
      { key: 'problem_mapping', label: 'Cartographie des problèmes', hint: 'Lesquels de leurs problèmes correspondent à ce que vous résolvez ?' },
      { key: 'implementation_readiness', label: 'Maturité d\'implémentation', hint: 'Capacité orga, stack technique, tolérance au changement, bande passante.' },
      { key: 'timing_trigger', label: 'Déclencheur de timing', hint: 'Y a-t-il un vrai déclencheur pour agir maintenant ? Qu\'est-ce qui rend cela urgent ?' },
    ],
  },
]

export function getContextDimensions(locale: Locale): ContextDimDef[] {
  return locale === 'fr' ? DIMENSIONS_FR : DIMENSIONS_EN
}
