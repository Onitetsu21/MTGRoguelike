import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { content, cardDb } from '../data/loadData.js';
import { createRun, createDraft, createGame, buildCombatSetup, enterNode } from '../engine/index.js';

import DraftScreen from './DraftScreen.jsx';
import RunMapScreen from './RunMapScreen.jsx';
import CombatScreen from './CombatScreen.jsx';
import ShopScreen from './ShopScreen.jsx';
import EventScreen from './EventScreen.jsx';
import ConsolationScreen from './ConsolationScreen.jsx';
import { TitleScreen, VictoryScreen, GameOverScreen } from './SimpleScreens.jsx';

// Rend chaque écran une fois avec un état réaliste : détecte les crashs de rendu
// (accès undefined…) que les tests moteur ne couvrent pas.
const noop = () => {};
const deck = ['sparrow_scout', 'thornback_pup', 'dawn_cleric', 'venom_stalker', 'bramble_brute', 'ironhide_ox'];
const renders = (el) => expect(renderToStaticMarkup(el).length).toBeGreaterThan(0);

describe('rendu des écrans (smoke)', () => {
  it('titre / victoire / game over', () => {
    renders(<TitleScreen onStart={noop} />);
    renders(<VictoryScreen onRestart={noop} />);
    renders(<GameOverScreen onRestart={noop} />);
  });

  it('draft', () => {
    renders(<DraftScreen draft={createDraft(content)} cardDb={cardDb} onPick={noop} />);
  });

  it('carte de run', () => {
    renders(<RunMapScreen run={createRun(content, deck)} onEnterNode={noop} />);
  });

  it('combat', () => {
    const run = enterNode(createRun(content, deck), content, '1a');
    const combat = createGame(cardDb, buildCombatSetup(run, content));
    renders(
      <CombatScreen state={combat} run={run} onPlayCard={noop} onAttack={noop} onEndTurn={noop} onFinish={noop} />
    );
  });

  it('boutique', () => {
    const run = {
      currentHp: 60, maxHp: 100, gold: 200, manaCap: 5, deck, level: 0,
      pending: {
        kind: 'shop',
        offers: {
          cards: [{ cardId: 'radiant_pegasus', price: 120 }, { cardId: 'sparrow_scout', price: 40 }],
          booster: { price: 60 },
          manaCap: { price: 80 },
          heal: { hp: 10, price: 30 },
        },
      },
    };
    renders(<ShopScreen run={run} cardDb={cardDb} onBuyCard={noop} onBuyManaCap={noop} onBuyHeal={noop} onBuyBooster={noop} onPickBooster={noop} onLeave={noop} />);
    // variante : pioche de booster en cours
    const run2 = { ...run, pending: { ...run.pending, boosterPick: { choices: ['sparrow_scout', 'plague_rat', 'giant_spider'], picks: 1 } } };
    renders(<ShopScreen run={run2} cardDb={cardDb} onBuyCard={noop} onBuyManaCap={noop} onBuyHeal={noop} onBuyBooster={noop} onPickBooster={noop} onLeave={noop} />);
  });

  it('événement', () => {
    const run = { currentHp: 50, maxHp: 100, gold: 0, manaCap: 5, deck, level: 0, pending: { kind: 'event', eventId: 'healing_spring' } };
    renders(<EventScreen run={run} event={content.events.healing_spring} onResolve={noop} />);
  });

  it('consolation', () => {
    const run = {
      currentHp: 80, maxHp: 80, gold: 0, manaCap: 5, deck, level: 0,
      pending: { kind: 'combat', consolation: { colors: ['W', 'R'], choices: ['sparrow_scout', 'thornback_pup', 'dawn_cleric'] } },
    };
    renders(<ConsolationScreen run={run} cardDb={cardDb} onPick={noop} />);
  });
});
