# Prompt Claude Code — Jalon 1 : POC

## Contexte du projet

Projet perso : roguelike de deckbuilding solo en React, inspiré de Magic: The Gathering mais simplifié façon Mindbug/Hearthstone (pas de mana-terrain, pas de pile/priorité, pas d'instants). Le stack technique et les conventions sont dans `CLAUDE.md` à la racine — le lire avant de commencer. Les règles de jeu complètes sont dans `docs/GAME_DESIGN.md`. Ce prompt ne couvre volontairement qu'une petite partie de ces règles (voir "Objectif" ci-dessous) — ne pas implémenter le reste maintenant, même si c'est documenté.

## Ce qui existe déjà

Rien. C'est le tout premier prompt, repo vide.

## Objectif de cette phase (POC — Jalon 1)

Valider qu'un unique combat de cartes est fun à jouer. Rien d'autre ne compte à ce stade.

**Explicitement HORS scope pour ce prompt** (documenté dans GAME_DESIGN.md pour plus tard, à ne PAS implémenter maintenant) : draft, boutique, carte du monde/niveaux/boss, méta-progression (XP, niveaux, extensions débloquées), import Scryfall réel, mécaniques Bloomburrow spécifiques (Renfort, Dépense, Vaillance, Fourrager, Don, Seuil, Percée, Rappel), règle de paiement Surcharge sur les éphémères, PV persistants entre combats (100 de départ).

## Spécifications détaillées

### Boucle de combat

- Un deck joueur fixe (10-15 cartes, voir "Fichiers de données") contre un deck bot fixe, chacun mélangé au début du combat.
- **Mana** : commence à 1, +1 par tour, plafond fixe à 5 pour ce POC (pas d'amélioration de plafond en boutique — hors scope).
- **Main** : 7 cartes de départ. +1 carte piochée tous les 2 tours, jusqu'à un maximum de 2 pioches supplémentaires pour ce POC (donc 9 cartes vues au total sur toute la durée du combat).
- Le joueur peut jouer plusieurs cartes par tour tant que le mana disponible le permet. Une carte dont le coût dépasse le mana restant est injouable (visuellement grisée).
- Cimetière : les cartes jouées ou les créatures détruites y vont. Purement pour l'affichage à ce stade — aucune mécanique n'en dépend encore (Seuil/Fourrager viendront plus tard).

### Créatures et combat

- Chaque créature a Force et Endurance. Les dégâts marqués **ne se réinitialisent pas** en fin de tour (persistent d'un tour à l'autre au sein du même combat, contrairement au vrai Magic) — une créature meurt quand ses dégâts marqués ≥ son Endurance.
- Mots-clés à supporter pour ce POC uniquement : **Vol**, **Piétinement** (l'excédent de dégâts après avoir tué la créature ciblée passe au joueur adverse), **Toucher mortel** (1 point de dégât suffit à tuer la cible).
- **Ciblage asymétrique** :
  - Le bot ne peut **pas** attaquer le joueur tant qu'il reste au moins une créature du joueur en jeu (le bot attaque alors une créature du joueur au hasard). S'il ne reste aucune créature joueur, le bot attaque le joueur directement.
  - Le joueur choisit librement sa cible à chaque attaque : une créature adverse **ou** l'adversaire directement, même s'il reste des créatures adverses en jeu.
- **Victoire** : PV de l'adversaire à 0. **Défaite** : main vide après les pioches (7 + jusqu'à 2 suppl.) sans avoir vaincu l'adversaire.
- PV fixes à 20 de chaque côté pour ce POC (pas le pool de 100 PV persistant entre combats — hors scope, c'est pour l'MVP).

### IA du bot

Minimale : à son tour, le bot joue toutes les créatures qu'il peut se permettre avec son mana disponible, puis attaque avec toutes ses créatures selon la règle de ciblage ci-dessus. Aucune logique plus poussée n'est nécessaire pour ce POC.

## Fichiers de données

### `data/cards-poc.json`

Cartes de test maison — **pas un import Scryfall**, ce sera fait dans une phase ultérieure dédiée. Voici le schéma et 3 exemples ; génère 8 à 10 cartes supplémentaires en suivant ce format, en couvrant des coûts de 1 à 5, en incluant au moins une carte avec Vol, une avec Piétinement, une avec Toucher mortel, et 1-2 Rituels simples (dégâts directs ou buff temporaire) :

```json
{
  "_meta": {
    "version": "1.0",
    "category": "cards",
    "description": "Cartes de test POC — pas de vraies cartes Magic, uniquement pour valider la boucle de combat",
    "balance_notes": "Force + Endurance combinées ≈ coût * 3, réparties selon le rôle de la carte (agressif = plus de Force, défensif = plus d'Endurance)"
  },
  "cards": [
    {
      "id": "sparrow_scout",
      "name": "Éclaireuse Moineau",
      "type": "creature",
      "cost": 1,
      "power": 1,
      "toughness": 1,
      "keywords": ["flying"],
      "text": "Vol.",
      "rarity": "common"
    },
    {
      "id": "bramble_brute",
      "name": "Brute des Ronces",
      "type": "creature",
      "cost": 3,
      "power": 4,
      "toughness": 3,
      "keywords": ["trample"],
      "text": "Piétinement.",
      "rarity": "uncommon"
    },
    {
      "id": "quick_strike",
      "name": "Frappe Rapide",
      "type": "sorcery",
      "cost": 2,
      "effect": "deal_damage",
      "value": 3,
      "text": "Inflige 3 dégâts à une créature ou un joueur ciblé.",
      "rarity": "common"
    }
  ]
}
```

## Architecture

- Respecter la structure de dossiers et le principe data-driven décrits dans `CLAUDE.md`.
- La logique de combat (mana, pioche, résolution, victoire/défaite) vit dans `/src/engine`, testable indépendamment de React (aucun import React dans ce dossier).
- `/src/components` ne fait que du rendu et de l'interaction (cliquer une carte, choisir une cible) — aucune règle de jeu écrite directement dans un composant.

## Critères de validation

- [ ] Un combat complet (début → victoire ou défaite) est jouable de bout en bout sans bug bloquant
- [ ] Le mana, la pioche, le jeu de cartes et le ciblage suivent exactement les règles ci-dessus
- [ ] Les dégâts persistent bien d'un tour à l'autre (pas de reset façon vrai Magic)
- [ ] Aucune valeur de carte n'est en dur dans le code — tout vient de `cards-poc.json`
- [ ] Interface minimale mais lisible : main, plateau joueur, plateau adverse, mana/PV visibles, sélection de cible claire au clic
