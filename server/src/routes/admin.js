const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// Middleware to check if user is admin
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      message: 'Accès administrateur refusé.',
    });
  }
  next();
};

router.use(authenticateToken, isAdmin);

// GET /api/admin/properties/pending
router.get('/properties/pending', async (req, res) => {
  try {
    const properties = await prisma.bien.findMany({
      where: { status: 'pending' },
      include: {
        images: true,
        proprietaire: {
          select: { nom: true, email: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const formatted = properties.map((p) => {
      const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];
      return {
        ...p,
        proprietaire_nom: p.proprietaire?.nom,
        proprietaire_email: p.proprietaire?.email,
        image_url: primaryImage ? primaryImage.url : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Erreur serveur.',
    });
  }
});

// PATCH /api/admin/properties/:id/approve
router.patch('/properties/:id/approve', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });

    const property = await prisma.bien.update({
      where: { id },
      data: {
        status: 'approved',
        rejectionReason: null,
      },
    });

    // 🔔 Notifier le propriétaire
    if (property.proprietaireId) {
      await createNotification(
        property.proprietaireId,
        '✅ Annonce approuvée',
        `Votre annonce "${property.titre}" a été approuvée et est maintenant visible sur Immo229.`,
        'property',
        property.id
      );
    }

    res.json({
      message: 'Annonce validée avec succès ✅',
      property,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Annonce introuvable.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});


// PATCH /api/admin/properties/:id/reject
router.patch('/properties/:id/reject', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const { reason } = req.body;
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });
    if (!reason) return res.status(400).json({ message: 'La raison du refus est obligatoire.' });

    const property = await prisma.bien.update({
      where: { id },
      data: {
        status: 'rejected',
        rejectionReason: reason,
      },
    });

    // 🔔 Notifier le propriétaire
    if (property.proprietaireId) {
      await createNotification(
        property.proprietaireId,
        '❌ Annonce rejetée',
        `Votre annonce "${property.titre}" a été rejetée. Motif : ${reason}`,
        'property',
        property.id
      );
    }

    res.json({
      message: 'Annonce refusée.',
      property,
    });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Annonce introuvable.' });
    }
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});


// GET /api/admin/stats
router.get('/stats', async (req, res) => {
  try {
    const users = await prisma.user.count();
    const properties = await prisma.bien.count();
    const pending = await prisma.bien.count({ where: { status: 'pending' } });
    const approved = await prisma.bien.count({ where: { status: 'approved' } });
    const rejected = await prisma.bien.count({ where: { status: 'rejected' } });

    res.json({
      users,
      properties,
      pending,
      approved,
      rejected
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du chargement des statistiques" });
  }
});


// 🚨 Récupérer les signalements
router.get('/reports', async (req, res) => {
  try {
    const reports = await prisma.report.findMany({
      where: { status: 'pending' },
      include: {
        bien: { select: { titre: true } },
        user: { select: { nom: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = reports.map(r => ({
      id: r.id,
      reason: r.reason,
      description: r.description,
      status: r.status,
      created_at: r.createdAt,
      property_title: r.bien?.titre,
      reporter_name: r.user?.nom,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur lors du chargement des signalements" });
  }
});

// PATCH /api/admin/reports/:id/resolve
router.patch('/reports/:id/resolve', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });

    await prisma.report.update({
      where: { id },
      data: { status: 'resolved' },
    });

    res.json({ message: "Signalement traité" });
  } catch (error) {
    console.error(error);
    if (error.code === 'P2025') {
      return res.status(404).json({ message: 'Signalement introuvable.' });
    }
    res.status(500).json({ message: "Erreur lors du traitement" });
  }
});

module.exports = router;
