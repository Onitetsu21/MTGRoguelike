# MTG Roguelike — POC (Jalon 1)

Roguelike de deckbuilding solo en React, inspiré de Magic: The Gathering,
simplifié façon Mindbug / Hearthstone. Ce jalon valide **un unique combat**
jouable de bout en bout.

## Démarrage

```bash
npm install
npm run dev      # http://localhost:5173
```

## Autres commandes

```bash
npm run build    # build de production
npm test         # tests unitaires du moteur (Vitest)
```

## Comment jouer

- Cliquez une carte de votre main pour la jouer (créature → sur le plateau ;
  rituel → cliquez ensuite sa cible). Les cartes trop chères sont grisées.
- Cliquez une de vos créatures (réveillée) puis une cible pour attaquer : une
  créature adverse **ou l'adversaire directement**.
- « Fin du tour » laisse le bot jouer, puis vous rend la main.
- Objectif : réduire les PV de l'adversaire à 0 avant d'épuiser votre main.

## Documentation

- Conventions & architecture : [`CLAUDE.md`](CLAUDE.md)
- Règles complètes & feuille de route : [`docs/GAME_DESIGN.md`](docs/GAME_DESIGN.md)
