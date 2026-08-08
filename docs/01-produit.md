# 01 — Le produit

## Ce qu'est Switch

Switch est le compagnon logiciel de la méthode de vente de Pierre Gaubil,
exposée dans son livre *Pourquoi les meilleurs vendeurs ne vendent pas*.

Ce n'est pas un CRM. Un CRM enregistre ce qu'un vendeur croit ; Switch
enregistre **ce qui a été dit**, par qui, et refuse de noter le reste. La
différence tient en une règle appliquée partout dans le code : *pas de score
sans preuve capturée, pas de verdict sans socle, pas de pronostic*.

Le produit fait quatre choses :

1. **Le Sales Playbook** — le socle du vendeur (A1 à A7) : ce qu'il vend, à
   qui, contre qui, les objections de perception, les rôles nécessaires, les
   questions incontournables, les post-mortems.
2. **Le diagnostic par deal** — trois portes séquentielles et un momentum
   parallèle, vingt critères, notés uniquement à partir de conversations
   capturées.
3. **Le briefing** — ce que la prochaine conversation doit établir, écrit à
   partir du diagnostic, du socle et des personnes présentes.
4. **Mission Control** — le portefeuille : ce qu'il faut faire cette semaine,
   où chaque deal se situe, et un copilote qui répond sur l'ensemble.

## Pour qui

- **Le commercial** — travaille ses deals, importe ses transcripts, lit ses
  briefings.
- **Le directeur commercial** — détient le Sales Playbook, invite les
  commerciaux, voit le pipeline de l'équipe.
- **L'administrateur** — une seule adresse, `pierre@34elements.com`, en dur
  dans `lib/admin-config.ts`. Statistiques d'usage, retours des testeurs,
  gestion des comptes.

## L'histoire des deux interfaces

Il faut la connaître pour lire le code sans se tromper.

**Jusqu'en août 2026**, l'application avait une navigation horizontale et un
deal réparti sur cinq écrans : contexte, tableau de bord, briefing,
conversation, zones. Ça fonctionnait, mais chaque écran demandait de
reconstituer mentalement l'état du deal.

**Le « lab »** a été construit à côté, sur le même moteur et la même base :
un écran unique par deal, avec un copilote à gauche et un panneau de
connaissance à droite. Il a vécu quelques jours réservé à l'adresse admin, le
temps d'être complété.

**Depuis, le lab est la seule interface.** Les anciennes routes redirigent
vers les nouvelles — les signets, les liens partagés et les retours de
testeurs enregistrés contre `/pipeline` ou `/deals/:id/dashboard` résolvent
toujours. Le groupe de routes `app/(app)/` ne contient plus que des
redirections.

**Conséquence pratique :** un fichier sous `app/(lab)/` n'est pas
expérimental. C'est le produit. Le préfixe `/lab` dans les URL est un vestige
qu'on n'a pas encore retiré.

## Les écrans d'aujourd'hui

| Écran | Route | Ce qu'il fait |
|---|---|---|
| Mission Control | `/lab` | Le portefeuille : questions, actions de la semaine, carte, deals clos |
| Le deal | `/lab/deals/:id` | Écran unique : hypothèse du round, portes, copilote, timeline, connaissance |
| Contexte prospect | `/lab/deals/:id/context` | L'éditeur de ce que le prospect dit de lui-même |
| Nouveau deal | `/lab/deals/new` | Nom, site ou document, contacts, CA |
| Sales Playbook | `/lab/playbook` | Le socle A1–A7 |
| Équipe | `/lab/team` | Code d'invitation, membres — directeurs uniquement |
| Admin | `/lab/admin` | Réservé à l'adresse admin |
| Briefing partagé | `/b/:token` | Le briefing seul, sans connexion — mobile, impression, lien privé |

## Déploiement

- **Repo** : `scorejam`, GitHub `Pierre99999/switch-34`
- **Hébergement** : Vercel Pro — `switch-34.vercel.app`
- **Base** : Supabase (auth, RLS, colonnes applicatives)
- **Modèles** : `claude-sonnet-4-6` pour les routes lourdes,
  `claude-haiku-4-5-20251001` pour l'extraction légère
- **Durée max des routes IA** : 300 s (`maxDuration`, permis par Vercel Pro)
