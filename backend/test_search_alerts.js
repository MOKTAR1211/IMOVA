const assert = require("node:assert/strict");
const { matchesAlert } = require("./utils/searchAlerts");

const property = {
  ville: "Cotonou",
  type: "Appartement",
  prix: 150000,
  chambres: 2,
};

assert.equal(
  matchesAlert(
    { city: "cotonou", type: "appartement", min_price: 100000, max_price: 200000, min_bedrooms: 2 },
    property
  ),
  true,
  "une annonce qui satisfait tous les critères doit correspondre"
);
assert.equal(
  matchesAlert({ city: "Porto-Novo" }, property),
  false,
  "une ville différente ne doit pas correspondre"
);
assert.equal(
  matchesAlert({ type: "maison" }, property),
  false,
  "un type de bien différent ne doit pas correspondre"
);
assert.equal(
  matchesAlert({ max_price: 149999 }, property),
  false,
  "un bien au-dessus du budget maximal ne doit pas correspondre"
);
assert.equal(
  matchesAlert({ min_bedrooms: 3 }, property),
  false,
  "un bien avec moins de chambres ne doit pas correspondre"
);
assert.equal(
  matchesAlert({ type: "parcelle" }, { ...property, type: "Terrain" }),
  true,
  "parcelle et terrain doivent partager le même critère"
);
assert.equal(
  matchesAlert({ city: "Abomey-Calavi" }, { ...property, ville: "Calavi" }),
  false,
  "une ville partiellement différente ne doit pas produire d'alerte"
);

console.log("✅ Tests de correspondance des alertes de recherche réussis.");
