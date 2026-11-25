const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../db");

// POST /api/auth/register — Inscription
router.post("/register", async (req, res) => {
  try {
    const { nom, email, password, role } = req.body;

    if (!nom || !email || !password) {
      return res.status(400).json({
        message: "Nom, email et mot de passe sont obligatoires.",
      });
    }

    // Vérifier si l'email existe déjà
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return res.status(400).json({
        message: "Un compte existe déjà avec cet email.",
      });
    }

    // Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Créer l'utilisateur
    const user = await prisma.user.create({
      data: {
        nom,
        email,
        motDePasse: hashedPassword,
        role: role === "proprietaire" ? "proprietaire" : "particulier",
      },
    });

    res.status(201).json({
      message: "Compte créé avec succès ✅",
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erreur inscription :", error);
    res.status(500).json({
      message: "Erreur serveur lors de l'inscription.",
    });
  }
});

// POST /api/auth/login — Connexion
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "Email et mot de passe requis.",
      });
    }

    // Trouver l'utilisateur
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect.",
      });
    }

    // Vérifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.motDePasse);

    if (!validPassword) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect.",
      });
    }

    // Créer le JWT
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Connexion réussie.",
      token,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erreur connexion :", error);
    res.status(500).json({
      message: "Erreur serveur lors de la connexion.",
    });
  }
});

// GET /api/auth/me — Profil et statistiques de l'utilisateur connecté
const authenticateToken = require("../middleware/auth");

router.get("/me", authenticateToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        nom: true,
        email: true,
        telephone: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    // Statistiques personnelles réelles
    const [propertiesCount, favoritesCount, visitsCount, messagesCount] = await Promise.all([
      prisma.bien.count({ where: { proprietaireId: req.user.id } }),
      prisma.favorite.count({ where: { userId: req.user.id } }),
      prisma.visit.count({
        where: {
          OR: [
            { userId: req.user.id },
            { bien: { proprietaireId: req.user.id } },
          ],
        },
      }),
      prisma.message.count({
        where: {
          OR: [
            { senderId: req.user.id },
            { receiverId: req.user.id },
          ],
        },
      }),
    ]);

    res.json({
      user: {
        id: user.id,
        name: user.nom,
        nom: user.nom,
        email: user.email,
        phone: user.telephone,
        telephone: user.telephone,
        role: user.role,
        createdAt: user.createdAt,
      },
      stats: {
        properties: propertiesCount,
        favorites: favoritesCount,
        visits: visitsCount,
        messages: messagesCount,
      },
    });
  } catch (error) {
    console.error("Erreur auth/me :", error);
    res.status(500).json({ message: "Erreur lors du chargement du profil." });
  }
});

module.exports = router;
