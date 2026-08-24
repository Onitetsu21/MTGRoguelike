// Construction des decks à partir d'une liste d'ids et d'une base de cartes.
// Aucune valeur de carte n'est écrite ici : tout provient du `cardDb` fourni.

import { shuffle } from './rng.js';

// Normalise les capacités d'une carte. Les rituels « legacy » (effect/value/buff
// du POC/MVP) sont convertis en une capacité `cast`, tout en conservant les
// champs d'origine (utilisés par l'UI de ciblage et l'IA du bot).
function normalizeAbilities(def) {
  if (Array.isArray(def.abilities)) return def.abilities.map((a) => structuredClone(a));
  if (def.effect === 'deal_damage') {
    return [{ trigger: 'cast', effect: { type: 'deal_damage', amount: def.value, target: 'chosen_any' } }];
  }
  if (def.effect === 'buff') {
    return [
      {
        trigger: 'cast',
        effect: {
          type: 'buff',
          power: def.buff?.power ?? 0,
          toughness: def.buff?.toughness ?? 0,
          duration: def.buff?.duration ?? 'turn',
          target: 'chosen_creature',
        },
      },
    ];
  }
  return [];
}

// Transforme une définition de carte (issue d'un JSON) en instance jouable,
// avec un identifiant unique. Une instance conserve toutes les données statiques
// de la carte + un instanceId, mais reste une simple donnée sérialisable.
export function makeInstance(def, instanceId, controller) {
  return {
    instanceId,
    controller,
    cardId: def.id,
    name: def.name,
    type: def.type,
    cost: def.cost,
    text: def.text ?? '',
    rarity: def.rarity ?? 'common',
    colors: def.colors ? [...def.colors] : [],
    keywords: def.keywords ? [...def.keywords] : [],
    abilities: normalizeAbilities(def),
    // Champs créature (undefined pour les rituels)
    power: def.power,
    toughness: def.toughness,
    // Champs rituel legacy (undefined pour les créatures) — conservés pour l'UI/IA
    effect: def.effect,
    value: def.value,
    buff: def.buff ? { ...def.buff } : undefined,
  };
}

// Construit un deck mélangé d'instances à partir d'une liste d'ids.
// Lève une erreur explicite si un id est inconnu (fail-fast, data-driven).
export function buildDeck(deckList, cardDb, controller, rng = Math.random) {
  const instances = deckList.map((cardId, i) => {
    const def = cardDb[cardId];
    if (!def) {
      throw new Error(`Carte inconnue dans le deck "${controller}" : "${cardId}"`);
    }
    return makeInstance(def, `${controller}-${cardId}-${i}`, controller);
  });
  return shuffle(instances, rng);
}

// Construit une map id -> définition à partir du tableau `cards` du JSON.
export function buildCardDb(cardsArray) {
  const db = {};
  for (const def of cardsArray) db[def.id] = def;
  return db;
}
