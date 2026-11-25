const express = require("express");
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

router.use(authMiddleware);

router.get("/", async (req, res) => {
  if (req.user.role !== "client") {
    return res.status(403).json({ message: "Les alertes de recherche sont réservées aux clients." });
  }

  try {
    const result = await pool.query(
      `SELECT id, city, type, min_price, max_price, min_bedrooms, is_active, created_at
       FROM search_alerts
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.user.id]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erreur chargement alertes de recherche :", error.message);
    return res.status(500).json({ message: "Impossible de charger les alertes de recherche." });
  }
});

router.post("/", async (req, res) => {
  if (req.user.role !== "client") {
    return res.status(403).json({ message: "Les alertes de recherche sont réservées aux clients." });
  }

  const { city, type, minPrice, maxPrice, bedrooms } = req.body;
  const cleanCity = typeof city === "string" ? city.trim() : "";
  const cleanType = typeof type === "string" ? type.trim().toLowerCase() : "";
  const min = minPrice === "" || minPrice == null ? null : Number(minPrice);
  const max = maxPrice === "" || maxPrice == null ? null : Number(maxPrice);
  const minimumBedrooms = bedrooms === "" || bedrooms == null ? null : Number(bedrooms);

  if (cleanCity.length > 100 || cleanType.length > 50) {
    return res.status(400).json({ message: "La ville ou le type de bien est trop long." });
  }
  if (
    (min !== null && (!Number.isFinite(min) || min < 0))
    || (max !== null && (!Number.isFinite(max) || max < 0))
    || (minimumBedrooms !== null && (!Number.isInteger(minimumBedrooms) || minimumBedrooms < 0))
    || (min !== null && max !== null && min > max)
  ) {
    return res.status(400).json({ message: "Les critères de budget ou de chambres sont invalides." });
  }

  try {
    const duplicate = await pool.query(
      `SELECT id FROM search_alerts
       WHERE user_id = $1
         AND LOWER(COALESCE(city, '')) = LOWER($2)
         AND LOWER(COALESCE(type, '')) = LOWER($3)
         AND min_price IS NOT DISTINCT FROM $4
         AND max_price IS NOT DISTINCT FROM $5
         AND min_bedrooms IS NOT DISTINCT FROM $6
       LIMIT 1`,
      [req.user.id, cleanCity, cleanType, min, max, minimumBedrooms]
    );

    if (duplicate.rows.length) {
      return res.status(409).json({ message: "Cette alerte de recherche existe déjà." });
    }

    const result = await pool.query(
      `INSERT INTO search_alerts (user_id, city, type, min_price, max_price, min_bedrooms)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, city, type, min_price, max_price, min_bedrooms, is_active, created_at`,
      [
        req.user.id,
        cleanCity || null,
        cleanType || null,
        min,
        max,
        minimumBedrooms,
      ]
    );
    return res.status(201).json({ alert: result.rows[0] });
  } catch (error) {
    console.error("Erreur création alerte de recherche :", error.message);
    return res.status(500).json({ message: "Impossible d'enregistrer l'alerte de recherche." });
  }
});

router.delete("/:id", async (req, res) => {
  if (req.user.role !== "client") {
    return res.status(403).json({ message: "Les alertes de recherche sont réservées aux clients." });
  }

  const alertId = Number(req.params.id);
  if (!Number.isInteger(alertId) || alertId <= 0) {
    return res.status(400).json({ message: "Identifiant d'alerte invalide." });
  }

  try {
    const result = await pool.query(
      "DELETE FROM search_alerts WHERE id = $1 AND user_id = $2 RETURNING id",
      [alertId, req.user.id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ message: "Alerte introuvable." });
    }
    return res.json({ message: "Alerte de recherche supprimée." });
  } catch (error) {
    console.error("Erreur suppression alerte de recherche :", error.message);
    return res.status(500).json({ message: "Impossible de supprimer l'alerte." });
  }
});

module.exports = router;
