# 04 — Décisions

Le document le plus important du dossier. Chaque entrée dit **ce qui a été
décidé** et **pourquoi**, pour qu'on ne défasse pas par ignorance ce qui a été
fait exprès.

---

## Méthode

### On ne prédit jamais l'issue

Aucun pourcentage de signature, aucun « impact attendu +0,8 », aucun revenu
espéré. Un maquettage l'a proposé deux fois ; les deux fois, c'était le chiffre
le plus rassurant de l'écran et le seul que rien ne sait produire.

À la place : **ce que l'action débloque** (la porte qui l'attend, le critère
qui ne repose que sur une voix), et sur la carte, **la note du diagnostic sur
5**. Un test échoue si un delta chiffré réapparaît dans les actions.

### Le plafond de preuve n'est pas négociable

Une voix plafonne à 2,5. C'est ce qui empêche une porte de se franchir sur de
l'enthousiasme. Chaque fois qu'un critère « ne se remplit jamais », la
tentation est de baisser le plafond ; la bonne réponse a toujours été
ailleurs — dans ce que le prompt disait du critère.

### Les portes sont séquentielles pour le verdict, pas pour la preuve

Ce qui a été dit sur l'impact au round 1 est une preuve du round 1. La retenir
ne protège pas le diagnostic, elle cache ce que le prospect a dit.

### Un blanc est une information

Une capture laissée vide dit « ça n'a pas été abordé » — c'est une zone
aveugle, que le briefing suivant ira chercher. Une case remplie de mémoire pour
faire bonne figure ne dit rien. Les écrans de capture le rappellent.

### Les freins de momentum se notent en santé

5 = exploré et propre, 0 = jamais exploré. Un frein non exploré compte zéro.
Inverser cette convention retournerait tout le score de momentum sans que ça se
voie ; deux tests la verrouillent.

---

## Produit

### Une seule source, deux rendus

Règle appliquée systématiquement : jamais deux copies d'un écran ou d'un
libellé. Le corps du briefing est partagé entre la fenêtre et la feuille
imprimable ; les libellés viennent de la table de traductions ; le playbook,
l'admin et l'équipe sont des composants rendus par deux cadres.

Ce n'est pas de l'élégance : deux copies divergent en six mois, et le bug se
corrige d'un côté seulement.

### Le briefing est écrit pour une pièce, pas pour un contact

Créer un briefing commence par « Qui allez-vous rencontrer ? ». **Rien n'est
pré-coché**, pas même la personne du round précédent : une case pré-cochée se
répond en ne la lisant pas, et tout l'intérêt est que la réponse change.

Le moteur reçoit aussi **qui n'est pas là** — pour ne pas construire la
conversation autour de ce que seul l'absent pourrait trancher.

### Un round est un pari

« Prochain focus » est devenu « L'hypothèse du round » : *« Si X reconnaît…,
alors… »*. Le prompt exige une phrase **falsifiable**. C'est ce qui rend la
capture suivante décisive — l'hypothèse tient ou ne tient pas.

### La phrase du round est calculée une fois, affichée deux fois

`lib/round-focus.ts` produit l'hypothèse écrite par le moteur, et à défaut
l'objectif composé à partir des prescriptions. Le deal et Mission Control la
lisent tous les deux.

Avant, chacun répondait de son côté à « à quoi sert ce round ». Sur le même
deal, le même jour, le deal affichait *« Ouvrir problème business réel et
ouvrir raison impérieuse. »* et la semaine *« Faire entrer CEO dans la
boucle »* : deux vérités sur un round, sans moyen de savoir laquelle la
méthode voulait dire.

L'action reste sous la phrase dans Mission Control — c'est la porte d'entrée,
pas le but. **Ne pas remettre le titre d'action en ligne principale** : il
sort identique sur trois deals à la fois et cesse d'être lu au deuxième.

### L'issue d'un deal se capture à la clôture

Les scores et les patterns se recalculent ; **pourquoi un deal est mort
n'existe que dans la tête du vendeur ce jour-là**. D'où les raisons
obligatoires, multiples, chacune rattachée à une porte — pour qu'à trente
deals, « quelle porte cède le plus souvent chez toi » soit une requête SQL et
pas une relecture de texte libre.

### Le message qui ne dit rien abîme les messages qui disent quelque chose

La pop-up d'accueil ne parle que si le deal a quelque chose à dire. Avant la
première capture, elle se tait : elle ne pouvait qu'énoncer ce que l'écran
montrait déjà. Une boîte qu'on apprend à fermer sans lire, on la fermera aussi
le jour où elle compte.

### Trois risques au maximum

Une liste de risques qu'on ne finit pas de lire ne protège de rien.

---

## Interface

### Le lab est devenu le produit

Les anciennes routes redirigent au lieu de disparaître : signets, liens
partagés et retours de testeurs continuent de résoudre.

**Avant de supprimer un écran, vérifier ce qu'il portait d'unique.** Deux fois
une fonctionnalité a failli partir en silence avec son écran : la perception du
vendeur (déplacée dans les deux chemins de capture) et la clôture d'un deal
(déplacée sur l'écran du deal). C'est le piège le plus coûteux du projet.

### Une carte où une bulle en cache une autre est pire qu'une liste

Elle ne se contente pas d'omettre un deal, elle fait croire qu'on les a tous
vus. D'où la passe de séparation, déterministe, avec un test qui vérifie que le
décalage ne fait jamais changer un deal de quadrant.

### L'avancement compte les portes franchies, pas les rounds tenus

Un deal à sa cinquième conversation avec la porte 1 toujours ouverte n'a pas
avancé. Le pipeline est l'endroit où ce mensonge est le plus confortable.

### Les copilotes écrivent en prose

Consigne dans le prompt **et** nettoyage à la sortie. La consigne seule dérive
dès que la réponse se structure.

### Pas d'emoji dans l'interface

Un emoji en couleur porte sa propre couleur et son propre dessin : il ne se
rend pas pareil sur deux machines et devient un autocollant posé sur l'écran.
La règle était déjà écrite dans `LabSidebar` — icônes tracées en SVG, qui
héritent de la couleur et de l'épaisseur du texte. Mission Control ne la
suivait pas (👋 ⚡ 👤 ⚠ 📊), la timeline et les boutons du briefing non plus.

Quand une icône n'ajoute rien à une phrase qui se lit déjà, **elle disparaît**
plutôt que d'être redessinée. Les glyphes monochromes des portes (`◎ ◈ ◆ ◇`)
et de la timeline restent : ils distinguent des choses, ils ne décorent pas.

### Mission Control et le deal partagent la même carte, au pixel

Même bordure, même ombre d'un pixel, même rythme : petite étiquette
capitalisée, puis le contenu. **Ce qui est grand sur la page est ce qu'il faut
lire** — la phrase du round — jamais le mobilier autour. Les lignes de la
semaine reprennent exactement le rythme du deal : le prospect en étiquette, la
phrase en gras, l'action en gris dessous.

Les classes de la carte vivent dans `components/lab/cards.ts` : deux écrans
d'un même produit ne doivent pas diverger sur ce qu'est une carte. Ni l'une ni
l'autre ne porte de padding — le copilote est plus dense qu'une section de
Mission Control.

### La carte à qui l'on parle se voit avant d'être lue

`CARD_TALK` : bordure bleue de deux pixels et halo autour. Le copilote du deal
l'avait déjà ; « Que voulez-vous savoir ? » la prend aussi. C'est le seul
endroit de chaque écran qui **répond quand on y écrit**, et un champ de saisie
dans une carte grise ressemble à un filtre. Les autres sections gardent la
carte ordinaire : si tout est souligné, plus rien ne l'est.

### L'en-tête d'une section vient d'un seul composant

`components/lab/SectionLabel.tsx` : une icône **tracée** dans une pastille
bleu clair, le nom de la section en bleu, et au besoin une note grise après
lui. C'est l'en-tête de « L'hypothèse du round » ; les trois sections de
Mission Control le portent désormais aussi, chacune avec son icône — une bulle
pour la question posée au portefeuille, une case cochée pour ce qu'il faut
faire cette semaine, deux axes et trois points pour la carte.

Pourquoi une couleur et une icône ici, alors que les icônes ont été retirées
ailleurs : ces trois lignes **distinguent des sections**, elles ne décorent pas
une phrase déjà lisible. Le gris uniforme des étiquettes obligeait à lire les
trois pour trouver la bonne ; en bleu, avec une forme, l'œil arrive directement
sur « ce que je dois faire cette semaine ».

Le `◈` de l'hypothèse était un caractère typographique : il est maintenant
dessiné comme les autres, pour la raison habituelle — un glyphe ne se rend pas
pareil sur deux machines. Les glyphes des portes restent des caractères parce
qu'ils forment une famille de quatre qu'on lit ensemble.

### Une conversation passée se relit, elle ne se rouvre pas en formulaire

« Voir la capture » pointait vers `/deals/:id/capture`, l'écran de saisie de
l'ancienne interface : il quittait le lab et affichait un formulaire vide, car
il travaille sur le **round courant**, jamais sur le round cliqué dans la
timeline. Un round passé n'a plus rien à saisir — ce qu'on veut de lui, c'est
le lire.

`CaptureLetter` ouvre donc la capture par-dessus l'écran du deal, comme la
lettre de briefing : les questions du round, sous chacune ce qui a été dit,
les locuteurs du transcript, le champ libre, puis le ressenti du vendeur.
**Les questions restées sans réponse sont affichées en gris** plutôt que
masquées : un blanc est une information, et les cacher ferait passer toute
capture pour complète.

Règle générale derrière ce correctif : **un lien du lab vers `/deals/...`
est un bug**. Le lab est le produit ; l'ancienne interface ne partage ni sa
navigation ni son état.

---

## Sécurité

### Une seule adresse administrateur

`pierre@34elements.com`, en dur dans `lib/admin-config.ts`. Vérifiée **côté
serveur** dans les cinq routes `/api/admin/*` — c'est la vraie barrière — et
avant le rendu de la page. En dur volontairement : rien à mal configurer. Un
second administrateur demanderait un déploiement, pas un réglage.

### Le lien privé d'un briefing ne montre que le briefing

La page publique par jeton ne sélectionne que les colonnes du briefing : un
lien qui fuite ne peut révéler ni les notes, ni les preuves, ni les
conversations passées. Le jeton n'existe que si on le demande, et il est unique
par round — un briefing avec deux liens vivants est un briefing qu'on ne peut
pas révoquer.

---

## Technique

### Les écritures ne doivent pas échouer en silence

Deux écritures avalaient leur erreur ; quand la migration n'était pas passée,
la donnée paraissait perdue alors qu'elle n'avait jamais été écrite. **Toute
écriture applicative vérifie son erreur**, et le cas « colonne absente » nomme
la migration manquante.

### Les migrations sont additives

`add column if not exists`, jamais de suppression de colonne qui porte de
l'historique. `process_drag` a été retiré des poids mais garde sa colonne.

### Le format d'un transcript se normalise avant le modèle

Un `.docx` est une archive ZIP : lu en UTF-8, c'était du bruit binaire envoyé
au modèle, qui répondait quand même. Un VTT part avec deux tiers d'horodatages
payés et jamais lus. Tout est ramené à « Locuteur : ce qu'il a dit » avant
l'appel.
