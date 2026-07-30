// The opening question of onboarding: "what is hurting right now?"
//
// Testers told us the app asked for a lot of input before showing why any of it
// mattered. Naming the pain first lets every later screen answer "you are
// filling this in to fix X" — and each challenge maps to the part of the Switch
// method that addresses it.

export type SalesChallenge = {
  key: string
  label: { fr: string; en: string }
  // Shown right under the choice: what Switch does about it.
  answer: { fr: string; en: string }
}

export const SALES_CHALLENGES: SalesChallenge[] = [
  {
    key: 'ghosting',
    label: {
      fr: 'Des prospects engagés disparaissent du jour au lendemain',
      en: 'Engaged prospects go silent overnight',
    },
    answer: {
      fr: "Porte 1 sépare la curiosité d'une raison impérieuse : vous voyez à l'avance qui ne bougera pas.",
      en: 'Gate 1 separates curiosity from a compelling reason, so you see who was never going to move.',
    },
  },
  {
    key: 'stalled',
    label: {
      fr: 'Les cycles traînent, rien ne se décide',
      en: 'Deals stall and nothing gets decided',
    },
    answer: {
      fr: "Le momentum mesure l'avancement réel entre deux conversations, pas l'activité.",
      en: 'Momentum measures real progress between conversations, not activity.',
    },
  },
  {
    key: 'forecast',
    label: {
      fr: 'Mes prévisions ne ressemblent pas à la réalité',
      en: 'My forecast does not match reality',
    },
    answer: {
      fr: "Chaque score est plafonné par son niveau de preuve : un deal déclaré ne peut pas passer pour un deal vérifié.",
      en: 'Every score is capped by its evidence level, so a declared deal cannot pass as a verified one.',
    },
  },
  {
    key: 'status_quo',
    label: {
      fr: 'On perd face au statu quo, pas face à un concurrent',
      en: 'We lose to the status quo, not to a competitor',
    },
    answer: {
      fr: "Porte 2 teste l'urgence et le coût de l'inaction avant de parler solution.",
      en: 'Gate 2 tests urgency and the cost of inaction before any solution talk.',
    },
  },
  {
    key: 'wrong_people',
    label: {
      fr: 'Je parle aux mauvaises personnes, trop tard',
      en: 'I talk to the wrong people, too late',
    },
    answer: {
      fr: 'Le crédit de voix pondère ce que dit chaque contact selon son rôle réel dans la décision.',
      en: 'Voice credit weights what each contact says by their real role in the decision.',
    },
  },
]

export function challengeLabel(key: string | null, locale: string): string | null {
  if (!key) return null
  return SALES_CHALLENGES.find(c => c.key === key)?.label[locale === 'fr' ? 'fr' : 'en'] ?? null
}
