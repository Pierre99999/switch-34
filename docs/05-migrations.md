# 05 — Migrations SQL

Supabase n'a pas de mécanisme de migration branché sur ce projet : les fichiers
`.sql` à la racine se passent **à la main** dans le SQL Editor. Toutes sont
additives et rejouables (`if not exists`).

## Ordre et statut

| Fichier | Ce qu'elle ajoute | Statut |
|---|---|---|
| `migration-sales-challenge.sql` | Le défi commercial déclaré à l'onboarding | passée |
| `migration-playbook.sql` | `vendors.playbook` — le socle A1–A7 | passée |
| `migration-playbook-fit.sql` | `deals.playbook_fit` | passée |
| `migration-capture-speakers.sql` | `deal_rounds.capture_speakers` | passée |
| `migration-feedback-archived.sql` | Statut des retours de testeurs | passée |
| `migration-seller-read.sql` | `deal_rounds.seller_read` | passée |
| `migration-focus-objective.sql` | `deal_rounds.focus_objective` | passée |
| `migration-deal-outcome.sql` | `close_reason`, `close_round`, `closed_at`, `close_note` | passée |
| `migration-deal-outcome-multi.sql` | `close_reasons` (text[]) remplace le singulier | **à vérifier** |
| `migration-briefing-share.sql` | `briefing_share_token` + index unique | **à vérifier** |
| `migration-briefing-attendees.sql` | `briefing_attendees` (jsonb) | **à vérifier** |
| `migration-momentum-budget-competition.sql` | `budget`, `competition` | **à vérifier** |
| `migration-briefing-hypothesis.sql` | `briefing_hypothesis` | **à vérifier** |

Les fichiers marqués « à vérifier » ont été écrits en fin de session ; leur
passage en base n'a pas été confirmé. Les rejouer ne coûte rien.

## Réparations et diagnostics

Ce ne sont pas des migrations : ils corrigent ou inspectent des données.

| Fichier | À quoi il sert |
|---|---|
| `repair-round-inheritance.sql` | Remplit les rounds créés vides avant que l'héritage soit corrigé |
| `check-deal-data.sql` | Lecture seule — distingue « la donnée est perdue » de « l'écran ne l'affiche pas » |

## Comment reconnaître qu'une migration manque

Les écritures applicatives vérifient leur erreur et nomment le fichier :
« La migration migration-briefing-attendees.sql n'a pas été passée sur la
base. » Si un message évoque le *schema cache* de Supabase, c'est le même
symptôme.

## En ajouter une

1. Un fichier `migration-<sujet>.sql` à la racine, avec un commentaire en tête
   qui dit **pourquoi**, pas seulement quoi.
2. `add column if not exists` — additif, rejouable.
3. Ne jamais supprimer une colonne qui porte de l'historique : la retirer des
   poids ou des types suffit à la neutraliser.
4. L'ajouter au tableau ci-dessus.
5. La donner à Pierre **en SQL brut dans la réponse**, pas comme un chemin de
   fichier : il la colle dans le SQL Editor.
