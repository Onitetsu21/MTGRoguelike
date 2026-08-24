// Couche de chargement des données. Seul endroit qui importe les JSON bruts.
// Le moteur reçoit ensuite ces données en paramètre (jamais de valeur en dur).

import cardsJson from '../../data/cards-poc.json';
import decksJson from '../../data/decks-poc.json';
import { buildCardDb } from '../engine/index.js';

export const cardDb = buildCardDb(cardsJson.cards);
export const decks = decksJson.decks;
export const cardsMeta = cardsJson._meta;
