import { describe, it, expect } from 'vitest';
import { createGame, attack, makeBoardCreature, _internals } from './game.js';
import { triggerEvent } from './abilities.js';
import { effectivePower, isDead, hasKeyword } from './selectors.js';

const deps = _internals.deps;
const zero = () => 0;
const vanillaDb = { x: { id: 'x', type: 'creature', cost: 1, power: 1, toughness: 1, keywords: [] } };

// État de combat minimal ; on remplace les plateaux directement.
function bareState(playerBoard = [], botBoard = []) {
  const s = createGame(vanillaDb, { playerDeck: ['x'], enemyDeck: ['x'], playerHp: 20, enemyHp: 20 }, zero);
  s.players.player.board = playerBoard;
  s.players.bot.board = botBoard;
  return s;
}

function creature(def, controller, id) {
  const c = makeBoardCreature(
    { instanceId: id, cardId: id, name: def.name ?? id, power: def.power, toughness: def.toughness, keywords: def.keywords ?? [], abilities: def.abilities ?? [] },
    controller
  );
  c.readyToAttack = true;
  return c;
}

describe('trigger on_enter', () => {
  it('crée un jeton (Renfort/ETB)', () => {
    const c = creature({ power: 2, toughness: 2, abilities: [{ trigger: 'on_enter', effect: { type: 'create_token', power: 1, toughness: 1, keywords: ['flying'], count: 1 } }] }, 'player', 'a');
    const s = bareState([c], []);
    triggerEvent(s, deps, 'on_enter', { creature: c });
    expect(s.players.player.board).toHaveLength(2);
    expect(s.players.player.board[1].isToken).toBe(true);
  });
});

describe('trigger on_death', () => {
  it('inflige des dégâts au visage adverse à la mort', () => {
    const c = creature({ power: 1, toughness: 1, abilities: [{ trigger: 'on_death', effect: { type: 'deal_damage', amount: 3, target: 'enemy_face' } }] }, 'player', 'a');
    const s = bareState([c], []);
    c.markedDamage = 5; // létal
    _internals.cleanupDeaths(s);
    expect(s.players.bot.hp).toBe(17);
    expect(s.players.player.board).toHaveLength(0);
  });
});

describe('trigger on_attack', () => {
  it('renforce l’attaquant avant de frapper', () => {
    const c = creature({ power: 2, toughness: 2, abilities: [{ trigger: 'on_attack', effect: { type: 'buff', power: 2, toughness: 0, duration: 'turn', target: 'self' } }] }, 'player', 'a');
    const after = attack(bareState([c], []), 'a', { type: 'player' });
    expect(after.players.bot.hp).toBe(16); // 20 - (2+2)
  });
});

describe('Initiative', () => {
  it('tue la cible avant la riposte : l’attaquant survit', () => {
    const atk = creature({ power: 2, toughness: 2, keywords: ['initiative'] }, 'player', 'a');
    const def = creature({ power: 2, toughness: 2 }, 'bot', 'b');
    const after = attack(bareState([atk], [def]), 'a', { type: 'creature', instanceId: 'b' });
    expect(after.players.bot.board).toHaveLength(0);
    expect(after.players.player.board).toHaveLength(1);
  });

  it('sans Initiative, les deux meurent (simultané)', () => {
    const atk = creature({ power: 2, toughness: 2 }, 'player', 'a');
    const def = creature({ power: 2, toughness: 2 }, 'bot', 'b');
    const after = attack(bareState([atk], [def]), 'a', { type: 'creature', instanceId: 'b' });
    expect(after.players.bot.board).toHaveLength(0);
    expect(after.players.player.board).toHaveLength(0);
  });
});

describe('Indestructible', () => {
  it('survit à des dégâts létaux', () => {
    const c = creature({ power: 1, toughness: 1, keywords: ['indestructible'] }, 'bot', 'b');
    const s = bareState([], [c]);
    _internals.damageCreature(s, c, 10, false);
    expect(isDead(c)).toBe(false);
    _internals.cleanupDeaths(s);
    expect(s.players.bot.board).toHaveLength(1);
  });

  it('survit à un effet « détruire »', () => {
    const c = creature({ power: 1, toughness: 1, keywords: ['indestructible'] }, 'bot', 'b');
    const s = bareState([], [c]);
    _internals.destroyCreature(s, c);
    expect(isDead(c)).toBe(false);
  });
});

describe('condition Seuil (threshold)', () => {
  it('ne se déclenche qu’avec 2+ cartes au cimetière', () => {
    const c = creature({ power: 1, toughness: 1, abilities: [{ trigger: 'on_attack', condition: { kind: 'threshold', min: 2 }, effect: { type: 'buff', power: 3, toughness: 0, duration: 'turn', target: 'self' } }] }, 'player', 'a');
    const s = bareState([c], []);
    triggerEvent(s, deps, 'on_attack', { creature: c });
    expect(effectivePower(c)).toBe(1);
    s.players.player.graveyard = [{}, {}];
    triggerEvent(s, deps, 'on_attack', { creature: c });
    expect(effectivePower(c)).toBe(4);
  });
});

describe('condition Dépense (expend) + limit_per_turn', () => {
  it('se déclenche au seuil de mana dépensé, une seule fois par tour', () => {
    const c = creature({ power: 1, toughness: 1, abilities: [{ trigger: 'on_spell_cast', condition: { kind: 'expend', min: 2 }, limit_per_turn: 1, effect: { type: 'buff', power: 2, toughness: 2, duration: 'turn', target: 'self' } }] }, 'player', 'a');
    const s = bareState([c], []);
    s.players.player.manaSpentThisTurn = 1;
    triggerEvent(s, deps, 'on_spell_cast', { controller: 'player' });
    expect(effectivePower(c)).toBe(1); // sous le seuil
    s.players.player.manaSpentThisTurn = 3;
    triggerEvent(s, deps, 'on_spell_cast', { controller: 'player' });
    expect(effectivePower(c)).toBe(3); // +2
    triggerEvent(s, deps, 'on_spell_cast', { controller: 'player' });
    expect(effectivePower(c)).toBe(3); // limité à 1x/tour
  });
});

describe('grant_keyword', () => {
  it('octroie un mot-clé (ex. Vol) via un effet', () => {
    const c = creature({ power: 1, toughness: 1, abilities: [{ trigger: 'on_enter', effect: { type: 'grant_keyword', keyword: 'flying', duration: 'turn', target: 'self' } }] }, 'player', 'a');
    const s = bareState([c], []);
    triggerEvent(s, deps, 'on_enter', { creature: c });
    expect(hasKeyword(c, 'flying')).toBe(true);
  });
});
