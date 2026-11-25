const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');

// 🔔 Récupérer toutes mes notifications (les plus récentes en premier)
router.get('/', authenticateToken, async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = notifications.map((n) => ({
      id: n.id,
      title: n.title,
      message: n.message,
      type: n.type,
      related_id: n.relatedId,
      is_read: n.isRead,
      created_at: n.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Erreur lors du chargement des notifications',
    });
  }
});

// 🔴 Nombre de notifications non lues
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await prisma.notification.count({
      where: {
        userId: req.user.id,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur' });
  }
});

// ✅ Marquer une notification comme lue
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });

    // Vérifier que la notification appartient à l'utilisateur
    const existing = await prisma.notification.findUnique({ where: { id } });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: 'Notification introuvable' });
    }

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      id: updated.id,
      title: updated.title,
      message: updated.message,
      type: updated.type,
      related_id: updated.relatedId,
      is_read: updated.isRead,
      created_at: updated.createdAt,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur' });
  }
});

// ✅ Tout marquer comme lu
router.patch('/read-all/all', authenticateToken, async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.id,
        isRead: false,
      },
      data: { isRead: true },
    });

    res.json({ message: 'Toutes les notifications ont été lues' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur' });
  }
});

// 🗑️ Supprimer une notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });

    const existing = await prisma.notification.findUnique({ where: { id } });

    if (!existing || existing.userId !== req.user.id) {
      return res.status(404).json({ message: 'Notification introuvable' });
    }

    await prisma.notification.delete({ where: { id } });

    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur' });
  }
});

module.exports = router;
