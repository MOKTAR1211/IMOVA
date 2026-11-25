const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

// ══════════════════════════════════════════════════════════════════════
// 1. POST /api/visits — Créer une demande de visite (Client)
// ══════════════════════════════════════════════════════════════════════
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { property_id, visit_date, visit_time, message } = req.body;
    const userId = req.user.id;

    // 1. Validation des champs obligatoires
    if (!property_id || !visit_date || !visit_time) {
      return res.status(400).json({
        message: "L'identifiant du bien, la date et l'heure sont obligatoires.",
      });
    }

    // 2. Validation que la date n'est pas dans le passé
    const today = new Date().toISOString().split("T")[0];
    if (visit_date < today) {
      return res.status(400).json({
        message: "La date de visite ne peut pas être dans le passé.",
      });
    }

    // 3. Vérifier que le bien existe et récupérer son propriétaire
    const propResult = await pool.query(
      "SELECT id, titre, proprietaire_id, status FROM properties WHERE id = $1",
      [property_id]
    );

    if (propResult.rows.length === 0) {
      return res.status(404).json({ message: "Bien immobilier introuvable." });
    }

    const property = propResult.rows[0];

    // 4. Vérifier la disponibilité du bien
    if (property.status && property.status !== "disponible") {
      return res.status(409).json({
        message: "Ce bien n'est plus disponible pour une visite.",
      });
    }

    // 5. Empêcher le propriétaire de visiter son propre bien
    if (property.proprietaire_id === userId) {
      return res.status(400).json({
        message: "Vous êtes le propriétaire de cette annonce. Vous ne pouvez pas demander de visite.",
      });
    }

    // 6. Contrôle anti-doublon / conflit de créneau (Exigence 6)
    // Empêcher les doubles réservations pour le même bien sur le même créneau
    const conflictResult = await pool.query(
      `SELECT id FROM visits
       WHERE property_id = $1
         AND visit_date = $2
         AND visit_time = $3
         AND status IN ('en_attente', 'confirmee', 'acceptee')`,
      [property_id, visit_date, visit_time]
    );

    if (conflictResult.rows.length > 0) {
      return res.status(409).json({
        message: `Ce créneau (${visit_time} le ${visit_date}) est déjà réservé pour ce bien. Veuillez choisir un autre créneau.`,
      });
    }

    // 7. Enregistrer la réservation avec statut 'en_attente'
    const insertResult = await pool.query(
      `INSERT INTO visits (property_id, user_id, owner_id, visit_date, visit_time, message, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'en_attente')
       RETURNING *`,
      [
        property_id,
        userId,
        property.proprietaire_id,
        visit_date,
        visit_time,
        message || "",
      ]
    );

    const newVisit = insertResult.rows[0];

    // 8. Notifier le propriétaire par notification interne
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES ($1, $2, $3, $4)`,
        [
          property.proprietaire_id,
          "Nouvelle demande de visite 📅",
          `Une visite a été demandée pour "${property.titre}" le ${visit_date} à ${visit_time}.`,
          "/mes-visites",
        ]
      );
    } catch (notifErr) {
      console.warn("Notification non envoyée:", notifErr.message);
    }

    return res.status(201).json({
      message: "Demande de visite enregistrée avec succès ! En attente de confirmation.",
      visit: newVisit,
    });
  } catch (error) {
    console.error("Erreur création visite :", error);
    return res.status(500).json({ message: "Erreur lors de la réservation." });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 2. GET /api/visits/my-visits — Récupérer les visites de l'utilisateur
// ══════════════════════════════════════════════════════════════════════
router.get("/my-visits", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT v.*,
              p.titre AS property_title,
              p.ville AS city,
              p.quartier AS district,
              p.prix AS property_price,
              p.image_url,
              u_client.nom AS client_name,
              u_client.email AS client_email,
              u_client.phone AS client_phone,
              u_owner.nom AS owner_name,
              u_owner.phone AS owner_phone,
              u_owner.email AS owner_email
       FROM visits v
       JOIN properties p ON v.property_id = p.id
       LEFT JOIN users u_client ON v.user_id = u_client.id
       LEFT JOIN users u_owner ON v.owner_id = u_owner.id
       WHERE v.user_id = $1 OR v.owner_id = $1
       ORDER BY v.visit_date DESC, v.visit_time DESC`,
      [userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération mes visites :", error);
    return res.status(500).json({ message: "Impossible de charger les visites." });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 3. GET /api/visits/property/:propertyId/booked-slots — Créneaux réservés
// ══════════════════════════════════════════════════════════════════════
router.get("/property/:propertyId/booked-slots", async (req, res) => {
  try {
    const { propertyId } = req.params;
    const { date } = req.query;

    let query = `
      SELECT visit_date, visit_time, status
      FROM visits
      WHERE property_id = $1
        AND status IN ('en_attente', 'confirmee', 'acceptee')
    `;
    const params = [propertyId];

    if (date) {
      query += ` AND visit_date = $2`;
      params.push(date);
    }

    const result = await pool.query(query, params);
    return res.json(result.rows);
  } catch (error) {
    console.error("Erreur créneaux réservés :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 4. GET /api/visits/admin/all — Toutes les réservations (Admin)
// ══════════════════════════════════════════════════════════════════════
router.get("/admin/all", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT v.*,
              p.titre AS property_title,
              p.ville AS city,
              u_client.nom AS client_name,
              u_client.email AS client_email,
              u_owner.nom AS owner_name,
              u_owner.email AS owner_email
       FROM visits v
       JOIN properties p ON v.property_id = p.id
       LEFT JOIN users u_client ON v.user_id = u_client.id
       LEFT JOIN users u_owner ON v.owner_id = u_owner.id
       ORDER BY v.created_at DESC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error("Erreur admin toutes les visites :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// ══════════════════════════════════════════════════════════════════════
// 5. PATCH /api/visits/:id/status — Mettre à jour le statut
// ══════════════════════════════════════════════════════════════════════
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const visitId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    const validStatuses = ["en_attente", "confirmee", "acceptee", "annulee", "terminee"];
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({
        message: `Statut invalide. Statuts autorisés : ${validStatuses.join(", ")}`,
      });
    }

    // Récupérer la visite
    const visitResult = await pool.query(
      "SELECT v.*, p.titre AS property_title FROM visits v JOIN properties p ON v.property_id = p.id WHERE v.id = $1",
      [visitId]
    );

    if (visitResult.rows.length === 0) {
      return res.status(404).json({ message: "Visite introuvable." });
    }

    const visit = visitResult.rows[0];

    // Vérification des droits :
    // - Le client peut uniquement ANNULER sa visite
    // - Le propriétaire ou l'administrateur peut confirmer, annuler, ou marquer terminée
    const isClient = visit.user_id === userId;
    const isOwner = visit.owner_id === userId;
    const isAdmin = userRole === "admin";

    if (!isClient && !isOwner && !isAdmin) {
      return res.status(403).json({
        message: "Vous n'êtes pas autorisé à modifier cette réservation.",
      });
    }

    if (isClient && !isOwner && !isAdmin && status !== "annulee") {
      return res.status(403).json({
        message: "En tant que client, vous pouvez uniquement annuler votre visite.",
      });
    }

    // Normaliser 'acceptee' en 'confirmee'
    const normalizedStatus = status === "acceptee" ? "confirmee" : status;

    const updateResult = await pool.query(
      `UPDATE visits
       SET status = $1
       WHERE id = $2
       RETURNING *`,
      [normalizedStatus, visitId]
    );

    // Envoyer une notification à l'autre partie
    const notifyUserId = isClient ? visit.owner_id : visit.user_id;
    const statusLabels = {
      confirmee: "confirmée ✅",
      annulee: "annulée ❌",
      terminee: "marquée comme terminée 🏁",
      en_attente: "mise en attente ⏳",
    };

    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES ($1, $2, $3, $4)`,
        [
          notifyUserId,
          "Statut de visite mis à jour 📅",
          `La visite pour "${visit.property_title}" a été ${statusLabels[normalizedStatus] || normalizedStatus}.`,
          "/mes-visites",
        ]
      );
    } catch (notifErr) {
      console.warn("Notification non envoyée:", notifErr.message);
    }

    return res.json({
      message: `Visite mise à jour : ${normalizedStatus}`,
      visit: updateResult.rows[0],
    });
  } catch (error) {
    console.error("Erreur mise à jour visite :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
