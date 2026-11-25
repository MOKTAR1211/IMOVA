const express = require('express');
const router = express.Router();
const prisma = require('../db');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const authenticateToken = require('../middleware/auth');

// ─── Multer config pour upload multi-images ────────────────────────
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueName + ext);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max par fichier
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format non supporté. Utilisez JPG, PNG ou WEBP.'));
    }
  },
});

// ═══════════════════════════════════════════════════════════════════
// ROUTES STATIQUES D'ABORD (avant les routes dynamiques /:id)
// ═══════════════════════════════════════════════════════════════════

// POST /api/properties/upload — Upload de 1 à 8 images
router.post(
  '/upload',
  upload.array('images', 8),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: 'Aucune image reçue.',
        });
      }

      const images = req.files.map((file) => {
        return `http://localhost:5000/uploads/${file.filename}`;
      });

      res.json({
        message: 'Images uploadées avec succès ✅',
        images,
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        message: "Erreur lors de l'upload.",
      });
    }
  }
);

// POST /api/properties/images — Enregistrer une image associée à un bien
router.post('/images', async (req, res) => {
  try {
    const { property_id, image_url } = req.body;

    if (!property_id || !image_url) {
      return res.status(400).json({
        message: 'Informations manquantes.',
      });
    }

    const image = await prisma.image.create({
      data: {
        url: image_url,
        isPrincipale: false,
        bienId: parseInt(property_id, 10),
      },
    });

    res.status(201).json({
      message: 'Image enregistrée.',
      image,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: 'Erreur serveur.',
    });
  }
});

// GET /api/properties/mes-annonces — Biens de l'utilisateur connecté (JWT) 🔐
router.get('/mes-annonces', authenticateToken, async (req, res) => {
  try {
    const properties = await prisma.bien.findMany({
      where: { proprietaireId: req.user.id },
      include: {
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Ajouter l'image principale pour le dashboard
    const formatted = properties.map((p) => {
      const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];
      return {
        ...p,
        image_url: primaryImage ? primaryImage.url : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Erreur lors de la récupération des annonces :', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// GET /api/properties/search — Recherche avancée (public)
router.get('/search', async (req, res) => {
  try {
    const { ville, quartier, type, prixMin, prixMax, chambres } = req.query;

    const where = { status: 'approved' };

    if (ville) {
      where.ville = { contains: ville };
    }

    if (quartier) {
      where.quartier = { contains: quartier };
    }

    if (type && type !== 'Tous') {
      where.type = type;
    }

    if (prixMin || prixMax) {
      where.prix = {};
      if (prixMin) where.prix.gte = Number(prixMin);
      if (prixMax) where.prix.lte = Number(prixMax);
    }

    if (chambres) {
      where.chambres = { gte: Number(chambres) };
    }

    const properties = await prisma.bien.findMany({
      where,
      include: {
        images: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformer pour compatibilité frontend
    const formatted = properties.map((p) => {
      const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];
      return {
        id: p.id,
        titre: p.titre,
        description: p.description,
        prix: p.prix,
        ville: p.ville,
        quartier: p.quartier,
        type: p.type,
        chambres: p.chambres,
        douches: p.douches,
        image_url: primaryImage ? primaryImage.url : null,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Erreur lors de la recherche des biens :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la recherche des biens.' });
  }
});

// GET /api/properties — Liste des biens avec filtres dynamiques (public)
router.get('/', async (req, res) => {
  try {
    const { location, type, maxPrice } = req.query;

    const where = { status: 'approved' };

    if (location && location.trim() !== '') {
      where.OR = [
        { ville: { contains: location.trim() } },
        { quartier: { contains: location.trim() } },
      ];
    }

    if (type && type !== 'Tous' && type.trim() !== '') {
      where.type = type.trim();
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      where.prix = { lte: Number(maxPrice) };
    }

    const properties = await prisma.bien.findMany({
      where,
      include: {
        images: true,
        proprietaire: {
          select: {
            id: true,
            nom: true,
            email: true,
            telephone: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Transformer pour compatibilité frontend
    const formatted = properties.map((p) => {
      const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];
      return {
        id: p.id,
        title: p.titre,
        description: p.description,
        price: p.prix,
        priceFormatted: `${p.prix.toLocaleString('fr-FR')} FCFA${p.statut === 'À louer' ? ' / mois' : ''}`,
        location: p.quartier ? `${p.ville}, ${p.quartier}` : p.ville,
        city: p.ville,
        type: p.type,
        status: p.statut,
        rooms: p.chambres > 0 ? `${p.chambres} chambres` : (p.surface ? `${p.surface} m²` : 'Terrain nu'),
        bathrooms: p.douches > 0 ? `${p.douches} douches` : (p.type === 'Terrain' ? 'Documents disponibles' : '—'),
        image: primaryImage ? primaryImage.url : 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80',
        image_url: primaryImage ? primaryImage.url : 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=900&q=80',
        images: p.images.map((img) => img.url),
        owner: p.proprietaire,
      };
    });

    res.json(formatted);
  } catch (error) {
    console.error('Erreur lors de la récupération des biens :', error);
    res.status(500).json({ error: 'Erreur serveur lors de la récupération des biens.' });
  }
});

// ═══════════════════════════════════════════════════════════════════
// ROUTES DYNAMIQUES (avec :id)
// ═══════════════════════════════════════════════════════════════════

// GET /api/properties/:id/images — Photos d'un bien (public)
router.get('/:id/images', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    const images = await prisma.image.findMany({
      where: { bienId: id },
      orderBy: { id: 'asc' },
    });

    res.json(images);
  } catch (error) {
    console.error('Erreur lors de la récupération des images :', error);
    res.status(500).json({
      message: 'Erreur lors de la récupération des images.',
    });
  }
});

// GET /api/properties/:id — Détails d'un bien (public)
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    const p = await prisma.bien.findUnique({
      where: { id },
      include: {
        images: true,
        proprietaire: {
          select: {
            id: true,
            nom: true,
            email: true,
            telephone: true,
            role: true,
          },
        },
      },
    });

    if (!p) {
      return res.status(404).json({ error: 'Bien immobilier introuvable.' });
    }

    const primaryImage = p.images.find((img) => img.isPrincipale) || p.images[0];

    const formatted = {
      id: p.id,
      title: p.titre,
      description: p.description,
      price: p.prix,
      priceFormatted: `${p.prix.toLocaleString('fr-FR')} FCFA${p.statut === 'À louer' ? ' / mois' : ''}`,
      location: p.quartier ? `${p.ville}, ${p.quartier}` : p.ville,
      city: p.ville,
      type: p.type,
      status: p.statut,
      rooms: p.chambres > 0 ? `${p.chambres} chambres` : (p.surface ? `${p.surface} m²` : 'Terrain nu'),
      bathrooms: p.douches > 0 ? `${p.douches} douches` : (p.type === 'Terrain' ? 'Documents disponibles' : '—'),
      latitude: p.latitude,
      longitude: p.longitude,
      image: primaryImage ? primaryImage.url : 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80',
      images: p.images.map((img) => ({ id: img.id, image_url: img.url, isPrincipale: img.isPrincipale })),
      owner: p.proprietaire,
    };

    res.json(formatted);
  } catch (error) {
    console.error('Erreur lors de la récupération du bien :', error);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

// POST /api/properties — Création d'un bien 🔐 (JWT requis)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { titre, description, prix, ville, quartier, type, statut, chambres, douches, surface, image_url, images } = req.body;

    // Le propriétaire vient du JWT, pas du client
    const proprietaire_id = req.user.id;

    if (!titre || !prix || !ville || !type) {
      return res.status(400).json({ error: 'Champs obligatoires manquants : titre, prix, ville, type.' });
    }

    // Construire la liste des images à créer
    let imagesToCreate = [];
    if (images && images.length > 0) {
      imagesToCreate = images.map((url, idx) => ({ url, isPrincipale: idx === 0 }));
    } else if (image_url) {
      imagesToCreate = [{ url: image_url, isPrincipale: true }];
    }

    const created = await prisma.bien.create({
      data: {
        titre,
        description: description || '',
        prix: parseFloat(prix),
        ville,
        quartier: quartier || null,
        type,
        statut: statut || 'À louer',
        chambres: chambres ? parseInt(chambres, 10) : 0,
        douches: douches ? parseInt(douches, 10) : 0,
        surface: surface ? parseFloat(surface) : null,
        latitude: req.body.latitude ? parseFloat(req.body.latitude) : null,
        longitude: req.body.longitude ? parseFloat(req.body.longitude) : null,
        proprietaireId: proprietaire_id,
        images: imagesToCreate.length > 0 ? {
          create: imagesToCreate,
        } : undefined,
      },
      include: {
        images: true,
      },
    });

    res.status(201).json({ property: created });
  } catch (error) {
    console.error('Erreur lors de la création du bien :', error);
    res.status(500).json({ error: 'Erreur lors de la création du bien.' });
  }
});

// PUT /api/properties/:id — Modifier un bien 🔐 (JWT + vérification propriétaire)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    // Vérifier que le bien appartient à l'utilisateur connecté
    const existing = await prisma.bien.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Annonce introuvable.' });
    }

    if (existing.proprietaireId !== req.user.id) {
      return res.status(403).json({ message: 'Accès interdit. Vous ne pouvez modifier que vos propres annonces.' });
    }

    const { titre, description, prix, ville, quartier, type, statut, chambres, douches, surface } = req.body;

    const updated = await prisma.bien.update({
      where: { id },
      data: {
        ...(titre && { titre }),
        ...(description !== undefined && { description }),
        ...(prix && { prix: parseFloat(prix) }),
        ...(ville && { ville }),
        ...(quartier !== undefined && { quartier: quartier || null }),
        ...(type && { type }),
        ...(statut && { statut }),
        ...(chambres !== undefined && { chambres: parseInt(chambres, 10) }),
        ...(douches !== undefined && { douches: parseInt(douches, 10) }),
        ...(surface !== undefined && { surface: surface ? parseFloat(surface) : null }),
      },
      include: {
        images: true,
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Erreur lors de la modification du bien :', error);
    res.status(500).json({ error: 'Erreur lors de la modification du bien.' });
  }
});

// DELETE /api/properties/:id — Supprimer un bien 🔐 (JWT + vérification propriétaire)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Identifiant invalide.' });
    }

    // Vérifier que le bien appartient à l'utilisateur connecté
    const existing = await prisma.bien.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        message: 'Annonce introuvable.',
      });
    }

    if (existing.proprietaireId !== req.user.id) {
      return res.status(403).json({
        message: 'Accès interdit. Vous ne pouvez supprimer que vos propres annonces.',
      });
    }

    await prisma.bien.delete({
      where: { id },
    });

    res.json({ message: 'Annonce supprimée avec succès ✅' });
  } catch (error) {
    console.error('Erreur lors de la suppression du bien :', error);
    res.status(500).json({ error: 'Erreur lors de la suppression du bien.' });
  }
});

module.exports = router;
