const express = require('express');
const router = express.Router();
const prisma = require('../db');
const authenticateToken = require('../middleware/auth');

// POST /api/favorites/:propertyId — Ajouter aux favoris
router.post('/:propertyId', authenticateToken, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }

    try {
      const favorite = await prisma.favorite.create({
        data: {
          userId: req.user.id,
          bienId: propertyId,
        },
      });

      res.status(201).json({
        message: 'Bien ajouté aux favoris ❤️',
        favorite: true,
      });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.json({
          message: 'Ce bien est déjà dans vos favoris.',
          favorite: true,
        });
      }
      throw error;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// DELETE /api/favorites/:propertyId — Retirer des favoris
router.delete('/:propertyId', authenticateToken, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }

    await prisma.favorite.deleteMany({
      where: {
        userId: req.user.id,
        bienId: propertyId,
      },
    });

    res.json({
      message: 'Bien retiré des favoris.',
      favorite: false,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/favorites/check/:propertyId — Vérifier si un bien est favori
router.get('/check/:propertyId', authenticateToken, async (req, res) => {
  try {
    const propertyId = parseInt(req.params.propertyId, 10);
    if (isNaN(propertyId)) {
      return res.status(400).json({ message: 'Identifiant invalide.' });
    }

    const favorite = await prisma.favorite.findUnique({
      where: {
        userId_bienId: {
          userId: req.user.id,
          bienId: propertyId,
        },
      },
    });

    res.json({ favorite: !!favorite });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

// GET /api/favorites — Récupérer tous les favoris de l'utilisateur
router.get('/', authenticateToken, async (req, res) => {
  try {
    const favorites = await prisma.favorite.findMany({
      where: { userId: req.user.id },
      include: {
        bien: {
          include: {
            images: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformer le résultat pour avoir une structure plate compatible avec le frontend attendu
    const flatFavorites = favorites.map((f) => {
      const p = f.bien;
      const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];

      return {
        id: p.id,
        titre: p.titre,
        title: p.titre,
        description: p.description,
        prix: p.prix,
        price: p.prix,
        ville: p.ville,
        city: p.ville,
        quartier: p.quartier,
        location: p.quartier ? `${p.quartier}, ${p.ville}` : p.ville,
        type: p.type,
        chambres: p.chambres,
        douches: p.douches,
        image_url: primaryImage ? primaryImage.url : 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=800&q=80',
        favorite_id: f.id,
        favorite_created_at: f.createdAt,
      };
    });

    res.json(flatFavorites);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Erreur serveur.' });
  }
});

module.exports = router;
