const express = require("express");
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/favorites — Récupérer tous les favoris de l'utilisateur
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT p.*, f.id AS favorite_id, f.created_at AS favorite_created_at
       FROM favorites f
       JOIN properties p ON p.id = f.property_id
       WHERE f.user_id = $1
       ORDER BY f.created_at DESC`,
      [userId]
    );

    const formatted = result.rows.map((p) => ({
      id: p.id,
      title: p.titre,
      titre: p.titre,
      description: p.description,
      price: Number(p.prix),
      prix: Number(p.prix),
      priceFormatted: `${Number(p.prix).toLocaleString("fr-FR")} FCFA`,
      location: p.quartier ? `${p.ville}, ${p.quartier}` : p.ville,
      city: p.ville,
      ville: p.ville,
      quartier: p.quartier,
      type: p.type,
      rooms: p.chambres > 0 ? `${p.chambres} chambres` : "Terrain",
      bathrooms: p.douches > 0 ? `${p.douches} douches` : "—",
      image: p.image_url || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      image_url: p.image_url,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      favorite_id: p.favorite_id,
      favorite_created_at: p.favorite_created_at,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Erreur récupération favoris :", error);
    res.status(500).json({ message: "Impossible de charger les favoris." });
  }
});

// GET /api/favorites/check/:propertyId — Vérifier si un bien est favori
router.get("/check/:propertyId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const propertyId = parseInt(req.params.propertyId, 10);

    if (isNaN(propertyId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const result = await pool.query(
      "SELECT id FROM favorites WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );

    res.json({ favorite: result.rows.length > 0 });
  } catch (error) {
    console.error("Erreur vérification favori :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// POST /api/favorites/:propertyId — Ajouter aux favoris
router.post("/:propertyId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const propertyId = parseInt(req.params.propertyId, 10);

    if (isNaN(propertyId)) {
      return res.status(400).json({ message: "Identifiant de bien invalide." });
    }

    // Vérifier que le bien existe
    const propCheck = await pool.query("SELECT id FROM properties WHERE id = $1", [propertyId]);
    if (propCheck.rows.length === 0) {
      return res.status(404).json({ message: "Bien introuvable." });
    }

    await pool.query(
      `INSERT INTO favorites (user_id, property_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, property_id) DO NOTHING`,
      [userId, propertyId]
    );

    res.status(201).json({
      message: "Bien ajouté aux favoris ❤️",
      favorite: true,
    });
  } catch (error) {
    console.error("Erreur ajout favori :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// DELETE /api/favorites/:propertyId — Retirer des favoris
router.delete("/:propertyId", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const propertyId = parseInt(req.params.propertyId, 10);

    if (isNaN(propertyId)) {
      return res.status(400).json({ message: "Identifiant de bien invalide." });
    }

    await pool.query(
      "DELETE FROM favorites WHERE user_id = $1 AND property_id = $2",
      [userId, propertyId]
    );

    res.json({
      message: "Bien retiré des favoris.",
      favorite: false,
    });
  } catch (error) {
    console.error("Erreur suppression favori :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

module.exports = router;
