const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");

// Helper pour créer une notification et l'émettre en temps réel via Socket.IO
async function createAndEmitNotification(io, { userId, title, message, link = "" }) {
  const result = await pool.query(
    `INSERT INTO notifications (user_id, title, message, link, is_read, created_at)
     VALUES ($1, $2, $3, $4, FALSE, CURRENT_TIMESTAMP)
     RETURNING id, user_id, title, message, link, is_read, created_at`,
    [userId, title, message, link]
  );

  const notification = result.rows[0];

  if (io) {
    io.to(`user:${userId}`).emit("notification:new", notification);
  }

  return notification;
}

// Récupérer les notifications de l'utilisateur connecté
router.get("/", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, user_id, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [userId]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération notifications :", error);
    res.status(500).json({ message: "Erreur lors de la récupération des notifications." });
  }
});

// Marquer toutes les notifications comme lues
router.patch("/read-all", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1`,
      [userId]
    );

    res.json({ message: "Toutes les notifications ont été marquées comme lues." });
  } catch (error) {
    console.error("Erreur read-all notifications :", error);
    res.status(500).json({ message: "Impossible de modifier les notifications." });
  }
});

// Marquer une notification spécifique comme lue
router.patch("/:id/read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const notificationId = parseInt(req.params.id, 10);

    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id, user_id, title, message, link, is_read, created_at`,
      [notificationId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Notification introuvable." });
    }

    res.json({
      message: "Notification marquée comme lue.",
      notification: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur lecture notification :", error);
    res.status(500).json({ message: "Impossible de marquer comme lu." });
  }
});

// Créer une notification (utilisé en interne ou par une route de test)
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { userId, title, message, link } = req.body;
    const targetUserId = userId || req.user.id;

    if (!title || !message) {
      return res.status(400).json({ message: "Le titre et le message sont requis." });
    }

    const io = req.app.get("io");
    const notification = await createAndEmitNotification(io, {
      userId: targetUserId,
      title,
      message,
      link: link || "",
    });

    res.status(201).json({
      message: "Notification créée et émise avec succès.",
      notification,
    });
  } catch (error) {
    console.error("Erreur création notification :", error);
    res.status(500).json({ message: "Erreur lors de la création de la notification." });
  }
});

module.exports = router;
module.exports.createAndEmitNotification = createAndEmitNotification;
