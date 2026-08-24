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
};

export const CARD_TYPES = {
  CREATURE: 'creature',
  SORCERY: 'sorcery',
};
