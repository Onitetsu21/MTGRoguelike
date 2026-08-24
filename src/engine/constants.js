// Constantes de règles du POC (Jalon 1).
// Aucune valeur de carte ici — uniquement les paramètres globaux du combat.

export const STARTING_HP = 20;
export const MANA_CAP = 5; // plafond fixe pour ce POC
export const STARTING_HAND_SIZE = 7;
export const MAX_EXTRA_DRAWS = 2; // pioches supplémentaires max (=> 9 cartes vues au total)
export const EXTRA_DRAW_INTERVAL = 2; // +1 carte tous les 2 tours

export const KEYWORDS = {
  FLYING: 'flying', // Vol : ne peut être attaqué que par une créature avec Vol ou Portée
  TRAMPLE: 'trample', // Piétinement : l'excédent de dégâts létaux passe au joueur adverse
  DEATHTOUCH: 'deathtouch', // Toucher mortel : 1 dégât suffit à détruire la créature touchée
  LIFELINK: 'lifelink', // Lien de vie : les dégâts infligés soignent le contrôleur
  HASTE: 'haste', // Célérité : peut attaquer le tour où elle arrive
  REACH: 'reach', // Portée : peut attaquer les créatures avec Vol
  INITIATIVE: 'initiative', // Initiative : inflige ses dégâts avant la riposte (premier frappe)
  INDESTRUCTIBLE: 'indestructible', // Indestructible : ne meurt ni des dégâts ni des effets « détruire »
};

export const CARD_TYPES = {
  CREATURE: 'creature',
  SORCERY: 'sorcery',
};

// Déclencheurs de capacités (Jalon 3). Vocabulaire fermé.
export const TRIGGERS = {
  CAST: 'cast', // à la résolution d'un rituel
  ON_ENTER: 'on_enter', // ETB : la créature arrive en jeu
  ON_ATTACK: 'on_attack', // la créature déclare une attaque
  ON_DEATH: 'on_death', // la créature meurt
  ON_SPELL_CAST: 'on_spell_cast', // le contrôleur joue un rituel
  ON_MANA_TIER: 'on_mana_tier', // palier de mana atteint en début de tour (Percée)
  ON_TARGETED_BY_OWN: 'on_targeted_by_own', // une créature contrôlée est ciblée par un sort du contrôleur (Vaillance)
};

// Vocabulaire d'effets fermé (Jalon 3).
export const EFFECT_TYPES = {
  DEAL_DAMAGE: 'deal_damage',
  BUFF: 'buff',
  GAIN_LIFE: 'gain_life',
  CREATE_TOKEN: 'create_token',
  DESTROY: 'destroy',
  DRAW: 'draw',
  GRANT_KEYWORD: 'grant_keyword',
};
