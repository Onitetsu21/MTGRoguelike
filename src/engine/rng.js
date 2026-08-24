// Utilitaires d'aléatoire, isolés pour rester testables (rng injectable).

// Mélange de Fisher-Yates. Ne modifie pas le tableau d'origine.
// `rng` doit retourner un flottant dans [0, 1). Injectable pour les tests.
export function shuffle(array, rng = Math.random) {
  const out = array.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Entier dans [0, n).
export function randInt(n, rng = Math.random) {
  return Math.floor(rng() * n);
}

// Élément au hasard d'un tableau non vide.
export function pickRandom(array, rng = Math.random) {
  return array[randInt(array.length, rng)];
}
