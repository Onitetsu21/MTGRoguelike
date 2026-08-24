import { describe, it, expect } from 'vitest';
import { createGame, playCard, attack, endTurn, makeBoardCreature, getCombatResult } from './game.js';
import { effectivePower, effectiveToughness, canBeAttackedBy } from './selectors.js';
import { STARTING_HP, MANA_CAP } from './constants.js';

// Base de cartes de test, indépendante de cards-poc.json, pour valider le moteur
// en isolation totale de React et des données réelles.
const testDb = {
  bear: { id: 'bear', name: 'Ours', type: 'creature', cost: 2, power: 3, toughness: 3, keywords: [] },
  flyer: { id: 'flyer', name: 'Voleur', type: 'creature', cost: 1, power: 1, toughness: 1, keywords: ['flying'] },
  archer: { id: 'archer', name: 'Archère', type: 'creature', cost: 2, power: 2, toughness: 2, keywords: ['reach'] },
  trampler: { id: 'trampler', name: 'Piétineur', type: 'creature', cost: 3, power: 5, toughness: 3, keywords: ['trample'] },
  assassin: { id: 'assassin', name: 'Assassin', type: 'creature', cost: 2, power: 1, toughness: 3, keywords: ['deathtouch'] },
  vampire: { id: 'vampire', name: 'Vampire', type: 'creature', cost: 3, power: 3, toughness: 3, keywords: ['lifelink'] },
  sprinter: { id: 'sprinter', name: 'Sprinteur', type: 'creature', cost: 2, power: 2, toughness: 2, keywords: ['haste'] },
  wall: { id: 'wall', name: 'Mur', type: 'creature', cost: 2, power: 0, toughness: 6, keywords: [] },
  bolt: { id: 'bolt', name: 'Éclair', type: 'sorcery', cost: 1, effect: 'deal_damage', value: 2 },
  pump: { id: 'pump', name: 'Boost', type: 'sorcery', cost: 1, effect: 'buff', buff: { power: 2, toughness: 2 } },
};

const noShuffle = () => 0; // rng déterministe : Fisher-Yates ne réordonne rien

function newGame(playerDeck, enemyDeck, overrides = {}) {
  return createGame(
    testDb,
    { playerDeck, enemyDeck, playerHp: STARTING_HP, playerMaxHp: STARTING_HP, enemyHp: STARTING_HP, ...overrides },
    noShuffle
  );
}

// Construit un état où le joueur a des créatures prêtes et c'est son tour.
function makeCombatState(playerBoard, botBoard, overrides = {}) {
  const s = newGame(['bear'], ['bear'], overrides);
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
    const s = newGame(Array(12).fill('bear'), Array(12).fill('bear'));
    expect(s.players.player.hand).toHaveLength(7);
    expect(s.players.bot.hand).toHaveLength(7);
    expect(s.players.player.mana).toBe(1);
    expect(s.players.player.hp).toBe(STARTING_HP);
    expect(s.activePlayer).toBe('player');
  });

  it('lit les PV et le nom de la rencontre depuis le setup', () => {
    const s = newGame(['bear'], ['bear'], { playerHp: 73, playerMaxHp: 100, enemyHp: 30, enemyName: 'Boss' });
    expect(s.players.player.hp).toBe(73);
    expect(s.players.player.maxHp).toBe(100);
    expect(s.players.bot.hp).toBe(30);
    expect(s.enemyName).toBe('Boss');
  });
});

describe('mana', () => {
  // Deck ennemi vide (bot inoffensif) : le joueur survit à la rampe.
  it('monte de 1 par tour et plafonne au plafond du run', () => {
    let s = newGame(Array(12).fill('bear'), []);
    const manas = [s.players.player.mana];
    for (let i = 0; i < 6; i++) {
      s = endTurn(s);
      manas.push(s.players.player.mana);
    }
    expect(manas).toEqual([1, 2, 3, 4, 5, MANA_CAP, MANA_CAP]);
  });

  it('respecte un plafond de mana personnalisé', () => {
    let s = newGame(Array(12).fill('bear'), [], { playerManaCap: 8, playerHp: 100, playerMaxHp: 100 });
    for (let i = 0; i < 8; i++) s = endTurn(s);
    expect(s.players.player.maxMana).toBe(8);
  });
});

describe('jeu de carte', () => {
  it('n’autorise pas une carte trop chère', () => {
    const s = newGame(Array(3).fill('bear'), ['bear']); // bear coûte 2, mana 1
    const card = s.players.player.hand[0];
    expect(playCard(s, card.instanceId)).toBe(s);
  });
});

describe('combat entre créatures (mutuel)', () => {
  it('les deux créatures se marquent des dégâts', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'bear', power: 3, toughness: 3 }]);
    const after = attack(s, 'p-bear', { type: 'creature', instanceId: 'b-bear' });
    expect(after.players.player.board).toHaveLength(0);
    expect(after.players.bot.board).toHaveLength(0);
  });

  it('les dégâts persistent d’un tour à l’autre', () => {
    const s = makeCombatState([{ id: 'bear', power: 2, toughness: 5 }], [{ id: 'wall', power: 0, toughness: 6 }]);
    const after = attack(s, 'p-bear', { type: 'creature', instanceId: 'b-wall' });
    expect(after.players.bot.board[0].markedDamage).toBe(2);
  });
});

describe('piétinement', () => {
  it('l’excédent de dégâts létaux passe au joueur adverse', () => {
    const s = makeCombatState([{ id: 'trampler', power: 5, toughness: 3, keywords: ['trample'] }], [{ id: 'bear', power: 1, toughness: 3 }]);
    const after = attack(s, 'p-trampler', { type: 'creature', instanceId: 'b-bear' });
    expect(after.players.bot.hp).toBe(STARTING_HP - 2);
    expect(after.players.bot.board).toHaveLength(0);
  });
});

describe('toucher mortel', () => {
  it('détruit la cible avec 1 seul dégât', () => {
    const s = makeCombatState([{ id: 'assassin', power: 1, toughness: 3, keywords: ['deathtouch'] }], [{ id: 'wall', power: 0, toughness: 6 }]);
    const after = attack(s, 'p-assassin', { type: 'creature', instanceId: 'b-wall' });
    expect(after.players.bot.board).toHaveLength(0);
  });
});

describe('vol & portée', () => {
  it('une créature au sol ne peut pas cibler une créature volante', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    expect(attack(s, 'p-bear', { type: 'creature', instanceId: 'b-flyer' })).toBe(s);
  });

  it('la Portée permet d’attaquer une créature volante', () => {
    const ground = makeBoardCreature({ instanceId: 'a', cardId: 'archer', keywords: ['reach'], power: 2, toughness: 2 }, 'player');
    const fly = makeBoardCreature({ instanceId: 'b', cardId: 'flyer', keywords: ['flying'], power: 1, toughness: 1 }, 'bot');
    expect(canBeAttackedBy(fly, ground)).toBe(true);
    const s = makeCombatState([{ id: 'archer', power: 2, toughness: 2, keywords: ['reach'] }], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    const after = attack(s, 'p-archer', { type: 'creature', instanceId: 'b-flyer' });
    expect(after.players.bot.board).toHaveLength(0);
  });

  it('le joueur peut toujours viser l’adversaire directement', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    const after = attack(s, 'p-bear', { type: 'player' });
    expect(after.players.bot.hp).toBe(STARTING_HP - 3);
  });
});

describe('lien de vie', () => {
  it('soigne le contrôleur quand la créature inflige des dégâts (borné aux PV max)', () => {
    const s = makeCombatState([{ id: 'vampire', power: 3, toughness: 3, keywords: ['lifelink'] }], [], { playerHp: 10, playerMaxHp: 20 });
    const after = attack(s, 'p-vampire', { type: 'player' });
    expect(after.players.player.hp).toBe(13); // 10 + 3
    expect(after.players.bot.hp).toBe(STARTING_HP - 3);
  });

  it('ne dépasse pas les PV max', () => {
    const s = makeCombatState([{ id: 'vampire', power: 3, toughness: 3, keywords: ['lifelink'] }], [], { playerHp: 19, playerMaxHp: 20 });
    const after = attack(s, 'p-vampire', { type: 'player' });
    expect(after.players.player.hp).toBe(20);
  });
});

describe('célérité', () => {
  it('une créature avec Célérité arrive prête à attaquer', () => {
    expect(makeBoardCreature({ instanceId: 'x', cardId: 'sprinter', keywords: ['haste'] }, 'player').readyToAttack).toBe(true);
    expect(makeBoardCreature({ instanceId: 'y', cardId: 'bear', keywords: [] }, 'player').readyToAttack).toBe(false);
  });
});

describe('rituels', () => {
  it('les dégâts directs peuvent tuer une créature', () => {
    const s = makeCombatState([], [{ id: 'flyer', power: 1, toughness: 1, keywords: ['flying'] }]);
    s.players.player.hand = [{ instanceId: 'bolt1', cardId: 'bolt', name: 'Éclair', type: 'sorcery', cost: 1, effect: 'deal_damage', value: 2, keywords: [] }];
    s.players.player.mana = 5;
    const after = playCard(s, 'bolt1', { type: 'creature', instanceId: 'b-flyer' });
    expect(after.players.bot.board).toHaveLength(0);
  });

  it('le buff est temporaire (+2/+2) et expire en fin de tour', () => {
    const s = makeCombatState([{ id: 'bear', power: 3, toughness: 3 }], []);
    s.players.player.hand = [{ instanceId: 'pump1', cardId: 'pump', name: 'Boost', type: 'sorcery', cost: 1, effect: 'buff', buff: { power: 2, toughness: 2 }, keywords: [] }];
    s.players.player.mana = 5;
    const buffed = playCard(s, 'pump1', { type: 'creature', instanceId: 'p-bear' });
    expect(effectivePower(buffed.players.player.board[0])).toBe(5);
    const afterTurn = endTurn(buffed);
    expect(effectivePower(afterTurn.players.player.board[0])).toBe(3);
  });
});

describe('conditions de fin & résultat', () => {
  it('réduire les PV adverses à 0 déclenche la victoire et un résultat gagnant', () => {
    const s = makeCombatState([{ id: 'trampler', power: 5, toughness: 3 }], []);
    s.players.bot.hp = 4;
    const after = attack(s, 'p-trampler', { type: 'player' });
    expect(after.status).toBe('victory');
    expect(getCombatResult(after)).toEqual({ outcome: 'win', playerHpAfter: after.players.player.hp });
  });

  it('getCombatResult est null tant que le combat est en cours', () => {
    const s = makeCombatState([{ id: 'bear' }], [{ id: 'bear' }]);
    expect(getCombatResult(s)).toBeNull();
  });
});
