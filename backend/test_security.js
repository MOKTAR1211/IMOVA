const { startIsolatedTestServer } = require("./testUtils/isolatedServer");

async function runSecurityAudit(BASE_URL) {
  console.log("=================================================");
  console.log("🔒 AUDIT DE SÉCURITÉ AUTOMATISÉ — IMMO229 (ÉTAPE 52)");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function record(title, condition, detail = "") {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} — ${detail}`);
      failed++;
    }
  }

  let ownVisitTestPropertyId = null;

  // 1. Vérification des en-têtes HTTP de sécurité
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    record(
      "En-tête X-Content-Type-Options: nosniff présent",
      healthRes.headers.get("x-content-type-options") === "nosniff"
    );
    record(
      "En-tête X-Frame-Options: SAMEORIGIN présent (protection clickjacking)",
      healthRes.headers.get("x-frame-options") === "SAMEORIGIN"
    );
    record(
      "Signature du serveur Express masquée (absence de X-Powered-By)",
      !healthRes.headers.get("x-powered-by")
    );
  } catch (err) {
    record("Serveur accessible", false, err.message);
  }

  // 2. Test Protection contre l'élévation de privilèges (Tentative d'inscription avec rôle Admin)
  try {
    const fakeAdminEmail = `hacker_${Date.now()}@test.com`;
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Hacker Tentative",
        email: fakeAdminEmail,
        password: "password123",
        role: "admin", // Tentative d'auto-attribution admin
      }),
    });
    const regData = await regRes.json();
    record(
      "Élévation de privilèges bloquée : inscription forcée au rôle 'client'",
      regRes.status === 201 && regData.user?.role === "client",
      `Reçu rôle: ${regData.user?.role}`
    );
    const pendingLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail, password: "password123" }),
    });
    const pendingLoginData = await pendingLogin.json();
    record(
      "Connexion bloquée tant que l'adresse e-mail n'est pas confirmée",
      pendingLogin.status === 403 && pendingLoginData.code === "EMAIL_NOT_VERIFIED"
    );

    const earlyResend = await fetch(`${BASE_URL}/api/auth/resend-verification-code`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail }),
    });
    record(
      "Renvoi de code limité pendant la minute de sécurité",
      earlyResend.status === 429
    );

    const wrongCode = regData.testVerificationCode === "000000" ? "000001" : "000000";
    const invalidVerification = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail, code: wrongCode }),
    });
    record(
      "Code incorrect refusé",
      invalidVerification.status === 400
    );

    const verificationRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail, code: regData.testVerificationCode }),
    });
    record(
      "Confirmation du code e-mail unique à 6 chiffres",
      verificationRes.status === 200
    );
    const reusedVerification = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail, code: regData.testVerificationCode }),
    });
    record(
      "Code confirmé inutilisable une seconde fois",
      reusedVerification.status === 400
    );

    const verifiedLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fakeAdminEmail, password: "password123" }),
    });
    record(
      "Connexion autorisée après confirmation de l'adresse e-mail",
      verifiedLogin.status === 200
    );
  } catch (err) {
    record("Test élévation privilèges", false, err.message);
  }

  // 3. Test Validation des entrées d'inscription
  try {
    const badEmailRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Jean Invalide",
        email: "not-an-email",
        password: "validPassword123",
      }),
    });
    record(
      "Validation e-mail : rejet des adresses au format invalide (400)",
      badEmailRes.status === 400
    );

    const shortPwdRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Jean Court",
        email: `valid_${Date.now()}@test.com`,
        password: "123", // Trop court (< 6 car)
      }),
    });
    record(
      "Validation mot de passe : rejet des mots de passe trop courts (400)",
      shortPwdRes.status === 400
    );
  } catch (err) {
    record("Test validation inscription", false, err.message);
  }

  // 4. Test Authentification & Tokens
  let jeanToken = "";
  let moktarToken = "";
  let adminToken = "";

  try {
    // Connexion Client
    const jeanRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "jean@test.com", password: "test229" }),
    });
    const jeanData = await jeanRes.json();
    jeanToken = jeanData.token;

    // Connexion Propriétaire
    const moktarRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "moktar@test.com", password: "test229" }),
    });
    const moktarData = await moktarRes.json();
    moktarToken = moktarData.token;

    // Connexion Admin
    const adminRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@immo229.bj", password: "test229" }),
    });
    const adminData = await adminRes.json();
    adminToken = adminData.token;

    record("Authentification valide génère un token JWT signé", !!jeanToken && !!moktarToken && !!adminToken);
  } catch (err) {
    record("Test authentification", false, err.message);
  }

  // 5. Test Protection des routes d'administration (Contrôle d'accès basé sur les rôles - RBAC)
  try {
    // Client tente d'accéder aux statistiques admin
    const clientAdminRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    record(
      "Route Admin inaccessible aux utilisateurs normaux (403 Forbidden)",
      clientAdminRes.status === 403
    );

    // Requête non authentifiée vers admin
    const noAuthAdminRes = await fetch(`${BASE_URL}/api/admin/stats`);
    record(
      "Route Admin inaccessible sans token d'authentification (401 Unauthorized)",
      noAuthAdminRes.status === 401
    );

    // Administrateur légitime accède aux statistiques
    const adminAccessRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    record(
      "Administrateur légitime autorisé sur la route admin (200 OK)",
      adminAccessRes.status === 200
    );
  } catch (err) {
    record("Test sécurité routes admin", false, err.message);
  }

  // 6. Test Sécurité des Biens Immobiliers (IDOR / Ownership)
  try {
    // Client tente de modifier l'annonce #1 appartenant à Moktar
    const editRes = await fetch(`${BASE_URL}/api/properties/1`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jeanToken}`,
      },
      body: JSON.stringify({
        title: "Piratage Titre Modifié",
        description: "Tentative de modification non autorisée",
        city: "Cotonou",
        type: "Maison",
        price: 50000,
      }),
    });
    record(
      "Protection IDOR : modification d'un bien d'un autre utilisateur rejetée (404/403)",
      editRes.status === 404 || editRes.status === 403
    );

    // Client tente de supprimer l'annonce #1 de Moktar
    const delRes = await fetch(`${BASE_URL}/api/properties/1`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    record(
      "Protection IDOR : suppression d'un bien d'un autre utilisateur rejetée (404/403)",
      delRes.status === 404 || delRes.status === 403
    );

    // Tentative de création de bien sans token
    const noAuthCreateRes = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titre: "Bien Sans Auth",
        prix: 100000,
        ville: "Calavi",
        type: "Appartement",
        proprietaire_id: 1,
      }),
    });
    record(
      "Création de bien non authentifiée bloquée (401 Unauthorized)",
      noAuthCreateRes.status === 401
    );
  } catch (err) {
    record("Test sécurité biens immobiliers", false, err.message);
  }

  // 7. Test Sécurité des Réservations de Visites
  let visitTestPropertyId = null;
  try {
    const ownerProfile = require("jsonwebtoken").decode(moktarToken);
    const ownerPropertiesResponse = await fetch(
      `${BASE_URL}/api/properties/proprietaire/${ownerProfile.id}`
    );
    const ownerProperties = await ownerPropertiesResponse.json();
    let availableOwnedProperty = ownerProperties.find((property) => property.status === "disponible");

    if (!availableOwnedProperty) {
      const testPropertyResponse = await fetch(`${BASE_URL}/api/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          titre: "Annonce test réservation propriétaire",
          prix: 100000,
          ville: "Cotonou",
          type: "Appartement",
          proprietaire_id: ownerProfile.id,
        }),
      });
      const testPropertyData = await testPropertyResponse.json();
      ownVisitTestPropertyId = testPropertyData.property?.id;

      if (testPropertyResponse.status === 201 && ownVisitTestPropertyId) {
        await fetch(`${BASE_URL}/api/admin/properties/${ownVisitTestPropertyId}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        availableOwnedProperty = { id: ownVisitTestPropertyId };
      }
    }

    // Un utilisateur ne peut pas réserver son propre bien disponible.
    const ownVisitRes = await fetch(`${BASE_URL}/api/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${moktarToken}`,
      },
      body: JSON.stringify({
        property_id: availableOwnedProperty?.id,
        visit_date: "2026-11-01",
        visit_time: "10:00",
      }),
    });
    record(
      "Interdiction de demander une visite de son propre bien (400 Bad Request)",
      Boolean(availableOwnedProperty) && ownVisitRes.status === 400,
      "Aucune annonce disponible appartenant au propriétaire de test."
    );

    if (!availableOwnedProperty) {
      const ownerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "moktar@test.com", password: "test229" }),
      });
      const ownerData = await ownerLogin.json();
      const ownerId = require("jsonwebtoken").decode(ownerData.token)?.id;
      const propertyResponse = await fetch(`${BASE_URL}/api/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          titre: "Annonce test autorisation visite",
          prix: 100000,
          ville: "Cotonou",
          type: "Appartement",
          proprietaire_id: ownerId,
        }),
      });
      const propertyData = await propertyResponse.json();
      visitTestPropertyId = propertyData.property?.id;
      if (visitTestPropertyId) {
        await fetch(`${BASE_URL}/api/admin/properties/${visitTestPropertyId}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        availableOwnedProperty = { id: visitTestPropertyId };
      }
    }

    const visitDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const createVisit = await fetch(`${BASE_URL}/api/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jeanToken}`,
      },
      body: JSON.stringify({
        property_id: availableOwnedProperty?.id,
        visit_date: visitDate,
        visit_time: `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`,
      }),
    });
    const createdVisit = await createVisit.json();

    // Client tente de confirmer sa propre visite (réservé au propriétaire / admin).
    const clientConfirmRes = await fetch(`${BASE_URL}/api/visits/${createdVisit.visit?.id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jeanToken}`,
      },
      body: JSON.stringify({ status: "confirmee" }),
    });
    record(
      "Un client ne peut pas confirmer une visite lui-même (403 Forbidden)",
      Boolean(createdVisit.visit?.id) && clientConfirmRes.status === 403,
      `Création visite: ${createVisit.status}, réponse: ${clientConfirmRes.status}`
    );
  } catch (err) {
    record("Test sécurité réservations", false, err.message);
  } finally {
    const fixturePropertyId = visitTestPropertyId || ownVisitTestPropertyId;
    if (fixturePropertyId && moktarToken) {
      await fetch(`${BASE_URL}/api/properties/${fixturePropertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${moktarToken}` },
      }).catch(() => {});
    }
  }

  // 8. Test sécurisation des photos d'annonces
  let uploadTestPropertyId = null;
  try {
    const unauthenticatedUpload = await fetch(`${BASE_URL}/api/properties/upload`, {
      method: "POST",
      body: new FormData(),
    });
    record(
      "Upload de photos inaccessible sans authentification (401)",
      unauthenticatedUpload.status === 401
    );

    const clientUploadForm = new FormData();
    clientUploadForm.append("images", new Blob(["not an image"], { type: "image/jpeg" }), "fake.jpg");
    const clientUpload = await fetch(`${BASE_URL}/api/properties/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeanToken}` },
      body: clientUploadForm,
    });
    record(
      "Upload de photos refusé au rôle client (403)",
      clientUpload.status === 403
    );

    const ownerProperty = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${moktarToken}`,
      },
      body: JSON.stringify({
        titre: "Annonce test sécurisation photos",
        prix: 100000,
        ville: "Cotonou",
        type: "Appartement",
      }),
    });
    const propertyData = await ownerProperty.json();
    uploadTestPropertyId = propertyData.property?.id;

    if (ownerProperty.status === 201 && uploadTestPropertyId) {
      const validJpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
      const ownerUploadForm = new FormData();
      ownerUploadForm.append("images", new Blob([validJpeg], { type: "image/jpeg" }), "valid.jpg");
      const ownerUpload = await fetch(`${BASE_URL}/api/properties/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${moktarToken}` },
        body: ownerUploadForm,
      });
      const ownerUploadData = await ownerUpload.json();
      record("Upload d'une photo valide autorisé au propriétaire (200)", ownerUpload.status === 200);

      const association = await fetch(`${BASE_URL}/api/properties/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${moktarToken}`,
        },
        body: JSON.stringify({
          property_id: uploadTestPropertyId,
          image_url: ownerUploadData.images?.[0],
        }),
      });
      record(
        "Association de photo autorisée au propriétaire de l'annonce (201)",
        association.status === 201
      );

      const crossOwnerAssociation = await fetch(`${BASE_URL}/api/properties/images`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${jeanToken}`,
        },
        body: JSON.stringify({
          property_id: uploadTestPropertyId,
          image_url: ownerUploadData.images?.[0],
        }),
      });
      record(
        "Association de photo refusée au rôle client (403)",
        crossOwnerAssociation.status === 403
      );
    } else {
      record("Préparation de l'annonce de test pour les photos (201)", false);
    }
  } catch (err) {
    record("Test sécurisation des photos", false, err.message);
  } finally {
    if (uploadTestPropertyId && moktarToken) {
      await fetch(`${BASE_URL}/api/properties/${uploadTestPropertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${moktarToken}` },
      }).catch(() => {});
    }
  }

  // 9. Test Protection contre les Injections SQL (Recherche avancée)
  try {
    const sqlInjectionPayload = "Cotonou' OR '1'='1' --";
    const searchRes = await fetch(
      `${BASE_URL}/api/properties/search/advanced?city=${encodeURIComponent(sqlInjectionPayload)}`
    );
    const searchData = await searchRes.json();
    record(
      "Requêtes paramétrées : charge malicieuse SQL traitée comme texte brut (zéro injection)",
      searchRes.status === 200 && Array.isArray(searchData) && searchData.length === 0
    );
  } catch (err) {
    record("Test injection SQL", false, err.message);
  }

  console.log("\n=================================================");
  console.log(`RÉSULTAT GLOBAL : ${passed} TESTS RÉUSSIS / ${passed + failed} TOTAUX`);
  if (failed === 0) {
    console.log("🎉 TOUTES LES PROTECTIONS DE SÉCURITÉ SONT VALIDÉES !");
  } else {
    console.error(`⚠️ ${failed} test(s) ont échoué. Vérifier les points ci-dessus.`);
    process.exitCode = 1;
  }
  console.log("=================================================");
}

async function run() {
  const testServer = await startIsolatedTestServer();
  try {
    await runSecurityAudit(testServer.baseUrl);
  } finally {
    await testServer.close();
  }
}

run().catch((error) => {
  console.error("Erreur audit de sécurité :", error);
  process.exitCode = 1;
});
