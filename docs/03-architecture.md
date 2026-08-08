# 03 — Architecture

## Stack

Next.js (App Router — **version à ruptures, lire `node_modules/next/dist/docs/`
avant d'écrire du code**), TypeScript, Tailwind v4, Supabase, SDK Anthropic,
déployé sur Vercel Pro.

Tests : runner natif de Node via `tsx --test`. `npm run test:scoring` — **203
tests** à ce jour. Aucun framework de test, aucune dépendance ajoutée pour ça.

## Groupes de routes

```
app/
  (auth)/        login, signup
  (onboarding)/  onboarding
  (app)/         ne contient plus que des redirections vers /lab
  (lab)/         le produit — layout qui vérifie session + profil vendeur
  b/[token]/     le briefing partagé, public par jeton, sans session
  api/
```

`app/(lab)/layout.tsx` est la porte d'entrée : pas de session → `/login`,
pas de profil vendeur → `/onboarding`.

## Les modules de `lib/`

**Le moteur**
| Fichier | Rôle |
|---|---|
| `scoring.ts` | Portes, poids, plafonds de preuve, prescriptions, momentum, note globale |
| `types.ts` | Types de données et libellés **anglais** utilisés dans les prompts |
| `voice-credit.ts` · `voice-weights.ts` | Qui parle, ce que ça vaut, calcul du niveau de preuve |
| `criterion-definitions.ts` | Ce que chaque critère demande et ce qui compte comme preuve — **envoyé au modèle** |
| `deal-rounds.ts` | Héritage entre rounds, état d'un round, prochaine étape |
| `criterion-history.ts` | L'historique d'un critère, lu depuis les rounds existants |
| `round-changes.ts` | Ce qui a changé depuis le round précédent, et les plus gros risques |
| `round-focus.ts` | La phrase du round — l'hypothèse écrite, sinon l'objectif composé. Lue par le deal **et** par Mission Control |

**Le socle et l'adéquation**
| Fichier | Rôle |
|---|---|
| `playbook.ts` | Le socle A1–A7, sa normalisation, sa mise en contexte |
| `playbook-fit.ts` | Les cinq axes d'adéquation, la liste à fuir, la couverture des rôles |
| `playbook-extract.ts` · `scrape.ts` | Import depuis un site ou un document |

**Le portefeuille**
| Fichier | Rôle |
|---|---|
| `mission-control.ts` | Les actions de la semaine, la position de chaque deal |
| `bubble-layout.ts` | La séparation des points sur la carte |
| `deal-outcome.ts` | Les raisons de clôture, rattachées chacune à une porte |

**La conversation**
| Fichier | Rôle |
|---|---|
| `transcript-formats.ts` | VTT, SRT, JSON, CSV, DOCX, texte → « Locuteur : ce qu'il a dit » |
| `attendees.ts` | Qui sera dans la pièce, et ce que chaque rôle peut trancher |
| `seller-read.ts` | La perception du vendeur, et son écart avec les preuves |

**L'affichage**
| Fichier | Rôle |
|---|---|
| `i18n/translations.ts` | **La seule source des libellés affichés** |
| `lab-view.ts` | `criterionLabel`, `gateName`, `gateQuestion` — lisent la table de traductions |
| `plain-text.ts` | Retire le markdown des réponses des copilotes |
| `text.ts` | Découpe en phrases entières, sans couper dans un décimal |

**Règle de nommage à ne pas confondre :** `VARIABLE_LABELS` et `LAYER_LABELS`
dans `types.ts` sont en **anglais** et servent aux prompts. Les libellés
affichés viennent **toujours** de la table de traductions, via `lab-view.ts`.
Renommer un critère se fait dans la table ; toucher aux libellés anglais change
ce que le modèle comprend.

## Les routes IA

| Route | Modèle | Ce qu'elle fait |
|---|---|---|
| `ai/briefing` | sonnet | Hypothèse du round, angle, questions, objections, condition de victoire |
| `ai/suggest-scores` | sonnet | Note les critères et attribue chaque propos à son auteur |
| `ai/parse-transcript` | sonnet | Mappe un transcript aux questions du briefing, identifie les intervenants |
| `ai/read` | sonnet | La lecture du round et l'objectif suivant |
| `ai/update-boxes` | sonnet | Met à jour la base de connaissance du deal |
| `ai/playbook-fit` | sonnet | Les cinq axes d'adéquation au socle |
| `ai/copilot` | sonnet | Répond sur **un** deal |
| `ai/portfolio` | sonnet | Répond sur **tout le portefeuille** |
| `ai/translate` | haiku | Traduction de contenu |
| `context/*` · `playbook/*` | sonnet / haiku | Import depuis site, document, LinkedIn |

Toutes déclarent `maxDuration = 300` et enregistrent leur consommation
(`recordUsage`).

## Le modèle de données

**`vendors`** — l'entreprise du vendeur, son `playbook` (jsonb), sa langue,
son rôle, son équipe.

**`deals`** — le prospect, ses contacts principaux, `prospect_dimensions`
(le contexte prospect, jsonb), `playbook_fit` (jsonb), `status`, et l'issue :
`close_reasons` (text[]), `close_round`, `closed_at`, `close_note`.

**`deal_rounds`** — un round. Les vingt colonnes de score, plus
`evidence_levels`, `authority_levels`, `rationales`, `declarations`,
`capture_notes`, `capture_speakers`, `seller_read`, et le briefing
(`briefing_hypothesis`, `briefing_line`, `briefing_angle`,
`briefing_questions`, `briefing_objections`, `briefing_do_not`,
`briefing_win_condition`, `briefing_attendees`, `briefing_share_token`).

**`deal_stakeholders`** — les personnes du deal, avec leurs `actor_types`.
C'est ce que lit la couverture des rôles.

**`ai_usage`** — consommation par route, par utilisateur, par deal.

## Ce qui n'a jamais été écrit

`prospect_dimensions` n'est écrit que par l'éditeur de contexte. Aucun chemin
de briefing, de capture ou de notation n'y touche — vérifié en listant toutes
les écritures vers `deals`. C'est utile à savoir quand un contexte semble avoir
disparu : ce n'est pas une écriture, c'est un affichage ou une donnée jamais
saisie.
