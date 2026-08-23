# Jalon 3 — Alpha (feuille de route)

⚠️ Feuille de route, pas un prompt Claude Code prêt à l'emploi. À détailler une fois le Jalon 2 (MVP) validé.

## Objectif

Tous les systèmes de gameplay du document de conception sont implémentés avec le vrai contenu Bloomburrow. Le jeu est "feature-complete" même si pas encore poli.

## Contenu attendu

- Import réel des cartes Bloomburrow via le script Scryfall (`cards-bloomburrow.json`, ~261 cartes utiles hors terrains).
- Toutes les mécaniques retenues : évergreens, Renfort, Dépense, Vaillance, Fourrager, Don, Seuil, Percée (déclencheur palier de mana), Rappel (jouer depuis le cimetière), règle de paiement Surcharge sur les éphémères.
- Les 10 archétypes Bloomburrow jouables et équilibrés en draft.
- Génération aléatoire des 3 boss selon les 10 archétypes (les 2 premiers ; boss final regroupant les meilleures cartes synergiques de l'extension).
- Méta-progression complète : XP gagné en fin de run (gagné ou perdu), niveaux, améliorations achetables (plafond de mana de départ, main de départ, pioches supplémentaires 1→3, or de départ).
- Sauvegarde persistante complète via Supabase (méta-progression + reprise d'une run en cours).
- Deuxième passe de balance — surveiller en particulier Sélesnya/Lapins, repéré comme potentiellement trop fort.
- SFX/musique placeholder (jeu de carte, attaque, victoire/défaite).

**Note d'adaptation** : le jalon Alpha du skill prévoit habituellement des "personnages/classes alternatifs jouables". Pas applicable tel quel ici puisqu'une seule extension est prévue pour l'instant — la variété vient des 10 archétypes internes à Bloomburrow plutôt que de classes séparées. Idem pour la "difficulté ascendante" : déjà couverte par l'escalade des 3 boss et la courbe de méta-progression, pas besoin d'un système d'ascension séparé.

## Données nécessaires

- `cards-bloomburrow.json` (généré par le script `scripts/fetch-cards`)
- Une table/config de méta-progression (paliers XP, coûts des améliorations)
- Un pool de cartes éligibles boss par archétype

## Gates de passage

- [ ] Toutes les mécaniques du GAME_DESIGN.md sont implémentées et fonctionnelles
- [ ] 10+ runs se sentent variés grâce aux 10 archétypes
- [ ] La méta-progression motive à relancer une run après un échec
- [ ] Première session de playtest sur plusieurs sessions

## Ce qu'on ne fait PAS encore

- Polish final (UI/UX, animations, tutoriel)
- Équilibrage définitif (ajusté en Beta selon les runs joués)
- Deuxième extension jouable
