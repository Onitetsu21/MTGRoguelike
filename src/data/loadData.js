// Couche de chargement des données. Seul endroit qui importe les JSON bruts.
// Le moteur (combat + run) reçoit ensuite ces données en paramètre — jamais de
// valeur de gameplay en dur ailleurs.

import cardsJson from '../../data/cards-poc.json';
import balanceJson from '../../data/balance-poc.json';
import shopJson from '../../data/shop-config.json';
import encountersJson from '../../data/encounters-poc.json';
import runMapJson from '../../data/run-map-poc.json';
import eventsJson from '../../data/events-poc.json';
import { buildCardDb } from '../engine/index.js';

const stripMeta = ({ _meta, ...rest }) => rest;

export const cardDb = buildCardDb(cardsJson.cards);
export const cardsMeta = cardsJson._meta;

// Bundle de contenu passé au moteur de run (src/engine/run.js).
export const content = {
  cardDb,
  balance: stripMeta(balanceJson),
  shop: stripMeta(shopJson),
  encounters: encountersJson, // { encounters, bosses } ; _meta ignoré par le run
  levels: runMapJson.levels,
  events: eventsJson.events,
};
