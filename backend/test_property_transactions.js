const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { startIsolatedTestServer } = require("./testUtils/isolatedServer");
const { jwtSecret } = require("./config/security");

async function run() {
  const testServer = await startIsolatedTestServer();

  try {
    const suffix = crypto.randomUUID();
    const userResult = await testServer.pool.query(
      `INSERT INTO users (nom, email, password, role)
       VALUES ($1, $2, $3, 'proprietaire')
       RETURNING id`,
      ["Property Search Test", `property-search-${suffix}@example.test`, "not-used"]
    );
    const ownerId = userResult.rows[0].id;
    const token = jwt.sign({ id: ownerId, role: "proprietaire" }, jwtSecret);
    const headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };

    const createResponse = await fetch(`${testServer.baseUrl}/api/properties`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        titre: "Transaction de test",
        description: "Annonce créée par le test d’intégration.",
        prix: 120000,
        ville: "Cotonou",
        type: "Appartement",
        transaction_type: "location",
      }),
    });
    const createdData = await createResponse.json();
    assert.equal(createResponse.status, 201, createdData.message);
    const propertyId = createdData.property.id;

    await testServer.pool.query(
      "UPDATE properties SET status = 'disponible' WHERE id = $1",
      [propertyId]
    );
    await testServer.pool.query(
      `INSERT INTO property_views (property_id, viewer_id)
       VALUES ($1, NULL), ($1, NULL), ($1, NULL)`,
      [propertyId]
    );

    const listResponse = await fetch(`${testServer.baseUrl}/api/properties`);
    const listings = await listResponse.json();
    const listing = listings.find((property) => property.id === propertyId);
    assert.ok(listing, "l’annonce disponible doit apparaître dans les résultats");
    assert.equal(listing.transaction_type, "location");
    assert.equal(listing.view_count, 3);

    const updateResponse = await fetch(`${testServer.baseUrl}/api/properties/${propertyId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        titre: "Transaction de test",
        description: "Annonce modifiée par le test d’intégration.",
        prix: 120000,
        ville: "Cotonou",
        type: "Appartement",
        transaction_type: "vente",
      }),
    });
    const updatedData = await updateResponse.json();
    assert.equal(updateResponse.status, 200, updatedData.message);
    assert.equal(updatedData.property.transaction_type, "vente");

    const invalidResponse = await fetch(`${testServer.baseUrl}/api/properties`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        titre: "Transaction invalide",
        description: "Valeur de transaction invalide.",
        prix: 120000,
        ville: "Cotonou",
        type: "Appartement",
        transaction_type: "echange",
      }),
    });
    assert.equal(invalidResponse.status, 400);

    console.log("✅ Tests d’intégration vente/location et consultations réussis.");
  } finally {
    await testServer.close();
  }
}

run().catch((error) => {
  console.error("❌ Échec des tests d’intégration des transactions :", error);
  process.exitCode = 1;
});
