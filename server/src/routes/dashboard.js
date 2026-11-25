const express = require("express");
const router = express.Router();
const prisma = require("../db");
const authenticateToken = require("../middleware/auth");

router.get("/stats", authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    // 1. Annonces publiées par l'utilisateur (propriétaire)
    const propertiesCount = await prisma.bien.count({
      where: { proprietaireId: userId },
    });

    // 2. Visites demandées par l'utilisateur
    const visitsCount = await prisma.visit.count({
      where: { userId: userId },
    });

    // 3. Messages non lus reçus par l'utilisateur
    const unreadMessagesCount = await prisma.message.count({
      where: {
        receiverId: userId,
        isRead: false,
      },
    });

    // 4. Favoris enregistrés par l'utilisateur
    const favoritesCount = await prisma.favorite.count({
      where: { userId: userId },
    });

    res.json({
      properties: propertiesCount,
      visits: visitsCount,
      unreadMessages: unreadMessagesCount,
      favorites: favoritesCount,
    });
  } catch (error) {
    console.error("Erreur statistiques dashboard :", error);
    res.status(500).json({
      message: "Impossible de récupérer les statistiques.",
    });
  }
});

module.exports = router;
