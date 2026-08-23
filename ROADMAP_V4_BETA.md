# Jalon 4 — Beta / Version complète (feuille de route)

⚠️ Feuille de route, pas un prompt Claude Code prêt à l'emploi. À détailler une fois le Jalon 3 (Alpha) validé.

Adapté par rapport au jalon Beta générique du skill : tout le volet Steam/store (Steamworks, achievements, page store, cloud saves) est retiré, puisque ce projet est personnel et ne sera pas distribué. La persistance perso est déjà gérée par Supabase depuis l'Alpha.

## Objectif

Le jeu est stable, équilibré et agréable à jouer sur la durée pour un usage personnel — la version "complète" telle qu'envisagée dès le départ.

## Contenu attendu

- Troisième passe de balance approfondie sur les 10 archétypes et sur les courbes de méta-progression (paliers XP, coûts des améliorations).
- UI/UX polie : animations de carte (jeu, attaque, mort), transitions entre écrans et nœuds de la carte de run.
- Un tutoriel léger ou des tooltips expliquant les différences avec le vrai Magic (dégâts persistants, ciblage asymétrique, pas d'instants, Surcharge) — utile même pour toi si tu reprends le jeu après une pause.
- Sound design complet : musique d'ambiance, SFX de combat.
- Paramètres basiques (volume, éventuellement vitesse des animations).
- Bug fixing intensif sur l'ensemble des runs et archétypes.
- Playtest élargi (toi, éventuellement des proches en local — jamais publié).

## Données nécessaires

Aucune nouvelle donnée de jeu — cette phase est du polish et de l'équilibrage sur l'existant.

## Gates de passage

- [ ] 0 bug bloquant connu
- [ ] Le jeu se lance, se joue et se ferme proprement
- [ ] La balance est jugée saine sur un nombre significatif de runs (pas de build "je gagne toujours", pas de piège évident pour un nouveau venu sur le système)
- [ ] Le jeu reste agréable à rejouer dans la durée

## Ce qu'on ne fait PAS

- Packaging Steam, page store, localisation multilingue, achievements Steamworks — non pertinent, projet non distribué.
- Deuxième extension jouable (question de contenu séparée, à traiter plus tard si l'envie est là).
