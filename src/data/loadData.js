// Couche de chargement des données. Depuis le Jalon 3, l'extension active est
// Bloomburrow (import Scryfall + overrides), assemblée par buildBloomburrow.js.
// Le moteur reçoit ce `content` en paramètre — aucune valeur en dur ailleurs.

import cardsBlb from '../../data/cards-bloomburrow.json';

export { cardDb, content, archetypes } from './buildBloomburrow.js';
export const cardsMeta = cardsBlb._meta;
