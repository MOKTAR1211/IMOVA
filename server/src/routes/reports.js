const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');

// 🚨 Signaler une annonce
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { property_id, reason, description } = req.body;
    const user_id = req.user.id;

    if (!property_id || !reason) {
      return res.status(400).json({
        message: 'Le bien et la raison sont obligatoires',
      });
    }

    // Vérifier que le bien existe
    const property = await prisma.bien.findUnique({
      where: { id: parseInt(property_id, 10) },
    });

    if (!property) {
      return res.status(404).json({
        message: 'Bien immobilier introuvable',
      });
    }

    // Vérifier si l'utilisateur a déjà signalé ce bien
    const existingReport = await prisma.report.findFirst({
      where: {
        bienId: parseInt(property_id, 10),
        userId: user_id,
        status: 'pending',
      },
    });

    if (existingReport) {
      return res.status(400).json({
        message: 'Vous avez déjà signalé cette annonce',
      });
    }

    const report = await prisma.report.create({
      data: {
        bienId: parseInt(property_id, 10),
        userId: user_id,
        reason,
        description: description || null,
      },
    });

    res.status(201).json({
      message: 'Annonce signalée avec succès',
      report,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Erreur lors du signalement',
    });
  }
});

module.exports = router;
