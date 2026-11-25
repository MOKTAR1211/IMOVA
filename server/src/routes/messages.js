const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');
const { createNotification } = require('../utils/notifications');

// POST /api/messages — Envoyer un message
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { receiver_id, property_id, content } = req.body;

    if (!receiver_id || !content) {
      return res.status(400).json({ message: 'Le destinataire et le message sont obligatoires.' });
    }

    if (Number(receiver_id) === Number(req.user.id)) {
      return res.status(400).json({ message: 'Vous ne pouvez pas vous envoyer un message.' });
    }

    const message = await prisma.message.create({
      data: {
        senderId: req.user.id,
        receiverId: Number(receiver_id),
        propertyId: property_id ? Number(property_id) : null,
        content: content.trim(),
      },
    });

    // 🔔 Notifier le destinataire
    const sender = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { nom: true },
    });

    await createNotification(
      Number(receiver_id),
      '💬 Nouveau message',
      `Vous avez reçu un nouveau message de ${sender?.nom || 'un utilisateur'}.`,
      'message',
      message.id
    );

    res.status(201).json({
      message: 'Message envoyé avec succès.',
      data: message,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});


// GET /api/messages/received — Récupérer les messages reçus
router.get('/received', authenticateToken, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { receiverId: req.user.id },
      include: {
        sender: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Adapter le format pour correspondre à ce que le frontend attend (snake_case avec relations à plat)
    const formatted = messages.map(m => ({
      ...m,
      sender_name: m.sender.nom,
      sender_email: m.sender.email,
      property_title: m.property ? m.property.titre : null,
      is_read: m.isRead,
      created_at: m.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/messages/sent — Récupérer les messages envoyés
router.get('/sent', authenticateToken, async (req, res) => {
  try {
    const messages = await prisma.message.findMany({
      where: { senderId: req.user.id },
      include: {
        receiver: true,
        property: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const formatted = messages.map(m => ({
      ...m,
      receiver_name: m.receiver.nom,
      receiver_email: m.receiver.email,
      property_title: m.property ? m.property.titre : null,
      is_read: m.isRead,
      created_at: m.createdAt,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// PATCH /api/messages/:id/read — Marquer un message comme lu
router.patch('/:id/read', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) return res.status(400).json({ message: 'ID invalide' });

    // On vérifie d'abord si le message existe et appartient au receveur
    const existing = await prisma.message.findUnique({
      where: { id },
    });

    if (!existing || existing.receiverId !== req.user.id) {
      return res.status(404).json({ message: 'Message introuvable.' });
    }

    const updated = await prisma.message.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({
      message: 'Message marqué comme lu.',
      data: { ...updated, is_read: updated.isRead }, // Compatibilité frontend
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/messages/unread-count — Compter les messages non lus
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const count = await prisma.message.count({
      where: {
        receiverId: req.user.id,
        isRead: false,
      },
    });

    res.json({ count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/messages/:userId — Récupérer la conversation avec un utilisateur
router.get('/:userId', authenticateToken, async (req, res) => {
  try {
    const otherUserId = parseInt(req.params.userId, 10);
    const currentUserId = req.user.id;

    if (isNaN(otherUserId) || otherUserId <= 0 || otherUserId === currentUserId) {
      return res.status(400).json({
        message: 'Identifiant de conversation invalide',
      });
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          { senderId: currentUserId, receiverId: otherUserId },
          { senderId: otherUserId, receiverId: currentUserId },
        ],
      },
      include: {
        sender: { select: { id: true, nom: true, email: true } },
        receiver: { select: { id: true, nom: true, email: true } },
        property: { select: { id: true, titre: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    });

    // Marquer comme lus les messages reçus de cet interlocuteur
    await prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: currentUserId,
        isRead: false,
      },
      data: { isRead: true },
    });

    const formatted = messages.map((m) => ({
      id: m.id,
      sender_id: m.senderId,
      receiver_id: m.receiverId,
      property_id: m.propertyId,
      content: m.content,
      is_read: m.isRead,
      created_at: m.createdAt,
      sender_name: m.sender?.nom,
      receiver_name: m.receiver?.nom,
      property_title: m.property?.titre,
    }));

    res.json(formatted);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Erreur lors du chargement des messages',
    });
  }
});

module.exports = router;
