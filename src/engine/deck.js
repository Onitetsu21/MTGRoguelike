// Construction des decks à partir d'une liste d'ids et d'une base de cartes.
// Aucune valeur de carte n'est écrite ici : tout provient du `cardDb` fourni.

import { shuffle } from './rng.js';

// Transforme une définition de carte (issue de cards-poc.json) en instance jouable,
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
    keywords: def.keywords ? [...def.keywords] : [],
    // Champs créature (undefined pour les rituels)
    power: def.power,
    toughness: def.toughness,
    // Champs rituel (undefined pour les créatures)
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
