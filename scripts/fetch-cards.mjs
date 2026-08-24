// Pré-génération hors-ligne du pool Bloomburrow depuis Scryfall.
// Usage :
//   node scripts/fetch-cards.mjs                     # fetch live → data/cards-bloomburrow.json
//   node scripts/fetch-cards.mjs --art               # + télécharge les illustrations dans public/art/ (git-ignoré)
//   node scripts/fetch-cards.mjs --cache <dir>       # lit <dir>/{en,fr}{1..}.json au lieu du réseau
//
// APPROCHE HYBRIDE (Jalon 3) : on importe automatiquement les CRÉATURES
// (stats / mots-clés évergreens / couleurs / nom FR / tag d'archétype). L'oracle
// text arbitraire n'est PAS interprété — les cartes-signaux porteuses de
// mécanique sont réécrites à la main dans data/cards-bloomburrow-overrides.json,
// fusionné au chargement. Le jeu ne dépend jamais du réseau.

import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'data', 'cards-bloomburrow.json'); // base (commité)
const LOCAL = join(__dirname, '..', 'data', 'cards-bloomburrow.local.json'); // enrichissement (git-ignoré)
const ART_DIR = join(__dirname, '..', 'public', 'art'); // git-ignoré

// Scryfall keyword (EN) -> mot-clé supporté par notre moteur.
const KEYWORD_MAP = {
  Flying: 'flying',
  Trample: 'trample',
  Deathtouch: 'deathtouch',
  Lifelink: 'lifelink',
  Haste: 'haste',
  Reach: 'reach',
  'First strike': 'initiative',
  'Double strike': 'initiative',
  Indestructible: 'indestructible',
};
const KEYWORD_LABELS_FR = {
  flying: 'Vol',
  trample: 'Piétinement',
  deathtouch: 'Toucher mortel',
  lifelink: 'Lien de vie',
  haste: 'Célérité',
  reach: 'Portée',
  initiative: 'Initiative',
  indestructible: 'Indestructible',
};

// Paire de couleurs -> archétype Bloomburrow.
const PAIR_ARCHETYPE = {
  WU: 'azorius', UB: 'dimir', BR: 'rakdos', RG: 'gruul', GW: 'selesnya',
  WB: 'orzhov', BG: 'golgari', GU: 'simic', RW: 'boros', UR: 'izzet',
};
const COLOR_ORDER = ['W', 'U', 'B', 'R', 'G'];
const sortColors = (cs) => [...cs].sort((a, b) => COLOR_ORDER.indexOf(a) - COLOR_ORDER.indexOf(b));

function archetypesFor(colors) {
  if (!colors || colors.length === 0) return []; // incolore : draftable partout (géré ailleurs)
  if (colors.length === 2) {
    const a = PAIR_ARCHETYPE[sortColors(colors).join('')];
    return a ? [a] : [];
  }
  if (colors.length === 1) {
    // mono : tous les archétypes contenant cette couleur
    return Object.entries(PAIR_ARCHETYPE)
      .filter(([pair]) => pair.includes(colors[0]))
      .map(([, id]) => id);
  }
  // 3+ couleurs : archétypes chevauchant
  return Object.entries(PAIR_ARCHETYPE)
    .filter(([pair]) => [...pair].every((c) => colors.includes(c)))
    .map(([, id]) => id);
}

const snake = (name) =>
  name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

// Scryfall exige un User-Agent et un Accept explicites (sinon 400/403).
const SCRY_HEADERS = { 'User-Agent': 'MTGRoguelike/1.0 (perso, offline)', Accept: 'application/json' };

async function fetchPages(query, cacheFiles, unique = 'cards') {
  if (cacheFiles) return cacheFiles.map((f) => JSON.parse(readFileSync(f, 'utf8')).data).flat();
  const out = [];
  let url = `https://api.scryfall.com/cards/search?q=${encodeURIComponent(query)}&unique=${unique}`;
  while (url) {
    const res = await fetch(url, { headers: SCRY_HEADERS });
    if (!res.ok) throw new Error(`Scryfall ${res.status} sur ${url}`);
    const data = await res.json();
    out.push(...data.data);
    url = data.has_more ? data.next_page : null;
    if (url) await new Promise((r) => setTimeout(r, 120));
  }
  return out;
}

function toCard(en, fr) {
  const numeric = (v) => /^-?\d+$/.test(String(v));
  if (!numeric(en.power) || !numeric(en.toughness)) return null; // */X non supporté
  const keywords = (en.keywords ?? []).map((k) => KEYWORD_MAP[k]).filter(Boolean);
  const uniqKw = [...new Set(keywords)];
  const colors = en.colors ?? [];
  const text = uniqKw.map((k) => KEYWORD_LABELS_FR[k]).join(', ');
  return {
    id: snake(en.name),
    name: fr?.name || en.name,
    name_en: en.name,
    type: 'creature',
    colors,
    cost: Math.round(en.cmc ?? 0),
    power: parseInt(en.power, 10),
    toughness: parseInt(en.toughness, 10),
    keywords: uniqKw,
    archetypes: archetypesFor(colors),
    text: text ? `${text}.` : '',
    rarity: en.rarity === 'mythic' ? 'mythic' : en.rarity,
    // Champs d'enrichissement local (non commités) : texte de règles + illustration.
    _oracle: fr?.text ?? en.oracle_text ?? '',
    _artUrl: en.image_uris?.art_crop ?? en.card_faces?.[0]?.image_uris?.art_crop ?? null,
  };
}

// Télécharge une illustration (art_crop) dans public/art/<id>.jpg.
async function downloadArt(url, id) {
  const dest = join(ART_DIR, `${id}.jpg`);
  if (existsSync(dest)) return true;
  const res = await fetch(url, { headers: SCRY_HEADERS });
  if (!res.ok) return false;
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
  return true;
}

async function main() {
  const cacheIdx = process.argv.indexOf('--cache');
  const cacheDir = cacheIdx >= 0 ? process.argv[cacheIdx + 1] : null;

  const en = await fetchPages(
    'set:blb -type:land',
    cacheDir ? [join(cacheDir, 'en1.json'), join(cacheDir, 'en2.json')] : null
  );
  const fr = await fetchPages(
    'set:blb lang:fr -type:land',
    cacheDir ? [join(cacheDir, 'fr1.json'), join(cacheDir, 'fr2.json')] : null,
    'prints'
  );

  const frByOracle = new Map();
  for (const c of fr) {
    if (c.oracle_id && c.printed_name) frByOracle.set(c.oracle_id, { name: c.printed_name, text: c.printed_text ?? '' });
  }

  const creatures = en.filter(
    (c) => (c.type_line ?? '').includes('Creature') && !c.name.startsWith('A-') // exclut les variantes Arena rebalancées
  );
  const cards = [];
  const seen = new Set();
  for (const c of creatures) {
    const card = toCard(c, frByOracle.get(c.oracle_id));
    if (!card || seen.has(card.id)) continue;
    seen.add(card.id);
    cards.push(card);
  }
  cards.sort((a, b) => a.cost - b.cost || a.id.localeCompare(b.id));

  // Enrichissement LOCAL (git-ignoré) : texte de règles imprimé + illustration.
  // On ne met JAMAIS ce contenu (droits d'auteur) dans le JSON de base commité.
  const artMode = process.argv.includes('--art');
  if (artMode) mkdirSync(ART_DIR, { recursive: true });
  const local = {};
  let art = 0;
  for (const c of cards) {
    const entry = {};
    if (c._oracle) entry.oracle = c._oracle;
    if (artMode && c._artUrl && (await downloadArt(c._artUrl, c.id))) {
      entry.art = `art/${c.id}.jpg`;
      art++;
      await new Promise((r) => setTimeout(r, 90)); // courtoisie Scryfall
    }
    if (Object.keys(entry).length) local[c.id] = entry;
  }
  for (const c of cards) {
    delete c._oracle;
    delete c._artUrl;
  }

  const out = {
    _meta: {
      version: '1.0',
      category: 'cards',
      source: 'Scryfall set:blb (import auto — créatures ; mots-clés évergreens mappés)',
      description:
        'Base commitée : stats/mots-clés/couleurs/nom FR + tag archétype. Le texte de règles et les illustrations (droits d\'auteur) sont générés en local dans cards-bloomburrow.local.json (git-ignoré) et fusionnés au chargement.',
      keyword_labels_fr: KEYWORD_LABELS_FR,
      generated_at: new Date().toISOString().slice(0, 10),
      count: cards.length,
    },
    cards,
  };
  writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');
  writeFileSync(
    LOCAL,
    JSON.stringify({ _meta: { note: 'Enrichissement local (droits d\'auteur) — NE PAS committer.', generated_at: new Date().toISOString().slice(0, 10) }, cards: local }, null, 2) + '\n'
  );
  console.log(`Écrit ${cards.length} créatures dans ${OUT}`);
  console.log(`Enrichissement local : ${Object.keys(local).length} entrées (texte${artMode ? ` + ${art} illustrations` : ''}) → ${LOCAL}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
