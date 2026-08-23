# Roguelike Magic simplifié — Document de vision & systèmes (v1)

*Projet personnel — non destiné à être partagé publiquement (cartes/API MTG réelles).*

## Pitch

Un booster draft de vraies cartes Magic (Bloomburrow pour commencer), puis une aventure roguelike où le combat reprend l'ADN Magic (créatures, mots-clés, couleurs) mais simplifié façon Mindbug/Hearthstone : plus de mana à payer en terrain, plus de pile/priorité, plus d'instants.

## Structure d'un run

- Un run = une extension entière.
- 3 niveaux, chacun clos par un boss.
  - Boss 1 et 2 : générés aléatoirement parmi les 10 archétypes de l'extension, de plus en plus forts.
  - Boss 3 (final) : regroupe presque toutes les meilleures cartes synergiques de l'extension.
- Carte de progression façon Slay the Spire entre les combats (choix de chemin, événements, boutiques).
- Battre le boss du niveau 3 débloque l'extension suivante — **en plus**, pas à la place : toutes les extensions débloquées restent choisissables à chaque nouveau run (utile pour farmer de l'XP sur une extension déjà maîtrisée).
- Il est structurellement impossible de terminer une extension dès la toute première run (voulu, façon Hades/Rogue Legacy — l'échec fait progresser via la méta plutôt que de punir sèchement).

## Draft initial

- Avant le run : draft façon booster draft classique sur l'extension choisie, construit le deck de départ.
- Pas de terrain à drafter (inutile avec notre système de mana automatique).
- **[OUVERT]** Nombre de packs/picks à définir une fois la taille de deck cible fixée.

## Combat

- **Mana** : commence à 1, +1 par tour, plafond de départ à 5 (augmentable *pendant le run* via boutique/événements, coûteux). Une carte reste injouable si le mana dispo est insuffisant — c'est un vrai choix de boutique (dépenser son or sur le plafond plutôt que sur des cartes).
- **Main** : 7 cartes de départ (augmentable), puis pioche supplémentaire tous les 2 tours — commence à 1 pioche suppl. max par combat, jusqu'à 3 via méta-progression.
- Le deck est **entièrement remélangé à chaque nouveau combat** (pas d'épuisement progressif sur toute la durée du run).
- Plusieurs cartes jouables par tour tant que le mana disponible le permet.
- **Ciblage d'attaque (asymétrique, volontaire)** :
  - Le bot ne peut **pas** attaquer le joueur tant qu'il reste au moins une créature du joueur en jeu (attaque une créature au hasard, sinon le joueur).
  - Le joueur choisit librement : attaquer une créature adverse **ou** l'adversaire directement, même s'il reste des créatures adverses en jeu. Risque assumé : foncer au visage laisse le board adverse actif, qui continue de taper les créatures du joueur pendant ce temps.
- **Dégâts persistants** : les PV perdus par une créature ne se régénèrent *pas* entre les tours (contrairement au vrai Magic où les dégâts marqués s'effacent en fin de tour). L'endurance devient un vrai pool de vie qui s'épuise progressivement.
  - ⚠️ Nécessitera un recalibrage des stats importées depuis les vraies cartes Bloomburrow (un 4/4 qui encaisse indéfiniment 1 de dégât dans le vrai jeu mourra bien plus vite ici).
- **Victoire** : PV de l'adversaire à 0. **Défaite (dans un combat)** : main vide après les pioches sans avoir tué l'adversaire.

## Types de cartes

- **Créatures** : cœur du système. Mots-clés évergreens gardés (Vol, Piétinement, Toucher mortel, Lien de vie, Célérité, Vigilance, Menace, Initiative...) + capacités passives/activées/déclenchées sélectionnées au cas par cas et adaptées si besoin.
- **Rituels, Enchantements, Artefacts** : gardés tels quels.
- **Éphémères** : convertis en Rituels. Deux façons de payer la perte de la vitesse instantanée, au choix à chaque carte :
  - payer le coût **+1**, sans autre effet ;
  - ou payer le coût normal mais **hypothéquer 1 mana max pour le tour suivant** (façon Surcharge dans Hearthstone) — permet d'enchaîner plusieurs éphémères dans un tour explosif, au prix d'un tour suivant plus faible. Profite en particulier à Izzet/Loutres, qui a justement besoin de tours à forte densité de sorts.
- Pas de mot-clé "Provocation" maison : inutile, la règle d'attaque du bot le remplace nativement.

## Mots-clés & mécaniques retenus

**Évergreens** (portables tels quels) : Vol, Piétinement, Toucher mortel, Lien de vie, Célérité, Vigilance, Menace, Initiative, Portée, Indestructible, Changeling (pure métadonnée de type de créature, aucune règle à gérer).

**Mécaniques Bloomburrow retenues sans adaptation** :
- **Renfort (Offspring)** : coût additionnel à l'invocation ; crée un jeton copie 1/1 si payé.
- **Dépense (Expend N)** : compteur de mana total dépensé en sorts ce tour, déclenche au seuil.
- **Vaillance (Valiant)** : se déclenche quand une créature contrôlée est ciblée par un sort/capacité contrôlée, 1x/tour.
- **Fourrager (Forage)** : exiler 3 cartes du cimetière ou sacrifier un jeton Nourriture.
- **Don (Gift)** : coût additionnel optionnel, offre un bonus à l'adversaire en échange d'un effet amélioré (le bot reçoit sans choix à faire — aucune IA nécessaire).
- **Seuil (Threshold)** : simple vérification d'état (7+ cartes au cimetière).

**Mécaniques adaptées** :
- **Percée (Landfall)** : pas de terrains dans notre système → déclencheur de substitution, activé à chaque palier de mana atteint en début de tour (donc automatiquement les premiers tours d'un combat, jusqu'à ce que le plafond soit atteint).
- **Rappel (Flashback)** : gardé — nécessite une action de moteur générique "jouer depuis le cimetière" (coût alternatif, puis exil après résolution).

## Rareté = budget de puissance (repris directement de Magic)

- **Commune** : carte de base, peu/pas de mot-clé.
- **Uncommune** : capacité garantie, stats/coût modestes.
- **Rare** : bonnes stats + capacité déclenchée/passive/activée dans certains cas.
- **Mythique** : cartes ultimes d'archétype.

## Économie intra-run

- Or gagné pendant le run (commence à 0 par run, montant de départ augmentable en méta-jeu).
- Boutiques/événements : achat de cartes, boosters, augmentation du plafond de mana, regain de PV.
- PV : pool unique de 100 au début du run, les dégâts pris persistent entre les combats (façon Slay the Spire), regagnables uniquement via événements/lieux dédiés.

## Défaite de combat

- Perte d'un combat = **-20 PV max fixes** (100→80→60...), pas seulement les PV actuels.
- Possibilité de retenter le combat perdu autant de fois que voulu, au risque de reperdre 20 PV max à chaque nouvel échec.
- Lot de consolation à chaque défaite : 2 couleurs tirées au hasard parmi les 5, puis choix d'1 carte parmi 3 proposées dans ces couleurs, ajoutée au deck — une petite chance de progresser même en cas d'échec.

## Méta-progression (entre les runs)

- Monnaie séparée : **XP**, gagnée en terminant un run, qu'il soit gagné ou perdu.
- L'XP se cumule en niveaux ; chaque niveau donne "un petit quelque chose".
  - **[OUVERT]** Contenu exact des paliers de niveau — mis de côté pour l'instant.
- Ce que la méta-progression permet d'augmenter (coûteux) : plafond de mana de départ, main de départ, nombre de pioches suppl. par combat (1→3), or de départ (0→X).
- Toutes les extensions débloquées restent jouables à volonté (pas de progression forcée) — permet de refaire une extension déjà maîtrisée pour farmer de l'XP.

## Édition de lancement : Bloomburrow

- 10 archétypes bicolores centrés sur un type de créature/animal, orientation créatures/triggers plutôt que contrôle par éphémères — cohérent avec un système sans pile/priorité.
- Pas de feuille bonus dans ce set → moins de bombes disruptives, environnement plus stable pour un premier jeu.
- 281 cartes (81 communes / 100 inco / 60 rares / 20 mythiques + 20 terrains, terrains inutiles ici) → pool utile d'environ 261 cartes, taille gérable pour un premier jet.

## Mapping des 10 archétypes Bloomburrow

| Paire | Animal | Mécanique | Portabilité |
|---|---|---|---|
| Azorius (WU) | Oiseaux | Buff des non-volants par les volants | ✅ aucun souci |
| Dimir (UB) | Rats | Seuil | ✅ aucun souci |
| Rakdos (BR) | Lézards | Déclencheurs de perte de vie, agressif | ✅ aucun souci |
| Gruul (RG) | Ratons laveurs | Dépense | ✅ aucun souci |
| Selesnya (GW) | Lapins | Jetons / Renfort, va-large | ✅ portable — ⚠️ à surveiller à l'équilibrage (archétype fort) |
| Orzhov (WB) | Chauves-souris | Gain/perte de vie, réanimation par PV | ✅ aucun souci |
| Golgari (BG) | Écureuils | Fourrager | ✅ aucun souci |
| Simic (GU) | Grenouilles | Triggers d'entrée en jeu, rebond/clignotement | ✅ aucun souci — valide le choix de garder les ETB |
| Boros (RW) | Souris | Vaillance | ✅ aucun souci |
| Izzet (UR) | Loutres | Sorts non-créatures (façon Prowess) | ✅ résolu via le choix de paiement Surcharge sur les éphémères |

## Points encore ouverts (à trancher en phase contenu/équilibrage)

- Rescaling des coûts de mana réels (plafond de départ à 5 vs cartes à 6-7+ dans le vrai jeu).
- Force de l'archétype Blanc-Vert (tokens) à surveiller à l'équilibrage.
- Rareté max des cartes du lot de consolation de défaite (mythique autorisée ou plafonnée ?).
- Détail des paliers de niveau méta ("le petit quelque chose" par niveau).
- Nombre de packs/picks au draft initial, taille de deck cible.
- Nombre de combats/événements normaux entre les boss au sein d'un niveau.
- Plancher de l'hypothèque de mana (la Surcharge peut-elle faire descendre le plafond du tour suivant en dessous de 1 ?).
