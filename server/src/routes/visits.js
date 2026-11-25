const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// 📅 Demander une visite
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { property_id, visit_date, visit_time, message } = req.body;
    const user_id = req.user.id;

    if (!property_id || !visit_date || !visit_time) {
      return res.status(400).json({
        message: "La date et l'heure sont obligatoires"
      });
    }

    // Vérifier que le bien existe
    const property = await prisma.bien.findUnique({
      where: { id: parseInt(property_id, 10) }
    });

    if (!property) {
      return res.status(404).json({
        message: "Bien immobilier introuvable"
      });
    }

    // Vérifier si le bien est disponible (Étape 42)
    if (property.disponibiliteStatus && property.disponibiliteStatus !== "disponible") {
      return res.status(409).json({
        message: "Ce bien n'est plus disponible pour une visite."
      });
    }

    // Vérifier que l'utilisateur n'est pas le propriétaire
    if (property.proprietaireId === user_id) {
      return res.status(400).json({
        message: "Vous ne pouvez pas réserver une visite de votre propre bien"
      });
    }

    // Vérifier les demandes existantes
    const existingVisit = await prisma.visit.findFirst({
      where: {
        bienId: parseInt(property_id, 10),
        userId: user_id,
        visitDate: visit_date,
        status: 'pending'
      }
    });

    if (existingVisit) {
      return res.status(400).json({
        message: "Vous avez déjà demandé une visite à cette date"
      });
    }

    const visit = await prisma.visit.create({
      data: {
        bienId: parseInt(property_id, 10),
        userId: user_id,
        visitDate: visit_date,
        visitTime: visit_time,
        message: message || null
      }
    });

    res.status(201).json({
      message: "Demande de visite envoyée",
      visit
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur lors de la réservation"
    });
  }
});

// 👤 Mes demandes de visite (Acheteur)
router.get('/my-visits', authenticateToken, async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where: { userId: req.user.id },
      include: {
        bien: {
          select: {
            titre: true,
            prix: true,
            ville: true
          }
        }
      },
      orderBy: { visitDate: 'desc' }
    });

    const formatted = visits.map(v => ({
      id: v.id,
      property_id: v.bienId,
      visit_date: v.visitDate,
      visit_time: v.visitTime,
      message: v.message,
      status: v.status,
      property_title: v.bien.titre,
      price: v.bien.prix,
      city: v.bien.ville
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur lors du chargement"
    });
  }
});

// 🏠 Demandes reçues par le propriétaire
router.get('/received', authenticateToken, async (req, res) => {
  try {
    const visits = await prisma.visit.findMany({
      where: {
        bien: {
          proprietaireId: req.user.id
        }
      },
      include: {
        bien: {
          select: { titre: true }
        },
        user: {
          select: { nom: true, email: true }
        }
      },
      orderBy: { visitDate: 'asc' }
    });

    const formatted = visits.map(v => ({
      id: v.id,
      visit_date: v.visitDate,
      visit_time: v.visitTime,
      message: v.message,
      status: v.status,
      property_title: v.bien.titre,
      visitor_name: v.user.nom,
      visitor_email: v.user.email
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Erreur lors du chargement des demandes"
    });
  }
});

// ✅ Accepter une visite
router.patch('/:id/accept', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { bien: true }
    });

    if (!visit || visit.bien.proprietaireId !== req.user.id) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    const updated = await prisma.visit.update({
      where: { id },
      data: { status: 'accepted' }
    });

    // 🔔 Notifier le visiteur
    await createNotification(
      visit.userId,
      '📅 Visite acceptée',
      `Votre demande de visite pour "${visit.bien.titre}" a été acceptée par le propriétaire.`,
      'visit',
      visit.id
    );

    res.json({
      message: "Visite acceptée",
      visit: updated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur" });
  }
});


// ❌ Refuser une visite
router.patch('/:id/reject', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const visit = await prisma.visit.findUnique({
      where: { id },
      include: { bien: true }
    });

    if (!visit || visit.bien.proprietaireId !== req.user.id) {
      return res.status(404).json({ message: "Demande introuvable" });
    }

    const updated = await prisma.visit.update({
      where: { id },
      data: { status: 'rejected' }
    });

    // 🔔 Notifier le visiteur
    await createNotification(
      visit.userId,
      '❌ Visite refusée',
      `Votre demande de visite pour "${visit.bien.titre}" a été refusée par le propriétaire.`,
      'visit',
      visit.id
    );

    res.json({
      message: "Visite refusée",
      visit: updated
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur" });
  }
});

module.exports = router;
