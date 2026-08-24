import { describe, it, expect } from 'vitest';
import {
  createRun,
  enterNode,
  buildCombatSetup,
  resolveCombat,
  pickConsolation,
  buyShopCard,
  buyManaCap,
  buyHeal,
  applyEvent,
  createDraft,
  draftPick,
} from './run.js';

// Contenu de test minimal, indépendant des JSON réels.
const cardDb = {
  w1: { id: 'w1', colors: ['W'], rarity: 'common', type: 'creature', cost: 1, power: 1, toughness: 1, keywords: [] },
  w2: { id: 'w2', colors: ['W'], rarity: 'uncommon', type: 'creature', cost: 2, power: 2, toughness: 2, keywords: [] },
  u1: { id: 'u1', colors: ['U'], rarity: 'common', type: 'creature', cost: 1, power: 1, toughness: 2, keywords: [] },
  u2: { id: 'u2', colors: ['U'], rarity: 'common', type: 'creature', cost: 2, power: 2, toughness: 1, keywords: [] },
  b1: { id: 'b1', colors: ['B'], rarity: 'common', type: 'creature', cost: 1, power: 1, toughness: 1, keywords: [] },
  b2: { id: 'b2', colors: ['B'], rarity: 'rare', type: 'creature', cost: 3, power: 3, toughness: 3, keywords: [] },
  r1: { id: 'r1', colors: ['R'], rarity: 'common', type: 'creature', cost: 1, power: 2, toughness: 1, keywords: [] },
  r2: { id: 'r2', colors: ['R'], rarity: 'common', type: 'creature', cost: 2, power: 3, toughness: 1, keywords: [] },
  g1: { id: 'g1', colors: ['G'], rarity: 'common', type: 'creature', cost: 2, power: 2, toughness: 3, keywords: [] },
  g2: { id: 'g2', colors: ['G'], rarity: 'uncommon', type: 'creature', cost: 3, power: 3, toughness: 4, keywords: [] },
};

const content = {
  cardDb,
  balance: {
    run: { starting_max_hp: 100, starting_gold: 100, starting_mana_cap: 5, mana_cap_hard_max: 8, combat_loss_maxhp_penalty: 20 },
    combat: { starting_hand_size: 7, extra_draws_max: 2, extra_draw_interval: 2, enemy_default_mana_cap: 5 },
    draft: { num_boosters: 4, booster_size: 8, picks_per_booster: 3, rarity_weights: { common: 6, uncommon: 3, rare: 1 } },
    shop: { cards_offered: 3 },
    consolation: { num_colors: 2, num_choices: 3 },
    rewards: { gold_combat_by_level: [30, 40], gold_boss_by_level: [60, 80] },
  },
  shop: {
    card_prices: { common: 40, uncommon: 75, rare: 120 },
    booster: { price: 60, cards_shown: 3, picks: 1 },
    mana_cap_upgrade: { base_price: 80, price_increment: 40 },
    heal: { hp_per_purchase: 10, price: 30 },
  },
  encounters: {
    encounters: { e1: { name: 'Rencontre', hp: 20, deck: ['r1', 'r1', 'r2'] } },
    bosses: {
      boss1: { name: 'Boss 1', hp: 30, deck: ['b2', 'b2'] },
      boss2: { name: 'Boss 2', hp: 40, deck: ['b2', 'b2'] },
    },
  },
  levels: [
    {
      id: 1,
      boss: 'boss1',
      combat_pool: ['e1'],
      event_pool: ['ev1'],
      rows: [[{ id: '1a', type: 'combat' }], [{ id: '2a', type: 'shop' }, { id: '2b', type: 'event' }], [{ id: 'boss', type: 'boss' }]],
      edges: [['1a', '2a'], ['1a', '2b'], ['2a', 'boss'], ['2b', 'boss']],
    },
    {
      id: 2,
      boss: 'boss2',
      combat_pool: ['e1'],
      event_pool: ['ev1'],
      rows: [[{ id: '1a', type: 'combat' }], [{ id: 'boss', type: 'boss' }]],
      edges: [['1a', 'boss']],
    },
  ],
  events: { ev1: { name: 'Source', effect: 'heal', amount: 25 } },
};

const zero = () => 0;
const deck = ['w1', 'u1', 'b1', 'r1', 'g1'];

describe('createRun', () => {
  it('initialise les PV, l’or, le plafond de mana et la première rangée accessible', () => {
    const run = createRun(content, deck, zero);
    expect(run.status).toBe('map');
    expect(run.currentHp).toBe(100);
    expect(run.maxHp).toBe(100);
    expect(run.gold).toBe(100);
    expect(run.manaCap).toBe(5);
    expect(run.level).toBe(0);
    expect(run.reachable).toEqual(['1a']);
    expect(run.deck).toEqual(deck);
  });
});

describe('navigation & pont combat', () => {
  it('entrer dans un nœud de combat prépare la rencontre', () => {
    const run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    expect(run.status).toBe('combat');
    expect(run.pending).toMatchObject({ kind: 'combat', encounterId: 'e1', isBoss: false });
  });

  it('buildCombatSetup transmet deck, PV et rencontre', () => {
    const run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    const setup = buildCombatSetup(run, content);
    expect(setup.playerDeck).toEqual(deck);
    expect(setup.enemyDeck).toEqual(['r1', 'r1', 'r2']);
    expect(setup.playerHp).toBe(100);
    expect(setup.enemyHp).toBe(20);
    expect(setup.enemyName).toBe('Rencontre');
  });
});

describe('résolution de combat', () => {
  it('victoire normale : or gagné, PV reportés, retour à la carte', () => {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run = resolveCombat(run, content, { outcome: 'win', playerHpAfter: 82 }, zero);
    expect(run.status).toBe('map');
    expect(run.currentHp).toBe(82);
    expect(run.gold).toBe(130); // 100 + 30
    expect(run.reachable).toEqual(['2a', '2b']);
  });

  it('victoire de boss (niveau non final) : passage au niveau suivant', () => {
    let run = createRun(content, deck, zero);
    run.pending = { kind: 'combat', bossId: 'boss1', isBoss: true };
    run.status = 'combat';
    run = resolveCombat(run, content, { outcome: 'win', playerHpAfter: 70 }, zero);
    expect(run.level).toBe(1);
    expect(run.status).toBe('map');
    expect(run.gold).toBe(160); // 100 + 60
  });

  it('victoire du boss final : victoire du run', () => {
    let run = createRun(content, deck, zero);
    run.level = 1;
    run.pending = { kind: 'combat', bossId: 'boss2', isBoss: true };
    run.status = 'combat';
    run = resolveCombat(run, content, { outcome: 'win', playerHpAfter: 50 }, zero);
    expect(run.status).toBe('victory');
  });

  it('défaite : -20 PV max, PV refaits, lot de consolation proposé', () => {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run = resolveCombat(run, content, { outcome: 'loss', playerHpAfter: 0 }, zero);
    expect(run.maxHp).toBe(80);
    expect(run.currentHp).toBe(80);
    expect(run.status).toBe('defeat_reward');
    expect(run.pending.consolation.colors).toHaveLength(2);
    expect(run.pending.consolation.choices).toHaveLength(3);
  });

  it('game over quand les PV max tombent à 0', () => {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run.maxHp = 20;
    run = resolveCombat(run, content, { outcome: 'loss', playerHpAfter: 0 }, zero);
    expect(run.status).toBe('game_over');
    expect(run.maxHp).toBe(0);
  });

  it('pickConsolation ajoute la carte et relance le combat', () => {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run = resolveCombat(run, content, { outcome: 'loss', playerHpAfter: 0 }, zero);
    const pick = run.pending.consolation.choices[0];
    const before = run.deck.length;
    run = pickConsolation(run, content, pick);
    expect(run.deck.length).toBe(before + 1);
    expect(run.status).toBe('combat');
  });
});

describe('boutique', () => {
  function shopRun() {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run = resolveCombat(run, content, { outcome: 'win', playerHpAfter: 70 }, zero);
    return enterNode(run, content, '2a', zero); // nœud boutique
  }

  it('acheter une carte débite l’or et l’ajoute au deck', () => {
    const run = shopRun();
    const offer = run.pending.offers.cards[0];
    const before = run.deck.length;
    const after = buyShopCard(run, content, offer.cardId);
    expect(after.gold).toBe(run.gold - offer.price);
    expect(after.deck.length).toBe(before + 1);
  });

  it('augmenter le plafond de mana', () => {
    const run = shopRun();
    const after = buyManaCap(run, content);
    expect(after.manaCap).toBe(6);
    expect(after.gold).toBe(run.gold - 80);
  });

  it('acheter du soin', () => {
    const run = shopRun(); // currentHp 70/100
    const after = buyHeal(run, content);
    expect(after.currentHp).toBe(80);
    expect(after.gold).toBe(run.gold - 30);
  });
});

describe('événement', () => {
  it('un événement de soin rend des PV puis renvoie à la carte', () => {
    let run = enterNode(createRun(content, deck, zero), content, '1a', zero);
    run = resolveCombat(run, content, { outcome: 'win', playerHpAfter: 60 }, zero);
    run = enterNode(run, content, '2b', zero); // événement
    const after = applyEvent(run, content);
    expect(after.currentHp).toBe(85); // 60 + 25
    expect(after.status).toBe('map');
  });
});

describe('draft', () => {
  it('construit un deck de num_boosters × picks_per_booster cartes', () => {
    let draft = createDraft(content, zero);
    expect(draft.boosters).toHaveLength(4);
    expect(draft.boosters[0]).toHaveLength(8);
    let guard = 0;
    while (!draft.done && guard++ < 100) {
      draft = draftPick(draft, draft.boosters[draft.boosterIndex][0], zero);
    }
    expect(draft.done).toBe(true);
    expect(draft.picked).toHaveLength(12);
  });
});
