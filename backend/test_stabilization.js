const { startIsolatedTestServer } = require("./testUtils/isolatedServer");

async function runStabilizationTests(BASE_URL) {
  console.log("=================================================");
  console.log("🧪 TESTS DE STABILISATION & NON-RÉGRESSION (ÉTAPE 53)");
  console.log("=================================================\n");

  let passed = 0;
  let failed = 0;

  function test(title, condition, detail = "") {
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} — ${detail}`);
      failed++;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 1 : CONNECTIVITÉ & SANTÉ SERVEUR
  // ══════════════════════════════════════════════════════════
  console.log("--- 1. Connectivité & Santé du Backend ---");
  try {
    const healthRes = await fetch(`${BASE_URL}/api/health`);
    const healthData = await healthRes.json();
    test(
      "Backend en ligne et répondant au ping de santé (/api/health)",
      healthRes.status === 200 && healthData.status === "ok"
    );
  } catch (err) {
    test("Backend accessible", false, err.message);
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 2 : AUTHENTIFICATION, PROFIL & CYCLE DE VIE UTILISATEUR
  // ══════════════════════════════════════════════════════════
  console.log("\n--- 2. Authentification, Profil & Cycle de vie ---");
  const testEmail = `stabilisation_${Date.now()}@test.com`;
  let userToken = "";
  let userId = null;

  try {
    // 2.1 Inscription d'un nouvel utilisateur
    const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nom: "Koffi Testeur",
        email: testEmail,
        password: "PasswordInitial123",
        role: "proprietaire",
      }),
    });
    const regData = await regRes.json();
    test(
      "Inscription d'un utilisateur propriétaire réussie (201)",
      regRes.status === 201 && regData.user?.role === "proprietaire"
    );

    const verificationRes = await fetch(`${BASE_URL}/api/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, code: regData.testVerificationCode }),
    });
    test(
      "Confirmation de l'adresse e-mail par code",
      verificationRes.status === 200
    );

    // 2.2 Connexion après confirmation de l'adresse e-mail
    const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "PasswordInitial123",
      }),
    });
    const loginData = await loginRes.json();
    userToken = loginData.token;
    userId = loginData.user?.id;
    test(
      "Connexion réussie & jeton JWT valide délivré (200)",
      loginRes.status === 200 && !!userToken
    );

    // 2.3 Consultation du profil (/api/auth/me)
    const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const meData = await meRes.json();
    test(
      "Lecture du profil utilisateur via /api/auth/me (200)",
      meRes.status === 200 && meData.email === testEmail
    );

    // 2.4 Modification des informations du profil
    const updateProfileRes = await fetch(`${BASE_URL}/api/auth/profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        first_name: "Koffi",
        last_name: "Modifie",
        email: testEmail,
        phone: "+229 97 00 00 01",
        address: "Cotonou, Haie Vive",
      }),
    });
    test(
      "Mise à jour des coordonnées du profil réussie (200)",
      updateProfileRes.status === 200
    );

    // 2.5 Téléversement d'une photo de profil valide (.jpg)
    const validJpgBuffer = Buffer.from(
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=",
      "base64"
    );
    const formData = new FormData();
    const blob = new Blob([validJpgBuffer], { type: "image/jpeg" });
    formData.append("photo", blob, "avatar_test.jpg");

    const uploadRes = await fetch(`${BASE_URL}/api/auth/profile/photo`, {
      method: "POST",
      headers: { Authorization: `Bearer ${userToken}` },
      body: formData,
    });
    test(
      "Téléversement d'une photo de profil valide .jpg (200)",
      uploadRes.status === 200
    );

    // 2.6 Changement de mot de passe
    const changePwdRes = await fetch(`${BASE_URL}/api/auth/change-password`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        currentPassword: "PasswordInitial123",
        newPassword: "NouveauPassword456",
        confirmPassword: "NouveauPassword456",
      }),
    });
    test(
      "Changement de mot de passe réussi (200)",
      changePwdRes.status === 200
    );

    // 2.7 Re-connexion avec le nouveau mot de passe
    const reLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: testEmail,
        password: "NouveauPassword456",
      }),
    });
    test(
      "Connexion validée avec le nouveau mot de passe (200)",
      reLoginRes.status === 200
    );
  } catch (err) {
    test("Cycle de vie authentification", false, err.message);
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 3 : GESTION DES BIENS IMMOBILIERS (CRUD & PERMISSIONS)
  // ══════════════════════════════════════════════════════════
  console.log("\n--- 3. Gestion des Biens Immobiliers ---");
  let createdPropertyId = null;

  try {
    // 3.1 Création d'un bien par l'utilisateur connecté
    const addPropRes = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        titre: "Villa Moderne Stabilisation Test",
        description: "Superbe villa avec piscine à Fidjrossè",
        prix: 85000000,
        ville: "Cotonou",
        quartier: "Fidjrossè",
        type: "Maison",
        chambres: 4,
        douches: 3,
        latitude: 6.368,
        longitude: 2.385,
        image_url: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80",
      }),
    });
    const addPropData = await addPropRes.json();
    createdPropertyId = addPropData.property?.id;
    test(
      "Publication d'une nouvelle annonce immobilière (201)",
      addPropRes.status === 201 && !!createdPropertyId
    );

    // 3.2 Consultation de la liste générale des biens
    const listRes = await fetch(`${BASE_URL}/api/properties`);
    const listData = await listRes.json();
    test(
      "Catalogue des biens accessible publiquement (200)",
      listRes.status === 200 && Array.isArray(listData)
    );

    // 3.3 Le propriétaire peut consulter sa fiche en attente, mais elle reste privée.
    const detailRes = await fetch(`${BASE_URL}/api/properties/${createdPropertyId}`, {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    const detailData = await detailRes.json();
    test(
      "Consultation détaillée du bien en attente par son propriétaire (200)",
      detailRes.status === 200 && Number(detailData.latitude) === 6.368
    );

    const publicDetailRes = await fetch(`${BASE_URL}/api/properties/${createdPropertyId}`);
    test(
      "Annonce en attente non visible publiquement avant paiement (404)",
      publicDetailRes.status === 404
    );

    // 3.4 Modification de l'annonce par son propriétaire
    const editRes = await fetch(`${BASE_URL}/api/properties/${createdPropertyId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        titre: "Villa Moderne Mise à Jour",
        description: "Villa mise à jour avec description enrichie",
        prix: 90000000,
        city: "Cotonou",
        quartier: "Fidjrossè Plage",
        type: "Maison",
        bedrooms: 4,
        bathrooms: 3,
      }),
    });
    test(
      "Modification de l'annonce par son propriétaire (200)",
      editRes.status === 200
    );

    // 3.5 Une annonce non payée ne peut pas être publiée/changée de statut.
    const statusRes = await fetch(`${BASE_URL}/api/properties/${createdPropertyId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ status: "loue" }),
    });
    test("Changement de statut bloqué tant que le paiement est en attente (403)", statusRes.status === 403);
  } catch (err) {
    test("Gestion des biens immobiliers", false, err.message);
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 4 : SYSTÈME DE RÉSERVATIONS DE VISITES (ÉTAPE 51)
  // ══════════════════════════════════════════════════════════
  console.log("\n--- 4. Réservations de Visites Immobilières ---");
  let visitFixturePropertyId = null;
  try {
    // Connexion Client Jean
    const jeanLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "jean@test.com", password: "test229" }),
    });
    const { token: jeanToken } = await jeanLogin.json();

    // Connexion Propriétaire Moktar
    const moktarLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "moktar@test.com", password: "test229" }),
    });
    const { token: moktarToken } = await moktarLogin.json();
    const ownerId = require("jsonwebtoken").decode(moktarToken).id;
    const publicPropertiesResponse = await fetch(`${BASE_URL}/api/properties`);
    const publicProperties = await publicPropertiesResponse.json();
    let visitProperty = publicProperties.find(
      (property) => Number(property.proprietaire_id) === Number(ownerId)
    );

    if (!visitProperty) {
      const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@immo229.bj", password: "test229" }),
      });
      const { token: adminToken } = await adminLogin.json();
      const fixtureResponse = await fetch(`${BASE_URL}/api/properties`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({
          titre: "Annonce test visite stabilisation",
          prix: 100000,
          ville: "Cotonou",
          type: "Appartement",
          proprietaire_id: ownerId,
        }),
      });
      const fixtureData = await fixtureResponse.json();
      visitFixturePropertyId = fixtureData.property?.id;
      if (fixtureResponse.status === 201 && visitFixturePropertyId) {
        await fetch(`${BASE_URL}/api/admin/properties/${visitFixturePropertyId}/approve`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${adminToken}` },
        });
        visitProperty = { id: visitFixturePropertyId };
      }
    }

    const targetDate = new Date(Date.now() + 45 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const targetTime = `${String(new Date().getHours()).padStart(2, "0")}:${String(new Date().getMinutes()).padStart(2, "0")}`;

    // 4.1 Jean réserve une visite sur une annonce disponible appartenant à Moktar.
    const bookRes = await fetch(`${BASE_URL}/api/visits`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${jeanToken}`,
      },
      body: JSON.stringify({
        property_id: visitProperty?.id,
        visit_date: targetDate,
        visit_time: targetTime,
        message: "Test stabilisation visite",
      }),
    });
    const bookData = await bookRes.json();
    const visitId = bookData.visit?.id;
    test(
      "Création d'une réservation de visite par un client (201)",
      bookRes.status === 201 && !!visitId && Boolean(visitProperty)
    );

    // 4.2 Consultation de l'historique des visites (/api/visits/my-visits)
    const myVisitsRes = await fetch(`${BASE_URL}/api/visits/my-visits`, {
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    const myVisitsData = await myVisitsRes.json();
    test(
      "Consultation de « Mes visites » avec informations complètes (200)",
      myVisitsRes.status === 200 && myVisitsData.some((v) => v.id === visitId)
    );

    // 4.3 Confirmation de la visite par le propriétaire Moktar
    const confirmRes = await fetch(`${BASE_URL}/api/visits/${visitId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${moktarToken}`,
      },
      body: JSON.stringify({ status: "confirmee" }),
    });
    test(
      "Confirmation de la réservation par le propriétaire (200)",
      confirmRes.status === 200
    );

    // 4.4 Clôture de la visite (marquée comme terminée)
    const completeRes = await fetch(`${BASE_URL}/api/visits/${visitId}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${moktarToken}`,
      },
      body: JSON.stringify({ status: "terminee" }),
    });
    test(
      "Clôture de la visite marquée comme 'terminee' (200)",
      completeRes.status === 200
    );
  } catch (err) {
    test("Réservations de visites", false, err.message);
  } finally {
    if (visitFixturePropertyId) {
      const ownerLogin = await fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "moktar@test.com", password: "test229" }),
      });
      const { token: ownerToken } = await ownerLogin.json();
      await fetch(`${BASE_URL}/api/properties/${visitFixturePropertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${ownerToken}` },
      }).catch(() => {});
    }
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 5 : FAVORIS, MESSAGERIE & NOTIFICATIONS
  // ══════════════════════════════════════════════════════════
  console.log("\n--- 5. Favoris, Messagerie & Notifications ---");
  let favoriteFixturePropertyId = null;
  let favoriteAdminToken = "";
  try {
    const jeanLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "jean@test.com", password: "test229" }),
    });
    const { token: jeanToken } = await jeanLogin.json();

    const [adminLogin, ownerLogin] = await Promise.all([
      fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@immo229.bj", password: "test229" }),
      }),
      fetch(`${BASE_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "moktar@test.com", password: "test229" }),
      }),
    ]);
    const [{ token: adminToken }, ownerData] = await Promise.all([
      adminLogin.json(),
      ownerLogin.json(),
    ]);
    favoriteAdminToken = adminToken;

    const fixtureResponse = await fetch(`${BASE_URL}/api/properties`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${favoriteAdminToken}`,
      },
      body: JSON.stringify({
        titre: "Annonce test favoris stabilisation",
        prix: 100000,
        ville: "Cotonou",
        type: "Appartement",
        proprietaire_id: ownerData.user?.id,
      }),
    });
    const fixtureData = await fixtureResponse.json();
    favoriteFixturePropertyId = fixtureData.property?.id;
    const approvalResponse = favoriteFixturePropertyId
      ? await fetch(`${BASE_URL}/api/admin/properties/${favoriteFixturePropertyId}/approve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${favoriteAdminToken}` },
      })
      : null;
    test(
      "Annonce de test approuvée pour les favoris",
      fixtureResponse.status === 201 && approvalResponse?.status === 200
    );

    // 5.1 Ajout aux favoris
    const addFavRes = await fetch(`${BASE_URL}/api/favorites/${favoriteFixturePropertyId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    test("Ajout d'un bien aux favoris (201)", addFavRes.status === 201);

    // 5.2 Vérification d'état favori
    const checkFavRes = await fetch(`${BASE_URL}/api/favorites/check/${favoriteFixturePropertyId}`, {
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    const checkFavData = await checkFavRes.json();
    test(
      "Vérification de l'état favori d'un bien (200, favorite: true)",
      checkFavRes.status === 200 && checkFavData.favorite === true
    );

    // 5.3 Liste des favoris
    const listFavRes = await fetch(`${BASE_URL}/api/favorites`, {
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    const listFavData = await listFavRes.json();
    test(
      "Récupération de la liste des favoris (200)",
      listFavRes.status === 200 && Array.isArray(listFavData)
    );

    // 5.4 Retrait des favoris
    const delFavRes = await fetch(`${BASE_URL}/api/favorites/${favoriteFixturePropertyId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    test("Suppression d'un favori (200)", delFavRes.status === 200);

    // 5.5 Notifications
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${jeanToken}` },
    });
    test(
      "Récupération des notifications utilisateur (200)",
      notifRes.status === 200
    );
  } catch (err) {
    test("Favoris, messagerie & notifications", false, err.message);
  } finally {
    if (favoriteFixturePropertyId && favoriteAdminToken) {
      await fetch(`${BASE_URL}/api/properties/${favoriteFixturePropertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${favoriteAdminToken}` },
      }).catch((error) => {
        console.warn("Avertissement nettoyage annonce de test favoris:", error.message);
      });
    }
  }

  // ══════════════════════════════════════════════════════════
  // SECTION 6 : TABLEAU DE BORD ADMINISTRATEUR (ÉTAPE 52)
  // ══════════════════════════════════════════════════════════
  console.log("\n--- 6. Administration & Contrôles Plateforme ---");
  try {
    const adminLogin = await fetch(`${BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "admin@immo229.bj", password: "test229" }),
    });
    const { token: adminToken } = await adminLogin.json();

    // 6.1 Statistiques globales
    const adminStatsRes = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminStatsData = await adminStatsRes.json();
    test(
      "Statistiques globales admin accessibles (200)",
      adminStatsRes.status === 200 && adminStatsData.users >= 2
    );

    // 6.2 Liste des utilisateurs pour l'administration
    const adminUsersRes = await fetch(`${BASE_URL}/api/admin/users`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const adminUsersData = await adminUsersRes.json();
    test(
      "Liste des utilisateurs pour l'administration sans fuite de mot de passe (200)",
      adminUsersRes.status === 200 &&
        Array.isArray(adminUsersData) &&
        !adminUsersData[0].password
    );
  } catch (err) {
    test("Administration plateforme", false, err.message);
  }

  // ══════════════════════════════════════════════════════════
  // NETTOYAGE : Suppression du bien de test créé
  // ══════════════════════════════════════════════════════════
  if (createdPropertyId && userToken) {
    try {
      const delPropRes = await fetch(`${BASE_URL}/api/properties/${createdPropertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${userToken}` },
      });
      test(
        "Nettoyage : suppression de l'annonce de test par son propriétaire (200)",
        delPropRes.status === 200
      );
    } catch (cleanErr) {
      console.warn("Avertissement nettoyage:", cleanErr.message);
    }
  }

  console.log("\n=================================================");
  console.log(`BILAN STABILISATION : ${passed} TESTS RÉUSSIS / ${passed + failed} TOTAUX`);
  if (failed === 0) {
    console.log("🎉 TOUTES LES FONCTIONNALITÉS SONT STABLES ET OPÉRATIONNELLES !");
  } else {
    console.error(`⚠️ ${failed} anomalie(s) détectée(s).`);
    process.exitCode = 1;
  }
  console.log("=================================================");
}

async function run() {
  const testServer = await startIsolatedTestServer();
  try {
    await runStabilizationTests(testServer.baseUrl);
  } finally {
    await testServer.close();
  }
}

run().catch((error) => {
  console.error("Erreur tests de stabilisation :", error);
  process.exitCode = 1;
});
