const express = require("express");
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// GET /api/dashboard/stats — Statistiques du tableau de bord utilisateur
router.get("/stats", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [propRes, visitRes, favRes, msgRes] = await Promise.all([
      pool.query(
        "SELECT COUNT(*)::int AS count FROM properties WHERE proprietaire_id = $1",
        [userId]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM visits WHERE user_id = $1 OR owner_id = $1",
        [userId]
      ),
      pool.query(
        "SELECT COUNT(*)::int AS count FROM favorites WHERE user_id = $1",
        [userId]
      ),
      pool.query(
        `SELECT COUNT(m.id)::int AS count
         FROM messages m
         JOIN conversations c ON c.id = m.conversation_id
         WHERE m.sender_id != $1
           AND (c.buyer_id = $1 OR c.seller_id = $1)
           AND m.is_read = false`,
        [userId]
      ),
    ]);

    res.json({
      properties: propRes.rows[0]?.count || 0,
      visits: visitRes.rows[0]?.count || 0,
      favorites: favRes.rows[0]?.count || 0,
      unreadMessages: msgRes.rows[0]?.count || 0,
    });
  } catch (error) {
    console.error("Erreur statistiques dashboard :", error);
    res.status(500).json({
      message: "Impossible de récupérer les statistiques.",
    });
  }
});

module.exports = router;
