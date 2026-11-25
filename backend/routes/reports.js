const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

const REPORT_REASONS = [
  "Informations trompeuses",
  "Prix incorrect",
  "Annonce déjà louée ou vendue",
  "Contenu suspect ou frauduleux",
  "Photos inappropriées",
  "Autre",
];

router.post("/properties/:propertyId", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({
        message: "Seuls les clients peuvent signaler une annonce.",
      });
    }

    const propertyId = Number(req.params.propertyId);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant d'annonce invalide." });
    }

    const reason = typeof req.body?.reason === "string" ? req.body.reason.trim() : "";
    const description = typeof req.body?.description === "string"
      ? req.body.description.trim()
      : "";

    if (!REPORT_REASONS.includes(reason)) {
      return res.status(400).json({ message: "Veuillez choisir un motif de signalement valide." });
    }
    if (description.length > 1000) {
      return res.status(400).json({ message: "Le commentaire ne peut pas dépasser 1 000 caractères." });
    }

    const propertyResult = await pool.query(
      `SELECT id, proprietaire_id
       FROM properties
       WHERE id = $1 AND status = 'disponible'`,
      [propertyId]
    );

    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ message: "Annonce disponible introuvable." });
    }
    if (String(propertyResult.rows[0].proprietaire_id) === String(req.user.id)) {
      return res.status(403).json({ message: "Vous ne pouvez pas signaler votre propre annonce." });
    }

    const existingReport = await pool.query(
      `SELECT id
       FROM reports
       WHERE property_id = $1 AND reporter_id = $2 AND status = 'en_attente'
       LIMIT 1`,
      [propertyId, req.user.id]
    );

    if (existingReport.rows.length > 0) {
      return res.status(409).json({
        message: "Vous avez déjà signalé cette annonce. L'équipe de modération l'examine.",
      });
    }

    const result = await pool.query(
      `INSERT INTO reports (property_id, reporter_id, reason, description)
       VALUES ($1, $2, $3, $4)
       RETURNING id, property_id, reason, status, created_at`,
      [propertyId, req.user.id, reason, description || null]
    );

    return res.status(201).json({
      message: "Votre signalement a été transmis à l'équipe de modération.",
      report: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur création signalement :", error);
    return res.status(500).json({ message: "Impossible d'enregistrer votre signalement." });
  }
});

module.exports = router;
