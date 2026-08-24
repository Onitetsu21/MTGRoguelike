import { describe, it, expect } from 'vitest';
import { createGame, playCard, attack, endTurn, makeBoardCreature } from './game.js';
import { effectivePower, effectiveToughness } from './selectors.js';
import { STARTING_HP, MANA_CAP } from './constants.js';

// Petite base de cartes de test, indépendante de cards-poc.json,
// pour valider le moteur en isolation totale de React et des données réelles.
const testDb = {
  bear: { id: 'bear', name: 'Ours', type: 'creature', cost: 2, power: 3, toughness: 3, keywords: [] },
  flyer: { id: 'flyer', name: 'Voleur', type: 'creature', cost: 1, power: 1, toughness: 1, keywords: ['flying'] },
  trampler: { id: 'trampler', name: 'Piétineur', type: 'creature', cost: 3, power: 5, toughness: 3, keywords: ['trample'] },
  assassin: { id: 'assassin', name: 'Assassin', type: 'creature', cost: 2, power: 1, toughness: 3, keywords: ['deathtouch'] },
  wall: { id: 'wall', name: 'Mur', type: 'creature', cost: 2, power: 0, toughness: 6, keywords: [] },
  bolt: { id: 'bolt', name: 'Éclair', type: 'sorcery', cost: 1, effect: 'deal_damage', value: 2 },
  pump: { id: 'pump', name: 'Boost', type: 'sorcery', cost: 1, effect: 'buff', buff: { power: 2, toughness: 2, duration: 'turn' } },
};

const noShuffle = () => 0; // rng déterministe : Fisher-Yates ne réordonne rien

// Construit un état "propre" où le joueur a des créatures prêtes et c'est son tour.
function makeCombatState(playerBoard, botBoard) {
  const s = createGame(testDb, ['bear'], ['bear'], noShuffle);
  s.players.player.board = playerBoard.map((def) => {
    const c = makeBoardCreature({ ...def, instanceId: `p-${def.id}`, cardId: def.id, keywords: def.keywords ?? [] }, 'player');
    c.readyToAttack = true;
    return c;
  });
  s.players.bot.board = botBoard.map((def) => {
    const c = makeBoardCreature({ ...def, instanceId: `b-${def.id}`, cardId: def.id, keywords: def.keywords ?? [] }, 'bot');
    return c;
  });
  return s;
}

describe('création de partie', () => {
  it('distribue 7 cartes et démarre au tour 1 avec 1 mana', () => {
    const s = createGame(testDb, Array(12).fill('bear'), Array(12).fill('bear'), noShuffle);
    expect(s.players.player.hand).toHaveLength(7);
    expect(s.players.bot.hand).toHaveLength(7);
    expect(s.players.player.mana).toBe(1);
    expect(s.players.player.hp).toBe(STARTING_HP);
    expect(s.activePlayer).toBe('player');
  });
});

describe('mana', () => {
  it('monte de 1 par tour et plafonne à 5', () => {
    let s = createGame(testDb, Array(12).fill('bear'), Array(12).fill('bear'), noShuffle);
    const manas = [s.players.player.mana];
    for (let i = 0; i < 6; i++) {
      s = endTurn(s);
      manas.push(s.players.player.mana);
    }
    expect(manas).toEqual([1, 2, 3, 4, 5, MANA_CAP, MANA_CAP]);
  });
});

describe('jeu de carte', () => {
  it('dépense le mana et n’autorise pas une carte trop chère', () => {
    const s = createGame(testDb, ['bear'], ['bear'], noShuffle);
    // Main = 7x bear (coût 2), mana 1 => injouable
    const card = s.players.player.hand[0];
    const after = playCard(s, card.instanceId);
    expect(after).toBe(s); // aucun changement
  });
});

describe('combat entre créatures (mutuel)', () => {
  it('les deux créatures se marquent des dégâts', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'bear', power: 3, toughness: 3 }]);
    const after = attack(s, 'p-bear', { type: 'creature', instanceId: 'b-bear' });
    // 3 dégâts de chaque côté, endurance 3 => les deux meurent
    expect(after.players.player.board).toHaveLength(0);
    expect(after.players.bot.board).toHaveLength(0);
    expect(after.players.player.graveyard).toHaveLength(1);
    expect(after.players.bot.graveyard).toHaveLength(1);
  });

  it('les dégâts persistent d’un tour à l’autre', () => {
    const s = makeCombatState([{ id: 'bear', power: 2, toughness: 5 }], [{ id: 'wall', power: 0, toughness: 6 }]);
    const after = attack(s, 'p-bear', { type: 'creature', instanceId: 'b-wall' });
    const wall = after.players.bot.board[0];
    expect(wall.markedDamage).toBe(2); // pas de reset
    expect(effectiveToughness(wall)).toBe(6);
  });
});

describe('piétinement', () => {
  it('l’excédent de dégâts létaux passe au joueur adverse', () => {
    const s = makeCombatState([{ id: 'trampler', power: 5, toughness: 3, keywords: ['trample'] }], [{ id: 'bear', power: 1, toughness: 3 }]);
    const after = attack(s, 'p-trampler', { type: 'creature', instanceId: 'b-bear' });
    // 5 de force, 3 pour tuer => 2 au visage
    expect(after.players.bot.hp).toBe(STARTING_HP - 2);
    expect(after.players.bot.board).toHaveLength(0);
  });
});

describe('toucher mortel', () => {
  it('détruit la cible avec 1 seul dégât', () => {
    const s = makeCombatState([{ id: 'assassin', power: 1, toughness: 3, keywords: ['deathtouch'] }], [{ id: 'wall', power: 0, toughness: 6 }]);
    const after = attack(s, 'p-assassin', { type: 'creature', instanceId: 'b-wall' });
    expect(after.players.bot.board).toHaveLength(0); // mur 6 PV détruit par 1 dégât mortel
  });
});

describe('règle de Vol', () => {
  it('une créature au sol ne peut pas cibler une créature volante', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    const after = attack(s, 'p-bear', { type: 'creature', instanceId: 'b-flyer' });
    expect(after).toBe(s); // attaque refusée
  });

  it('le joueur peut toujours viser l’adversaire directement', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    const after = attack(s, 'p-bear', { type: 'player' });
    expect(after.players.bot.hp).toBe(STARTING_HP - 3);
  });
});

describe('rituels', () => {
  it('les dégâts directs peuvent tuer une créature', () => {
    const s = makeCombatState([], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    s.players.player.hand = [
      { instanceId: 'bolt1', cardId: 'bolt', name: 'Éclair', type: 'sorcery', cost: 1, effect: 'deal_damage', value: 2, keywords: [] },
    ];
    s.players.player.mana = 5;
    const after = playCard(s, 'bolt1', { type: 'creature', instanceId: 'b-flyer' });
    expect(after.players.bot.board).toHaveLength(0);
    expect(after.players.player.graveyard.some((c) => c.cardId === 'bolt')).toBe(true);
  });

  it('le buff est temporaire (+2/+2) et expire en fin de tour', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], []);
    s.players.player.hand = [
      { instanceId: 'pump1', cardId: 'pump', name: 'Boost', type: 'sorcery', cost: 1, effect: 'buff', buff: { power: 2, toughness: 2 }, keywords: [] },
    ];
    s.players.player.mana = 5;
    const buffed = playCard(s, 'pump1', { type: 'creature', instanceId: 'p-bear' });
    expect(effectivePower(buffed.players.player.board[0])).toBe(5);
    const afterTurn = endTurn(buffed);
    expect(effectivePower(afterTurn.players.player.board[0])).toBe(3); // buff expiré
  });
});

describe('conditions de victoire', () => {
  it('réduire les PV adverses à 0 déclenche la victoire', () => {
    const s = makeCombatState([{ id: 'trampler', power: 5, toughness: 3 }], []);
    s.players.bot.hp = 4;
    const after = attack(s, 'p-trampler', { type: 'player' });
    expect(after.status).toBe('victory');
    expect(after.players.bot.hp).toBe(0);
  });
});
