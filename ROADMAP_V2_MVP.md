# Jalon 2 — MVP (feuille de route)

⚠️ Ceci est une feuille de route, pas un prompt Claude Code prêt à l'emploi. À détailler en prompt complet (façon PROMPT_POC.md) une fois le POC validé et les gates du Jalon 1 cochées.

## Objectif

Une boucle de run complète et jouable de bout en bout : draft → progression sur une carte de run → 3 niveaux avec boss → victoire/défaite/game over, avec une vraie économie de boutique et des PV persistants entre combats.

## Contenu attendu

- Draft initial simplifié (quelques packs, un pick à la fois) construisant le deck de départ à partir du pool de cartes disponible (toujours `cards-poc.json`, étoffé à ~30 cartes pour avoir un vrai choix — pas encore l'import Bloomburrow réel).
- Carte de run façon Slay the Spire : nœuds de combat, boutique, événement simple, boss ; chemin avec embranchements.
- 3 niveaux, chacun clos par un boss (un seul boss fixe par niveau pour ce jalon — la génération aléatoire par archétype viendra à l'Alpha).
- Boutique : achat de cartes, de boosters, augmentation du plafond de mana en run, regain de PV.
- PV persistant sur 100 entre les combats du run (absent du POC, introduit ici).
- Défaite de combat : -20 PV max fixe, possibilité de retenter, lot de consolation (1 carte parmi 3 proposées dans 2 couleurs tirées au sort).
- 2-3 decks/IA de bot distincts pour varier les combats normaux.
- UI : écran titre, carte du run, HUD complet, écrans de victoire/défaite/game over, restart.

## Données nécessaires

- `cards-poc.json` étoffé (~30 cartes)
- Un fichier de config boutique (prix des augmentations de plafond de mana, prix des boosters, prix du regain de PV)
- Une config de carte de run (types de nœuds, structure des 3 niveaux)

## Gates de passage

- [ ] Un run complet (draft → 3 niveaux → victoire ou défaite finale) est jouable en 20-40 minutes
- [ ] La défaite d'un combat propose bien le choix de carte de consolation et permet de retenter
- [ ] Aucune règle de jeu n'est en dur, tout passe par les JSON
- [ ] Plusieurs runs testés, ressenti "on continue" confirmé

## Ce qu'on ne fait PAS encore

- Méta-progression inter-run (XP, niveaux, extensions débloquées)
- Import réel Bloomburrow / mécaniques spécifiques (Renfort, Dépense, Vaillance, Fourrager, Don, Seuil, Percée, Rappel)
- Génération aléatoire des boss par archétype
- Son, musique, animations poussées
