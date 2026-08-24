// Assemble le `content` du run pour l'extension Bloomburrow (Jalon 3) :
// fusion du pool importé + overrides, puis génération des decks ennemis/boss
// par archétype. Aucune valeur de gameplay en dur : tout vient des JSON.

import cardsBlb from '../../data/cards-bloomburrow.json';
import overrides from '../../data/cards-bloomburrow-overrides.json';
import archetypesJson from '../../data/archetypes.json';
import balanceJson from '../../data/balance-poc.json';
import shopJson from '../../data/shop-config.json';
import runMapJson from '../../data/run-map-poc.json';
import eventsJson from '../../data/events-poc.json';
import { shuffle } from '../engine/rng.js';

const stripMeta = ({ _meta, ...rest }) => rest;

// --- Fusion du pool (import auto + overrides manuels) ----------------------
function buildCardDb() {
  const db = {};
  for (const c of cardsBlb.cards) db[c.id] = c;
  for (const o of overrides.cards) db[o.id] = { ...(db[o.id] ?? {}), ...o }; // patch ou ajout
  return db;
}

export const cardDb = buildCardDb();
export const archetypes = archetypesJson.archetypes;
const balance = stripMeta(balanceJson);
const allDefs = Object.values(cardDb);

// --- Génération de decks par archétype -------------------------------------
function poolFor(archId) {
  const themed = allDefs.filter((c) => (c.archetypes ?? []).includes(archId));
  if (themed.length >= 10) return themed;
  // complète avec des cartes incolores si l'archétype est trop mince
  const colorless = allDefs.filter((c) => (c.archetypes ?? []).length === 0);
  return themed.concat(colorless);
}

function sampleDeck(archId, size, rng) {
  const pool = poolFor(archId);
  const ids = [];
  // garantir les cartes-signaux de l'archétype
  for (const s of pool.filter((c) => c.signpost).slice(0, 3)) ids.push(s.id);
  const bag = shuffle(pool, rng);
  let i = 0;
  while (ids.length < size && bag.length > 0) {
    ids.push(bag[i % bag.length].id);
    i++;
  }
  return ids;
}

function buildEncounters(rng) {
  const encounters = {};
  for (const [id, arch] of Object.entries(archetypes)) {
    encounters[id] = { name: `${arch.name} (${arch.colors.join('')})`, hp: 24, ai: 'default', deck: sampleDeck(id, 12, rng) };
  }
  // 3 boss (un par niveau), decks plus gros et PV croissants.
  const bossArchs = ['selesnya', 'izzet', 'golgari'];
  const bossHp = [26, 30, 34];
  const bosses = {};
  bossArchs.forEach((archId, lvl) => {
    bosses[`boss_l${lvl + 1}`] = {
      name: `Boss ${archetypes[archId].name}`,
      hp: bossHp[lvl],
      ai: 'default',
      deck: sampleDeck(archId, 16, rng),
    };
  });
  return { encounters, bosses };
}

// --- Carte de run : géométrie du MVP, pools remplacés par les archétypes ----
function buildLevels() {
  const archIds = Object.keys(archetypes);
  return runMapJson.levels.map((lvl, i) => ({
    ...lvl,
    combat_pool: archIds,
    boss: `boss_l${i + 1}`,
  }));
}

const rng = Math.random;

export const content = {
  cardDb,
  archetypes,
  balance,
  shop: stripMeta(shopJson),
  events: eventsJson.events,
  encounters: buildEncounters(rng),
  levels: buildLevels(),
  extension: 'bloomburrow',
};
