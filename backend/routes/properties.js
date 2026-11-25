const express = require("express");
const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/security");

const router = express.Router();
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");
const { notifyMatchingSearchAlerts } = require("../utils/searchAlerts");

// Configuration Cloudinary si disponible dans .env
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Stockage en mémoire : aucun fichier n'est écrit sur le disque local (idéal mise en ligne)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 Mo max par image
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/webp",
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(
        new Error(
          "Seuls JPG, PNG et WEBP sont autorisés."
        )
      );
    }
  },
});

// 1. Upload multi-images (jusqu'à 8 photos) sans écriture sur le disque
router.post(
  "/upload",
  authMiddleware,
  (req, res, next) => {
    if (!["proprietaire", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Seuls les propriétaires peuvent envoyer des photos d'annonce." });
    }
    next();
  },
  upload.array("images", 8),
  async (req, res) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          message: "Aucune image reçue.",
        });
      }

      if (req.files.some((file) => !isValidImage(file))) {
        return res.status(400).json({
          message: "Le contenu des fichiers ne correspond pas à une image JPG, PNG ou WEBP valide.",
        });
      }

      const isCloudinaryConfigured =
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET;

      const imageUrls = [];

      for (const file of req.files) {
        if (isCloudinaryConfigured) {
          const url = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
              { folder: "immo229" },
              (error, result) => {
                if (error) reject(error);
                else resolve(result.secure_url);
              }
            );
            stream.end(file.buffer);
          });
          imageUrls.push(url);
        } else {
          // Format Data URI Base64 : direct, autonome, zéro fichier sur disque
          const base64Url = `data:${file.mimetype};base64,${file.buffer.toString("base64")}`;
          imageUrls.push(base64Url);
        }
      }

      res.json({
        message: "Images uploadées avec succès ✅",
        images: imageUrls,
      });
    } catch (error) {
      console.error("Erreur lors de l'upload:", error);
      res.status(500).json({
        message: "Erreur lors de l'upload.",
      });
    }
  }
);

function isValidImage(file) {
  const bytes = file.buffer;
  if (!bytes || bytes.length < 12) return false;

  if (
    file.mimetype === "image/jpeg"
    && bytes[0] === 0xff
    && bytes[1] === 0xd8
    && bytes[2] === 0xff
  ) return true;

  if (
    file.mimetype === "image/png"
    && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) return true;

  return file.mimetype === "image/webp"
    && bytes.toString("ascii", 0, 4) === "RIFF"
    && bytes.toString("ascii", 8, 12) === "WEBP";
}

// 2. Enregistrer une photo associée à un bien
router.post("/images", authMiddleware, async (req, res) => {
  try {
    const { property_id, image_url } = req.body;
    const propertyId = Number(property_id);

    if (
      !Number.isInteger(propertyId)
      || propertyId <= 0
      || typeof image_url !== "string"
      || image_url.length > 7 * 1024 * 1024
      || !(
        /^https:\/\/[^\s]+$/i.test(image_url)
        || /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/]+=*$/i.test(image_url)
      )
    ) {
      return res.status(400).json({
        message: "Identifiant d'annonce ou adresse d'image invalide.",
      });
    }

    if (!["proprietaire", "admin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Seuls les propriétaires peuvent associer des photos à une annonce." });
    }

    const propertyResult = await pool.query(
      `SELECT id
       FROM properties
       WHERE id = $1 AND ($2 = 'admin' OR proprietaire_id = $3)`,
      [propertyId, req.user.role, req.user.id]
    );
    if (propertyResult.rows.length === 0) {
      return res.status(404).json({ message: "Annonce introuvable ou non autorisée." });
    }

    const imageCount = await pool.query(
      "SELECT COUNT(*)::int AS count FROM property_images WHERE property_id = $1",
      [propertyId]
    );
    if (imageCount.rows[0].count >= 8) {
      return res.status(409).json({ message: "Une annonce ne peut pas dépasser 8 photos." });
    }

    const result = await pool.query(
      `INSERT INTO property_images
       (property_id, image_url)
       VALUES ($1, $2)
       RETURNING *`,
      [propertyId, image_url]
    );

    res.status(201).json({
      message: "Image enregistrée.",
      image: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur enregistrement photo:", error);
    res.status(500).json({
      message: "Erreur serveur.",
    });
  }
});

// 3. Récupérer toutes les photos d'un bien
router.get("/:id/images", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT *
       FROM property_images
       WHERE property_id = $1
       ORDER BY created_at ASC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur récupération images:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des images.",
    });
  }
});

// 4. Ajouter un bien (sécurisé)
router.post("/", authMiddleware, async (req, res) => {
  try {
    if (!["proprietaire", "admin"].includes(req.user.role)) {
      return res.status(403).json({
        message: "Seuls les propriétaires peuvent publier une annonce.",
      });
    }

    const {
      titre,
      description,
      prix,
      ville,
      quartier,
      type,
      transaction_type,
      chambres,
      douches,
      image_url,
      proprietaire_id,
      latitude,
      longitude,
    } = req.body;

    const resolvedProprietaireId =
      req.user.role === "admin" && proprietaire_id
        ? proprietaire_id
        : req.user.id;

    if (
      !titre?.trim() ||
      prix === undefined ||
      prix === null ||
      prix === "" ||
      !ville?.trim() ||
      !type?.trim() ||
      !resolvedProprietaireId
    ) {
      return res.status(400).json({
        message: "Veuillez remplir les champs obligatoires (titre, prix, ville, type).",
      });
    }

    if (transaction_type != null && !["vente", "location"].includes(transaction_type)) {
      return res.status(400).json({ message: "Type de transaction invalide." });
    }

    const parsedLat =
      latitude !== undefined && latitude !== null && latitude !== "" && Number.isFinite(Number(latitude))
        ? Number(latitude)
        : null;
    const parsedLng =
      longitude !== undefined && longitude !== null && longitude !== "" && Number.isFinite(Number(longitude))
        ? Number(longitude)
        : null;

    const result = await pool.query(
      `INSERT INTO properties
      (
        titre,
        description,
        prix,
        ville,
        quartier,
        type,
        transaction_type,
        chambres,
        douches,
        image_url,
        proprietaire_id,
        latitude,
        longitude,
        status,
        publication_payment_status
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'en_attente',$14)
      RETURNING *`,
      [
        titre,
        description,
        prix,
        ville,
        quartier,
        type,
        transaction_type || null,
        chambres || 0,
        douches || 0,
        image_url || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
        resolvedProprietaireId,
        parsedLat,
        parsedLng,
        req.user.role === "proprietaire" ? "pending" : "not_required",
      ]
    );

    res.status(201).json({
      message: req.user.role === "proprietaire"
        ? "Annonce créée. Le paiement de 1 000 FCFA est requis pour sa publication automatique."
        : "Bien ajouté avec succès. Il est en attente de validation.",
      property: result.rows[0],
    });

  } catch (error) {
    console.error("Erreur ajout bien:", error);
    res.status(500).json({
      message: "Erreur lors de l'ajout du bien.",
    });
  }
});

// 5. Récupérer les biens d'un propriétaire
router.get("/proprietaire/:id", async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `SELECT * FROM properties
       WHERE proprietaire_id = $1
       ORDER BY created_at DESC`,
      [id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur biens propriétaire:", error);
    res.status(500).json({
      message: "Erreur serveur.",
    });
  }
});

// 5b. Récupérer ses propres annonces (utilisateur connecté)
router.get("/mine", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT *
       FROM properties
       WHERE proprietaire_id = $1
       ORDER BY id DESC`,
      [req.user.id]
    );

    // Formater pour être compatible avec les clés de l'étape 32
    const formatted = result.rows.map((p) => ({
      id: p.id,
      title: p.titre,
      titre: p.titre,
      description: p.description,
      price: Number(p.prix),
      prix: Number(p.prix),
      city: p.ville,
      ville: p.ville,
      quartier: p.quartier,
      type: p.type,
      bedrooms: p.chambres,
      chambres: p.chambres,
      bathrooms: p.douches,
      douches: p.douches,
      transaction_type: p.transaction_type || null,
      image_url: p.image_url,
      owner_id: p.proprietaire_id,
      proprietaire_id: p.proprietaire_id,
      status: p.status || "disponible",
      publication_payment_status: p.publication_payment_status || "not_required",
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("Erreur de chargement des annonces personnelles :", error);
    return res.status(500).json({
      message: "Impossible de charger tes annonces.",
    });
  }
});

// 6. Récupérer tous les biens (avec filtres optionnels)
router.get("/", async (req, res) => {
  try {
    const { location, type, maxPrice } = req.query;
    let query = `SELECT p.*,
       COALESCE(view_stats.view_count, 0)::int AS view_count,
       u.nom AS owner_name,
       u.phone AS owner_phone
       FROM properties p
       LEFT JOIN users u ON u.id = p.proprietaire_id
       LEFT JOIN (
         SELECT property_id, COUNT(*) AS view_count
         FROM property_views
         GROUP BY property_id
       ) AS view_stats ON view_stats.property_id = p.id
       WHERE p.status = 'disponible'`;
    const params = [];

    if (location && location.trim() !== "") {
      params.push(`%${location.trim().toLowerCase()}%`);
      query += ` AND (LOWER(p.ville) LIKE $${params.length} OR LOWER(COALESCE(p.quartier, '')) LIKE $${params.length})`;
    }

    if (type && type !== "Tous" && type.trim() !== "") {
      params.push(type.trim());
      query += ` AND p.type = $${params.length}`;
    }

    if (maxPrice && !isNaN(Number(maxPrice))) {
      params.push(Number(maxPrice));
      query += ` AND p.prix <= $${params.length}`;
    }

    query += " ORDER BY p.created_at DESC";

    const result = await pool.query(query, params);

    const formatted = result.rows.map((p) => ({
      id: p.id,
      title: p.titre,
      titre: p.titre,
      description: p.description,
      price: Number(p.prix),
      prix: Number(p.prix),
      priceFormatted: `${Number(p.prix).toLocaleString("fr-FR")} FCFA`,
      location: p.quartier ? `${p.ville}, ${p.quartier}` : p.ville,
      city: p.ville,
      ville: p.ville,
      type: p.type,
      transaction_type: p.transaction_type || null,
      rooms: p.chambres > 0 ? `${p.chambres} chambres` : "Terrain",
      bathrooms: p.douches > 0 ? `${p.douches} douches` : "—",
      image: p.image_url || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      image_url: p.image_url,
      status: p.status || "disponible",
      is_verified: Boolean(p.is_verified),
      created_at: p.created_at,
      view_count: Number(p.view_count) || 0,
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      owner: p.owner_phone ? {
        name: p.owner_name,
        telephone: p.owner_phone,
      } : null,
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Erreur récupération biens:", error);
    res.status(500).json({
      message: "Erreur lors de la récupération des biens.",
    });
  }
});

// 6b. Statistiques du tableau de bord propriétaire
router.get("/stats/dashboard", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(CASE WHEN status = 'en_attente' THEN 1 END)::int AS en_attente,
         COUNT(CASE WHEN status = 'disponible' THEN 1 END)::int AS disponibles,
         COUNT(CASE WHEN status = 'loue' THEN 1 END)::int AS loues,
         COUNT(CASE WHEN status = 'vendu' THEN 1 END)::int AS vendus,
         COUNT(CASE WHEN status = 'rejete' THEN 1 END)::int AS rejete
       FROM properties
       WHERE proprietaire_id = $1`,
      [userId]
    );

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Erreur statistiques :", error);
    res.status(500).json({
      message: "Impossible de récupérer les statistiques.",
    });
  }
});

// 6c. Statistiques mensuelles des annonces publiées
router.get("/stats/monthly", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    try {
      const result = await pool.query(
        `SELECT
           TO_CHAR(
             DATE_TRUNC('month', created_at),
             'YYYY-MM'
           ) AS month,
           COUNT(*)::int AS total
         FROM properties
         WHERE proprietaire_id = $1
           AND created_at >=
               DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months'
         GROUP BY DATE_TRUNC('month', created_at)
         ORDER BY DATE_TRUNC('month', created_at)`,
        [userId]
      );

      return res.json(result.rows);
    } catch (sqlErr) {
      // Fallback de compatibilité si date_trunc n'est pas disponible dans le moteur mémoire
      const fallback = await pool.query(
        `SELECT created_at FROM properties WHERE proprietaire_id = $1 ORDER BY created_at ASC`,
        [userId]
      );

      const counts = {};
      fallback.rows.forEach((r) => {
        const d = new Date(r.created_at);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const key = `${y}-${m}`;
        counts[key] = (counts[key] || 0) + 1;
      });

      const formatted = Object.keys(counts).sort().map((k) => ({
        month: k,
        total: counts[k],
      }));

      return res.json(formatted);
    }
  } catch (error) {
    console.error("Erreur statistiques mensuelles :", error);
    res.status(500).json({
      message: "Impossible de charger les statistiques mensuelles.",
    });
  }
});

// 6d. Statistiques d'activité (visites, contacts, intérêt par annonce)
router.get("/stats/activity", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const [visitsResult, contactsResult, annoncesResult] =
      await Promise.all([
        pool.query(
          `SELECT
             COUNT(*)::int AS total,
             COUNT(CASE WHEN status IN ('en_attente', 'pending') THEN 1 END)::int AS en_attente,
             COUNT(CASE WHEN status IN ('acceptee', 'accepted') THEN 1 END)::int AS acceptees
           FROM visits
           WHERE owner_id = $1`,
          [userId]
        ),

        pool.query(
          `SELECT COUNT(*)::int AS total
           FROM conversations
           WHERE seller_id = $1`,
          [userId]
        ),

        (async () => {
          try {
            return await pool.query(
              `WITH v_counts AS (
                 SELECT property_id, COUNT(*)::int AS total_visites
                 FROM visits
                 GROUP BY property_id
               ),
               c_counts AS (
                 SELECT property_id, COUNT(*)::int AS total_contacts
                 FROM conversations
                 GROUP BY property_id
               )
               SELECT
                 p.id,
                 p.titre AS title,
                 COALESCE(v.total_visites, 0) AS total_visites,
                 COALESCE(c.total_contacts, 0) AS total_contacts
               FROM properties p
               LEFT JOIN v_counts v ON v.property_id = p.id
               LEFT JOIN c_counts c ON c.property_id = p.id
               WHERE p.proprietaire_id = $1
               ORDER BY total_visites DESC, total_contacts DESC`,
              [userId]
            );
          } catch (cteErr) {
            // Fallback JS
            const [propsRes, visitsRes, convsRes] = await Promise.all([
              pool.query(`SELECT id, titre AS title FROM properties WHERE proprietaire_id = $1`, [userId]),
              pool.query(`SELECT property_id FROM visits WHERE owner_id = $1`, [userId]),
              pool.query(`SELECT property_id FROM conversations WHERE seller_id = $1`, [userId]),
            ]);

            const vMap = {};
            for (const v of visitsRes.rows) {
              vMap[v.property_id] = (vMap[v.property_id] || 0) + 1;
            }
            const cMap = {};
            for (const c of convsRes.rows) {
              cMap[c.property_id] = (cMap[c.property_id] || 0) + 1;
            }

            const rows = propsRes.rows.map((p) => ({
              id: p.id,
              title: p.title,
              total_visites: vMap[p.id] || 0,
              total_contacts: cMap[p.id] || 0,
            })).sort((a, b) => (b.total_visites - a.total_visites) || (b.total_contacts - a.total_contacts));

            return { rows };
          }
        })(),
      ]);

    res.json({
      visites: visitsResult.rows[0] || { total: 0, en_attente: 0, acceptees: 0 },
      contacts: contactsResult.rows[0] || { total: 0 },
      annonces: annoncesResult.rows || [],
    });
  } catch (error) {
    console.error("Erreur statistiques d'activité :", error);
    res.status(500).json({
      message: "Impossible de charger les statistiques d'activité.",
    });
  }
});

// 6e. Enregistrer une consultation d'annonce (visiteurs connectés ou non)
router.post("/:id/view", async (req, res) => {
  try {
    const propertyId = Number(req.params.id);

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({
        message: "Identifiant d'annonce invalide.",
      });
    }

    const property = await pool.query(
      "SELECT id FROM properties WHERE id = $1",
      [propertyId]
    );

    if (property.rowCount === 0) {
      return res.status(404).json({
        message: "Annonce introuvable.",
      });
    }

    // Identifier le visiteur si un token d'authentification valide est présent
    let viewerId = req.user?.id || null;
    if (!viewerId) {
      const authHeader = req.headers.authorization;
      if (authHeader?.startsWith("Bearer ")) {
        try {
          const token = authHeader.split(" ")[1];
          const decoded = jwt.verify(
            token,
            jwtSecret
          );
          viewerId = decoded?.id || null;
        } catch (jwtErr) {
          viewerId = null;
        }
      }
    }

    await pool.query(
      `INSERT INTO property_views (property_id, viewer_id)
       VALUES ($1, $2)`,
      [propertyId, viewerId]
    );

    res.status(201).json({
      message: "Consultation enregistrée.",
    });
  } catch (error) {
    console.error("Erreur enregistrement consultation :", error);
    res.status(500).json({
      message: "Impossible d'enregistrer la consultation.",
    });
  }
});

// 6f. Statistiques des consultations des annonces du propriétaire
router.get("/stats/views", authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         p.id,
         p.titre AS title,
         COUNT(v.id)::int AS total_views
       FROM properties p
       LEFT JOIN property_views v
         ON v.property_id = p.id
       WHERE p.proprietaire_id = $1
       GROUP BY p.id, p.titre
       ORDER BY total_views DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur statistiques des vues :", error);
    res.status(500).json({
      message: "Impossible de charger les consultations.",
    });
  }
});

// 6g. Recherche avancée des biens immobiliers
router.get("/search/advanced", async (req, res) => {
  try {
    const {
      city,
      type,
      minPrice,
      maxPrice,
      bedrooms,
      status = "disponible",
    } = req.query;

    const conditions = [];
    const values = [];

    function addCondition(sql, value) {
      values.push(value);
      conditions.push(sql.replace("?", `$${values.length}`));
    }

    if (city && city.trim() !== "") {
      addCondition("LOWER(p.ville) LIKE LOWER(?)", `%${city.trim()}%`);
    }

    if (type && type.trim() !== "") {
      const cleanType = type.trim().toLowerCase();
      if (cleanType === "parcelle" || cleanType === "terrain") {
        values.push("parcelle");
        values.push("terrain");
        conditions.push(`(LOWER(p.type) = $${values.length - 1} OR LOWER(p.type) = $${values.length})`);
      } else {
        addCondition("LOWER(p.type) = LOWER(?)", cleanType);
      }
    }

    if (minPrice !== undefined && minPrice !== "") {
      const price = Number(minPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: "Budget minimum invalide." });
      }
      addCondition("p.prix >= ?", price);
    }

    if (maxPrice !== undefined && maxPrice !== "") {
      const price = Number(maxPrice);
      if (!Number.isFinite(price) || price < 0) {
        return res.status(400).json({ message: "Budget maximum invalide." });
      }
      addCondition("p.prix <= ?", price);
    }

    if (
      minPrice !== undefined &&
      maxPrice !== undefined &&
      minPrice !== "" &&
      maxPrice !== "" &&
      Number(minPrice) > Number(maxPrice)
    ) {
      return res.status(400).json({
        message: "Le budget minimum ne peut pas dépasser le budget maximum.",
      });
    }

    if (bedrooms !== undefined && bedrooms !== "") {
      const count = Number(bedrooms);
      if (!Number.isInteger(count) || count < 0) {
        return res.status(400).json({
          message: "Nombre de chambres invalide.",
        });
      }
      addCondition("p.chambres >= ?", count);
    }

    const allowedStatuses = ["disponible", "loue", "vendu", "all"];

    if (status && status !== "all") {
      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({ message: "Statut invalide." });
      }
      addCondition("p.status = ?", status);
    }

    const whereClause = conditions.length
      ? `WHERE ${conditions.join(" AND ")}`
      : "";

    const result = await pool.query(
      `SELECT
         p.*,
         p.titre AS title,
         p.ville AS city,
         p.prix AS price,
         p.chambres AS bedrooms,
         u.is_verified AS owner_is_verified
       FROM properties p
       LEFT JOIN users u ON u.id = p.proprietaire_id
       ${whereClause}
       ORDER BY p.created_at DESC
       LIMIT 100`,
      values
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur de recherche avancée :", error);
    res.status(500).json({
      message: "Impossible d'effectuer la recherche.",
    });
  }
});

// 7. Récupérer un bien par son id
router.get("/:id", async (req, res) => {
  try {
    const propertyId = Number(req.params.id);
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.split(" ")[1] : null;
    let currentUser = null;

    if (token) {
      try {
        const jwt = require("jsonwebtoken");
        currentUser = jwt.verify(token, jwtSecret);
      } catch {
        currentUser = null;
      }
    }

    const result = await pool.query(
      `SELECT p.*, u.nom AS owner_nom, u.email AS owner_email,
              u.phone AS owner_phone, u.is_verified AS owner_is_verified
       FROM properties p
       LEFT JOIN users u ON u.id = p.proprietaire_id
       WHERE p.id = $1`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Bien non trouvé" });
    }

    const p = result.rows[0];
    const isOwner = currentUser && Number(currentUser.id) === Number(p.proprietaire_id);
    const isAdmin = currentUser && currentUser.role === "admin";
    const isPubliclyVisible = ["disponible", "loue", "vendu"].includes(p.status);
    const isAvailable = p.status === "disponible";

    if (!isPubliclyVisible && !isOwner && !isAdmin) {
      return res.status(404).json({ message: "Bien non trouvé" });
    }

    const imagesRes = await pool.query(
      "SELECT id, image_url FROM property_images WHERE property_id = $1 ORDER BY id ASC",
      [p.id]
    );

    res.json({
      id: p.id,
      title: p.titre,
      titre: p.titre,
      description: p.description,
      price: Number(p.prix),
      priceFormatted: `${Number(p.prix).toLocaleString("fr-FR")} FCFA`,
      location: p.quartier ? `${p.ville}, ${p.quartier}` : p.ville,
      city: p.ville,
      ville: p.ville,
      quartier: p.quartier,
      type: p.type,
      transaction_type: p.transaction_type || null,
      rooms: p.chambres > 0 ? `${p.chambres} chambres` : "Terrain",
      bathrooms: p.douches > 0 ? `${p.douches} douches` : "—",
      image: p.image_url || "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
      image_url: p.image_url,
      images: imagesRes.rows.map(img => ({ id: img.id, image_url: img.image_url })),
      owner_id: p.proprietaire_id,
      proprietaire_id: p.proprietaire_id,
      status: p.status || "disponible",
      is_verified: Boolean(p.is_verified),
      transaction_type: p.transaction_type || null,
      owner_is_verified: Boolean(p.owner_is_verified),
      latitude: p.latitude != null ? Number(p.latitude) : null,
      longitude: p.longitude != null ? Number(p.longitude) : null,
      owner: p.owner_nom ? {
        id: p.proprietaire_id,
        nom: p.owner_nom,
        ...(isAvailable ? {
          email: p.owner_email,
          telephone: p.owner_phone,
        } : {}),
      } : null,
    });
  } catch (error) {
    console.error("Erreur détail bien:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
});

// 8. Modifier un bien (sécurisé par propriétaire ou admin)
router.put("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const titre = body.title || body.titre;
    const description = body.description;
    const type = body.type;
    const hasTransactionType = Object.prototype.hasOwnProperty.call(body, "transaction_type");
    const transactionType = body.transaction_type || null;
    const ville = body.city || body.ville;
    const quartier = body.address || body.quartier || null;
    const prix = body.price !== undefined ? body.price : body.prix;
    const chambres = body.bedrooms !== undefined ? body.bedrooms : body.chambres;
    const douches = body.bathrooms !== undefined ? body.bathrooms : body.douches;
    const image_url = body.image_url || body.image;

    if (
      !titre?.trim?.() ||
      !description?.trim?.() ||
      !type ||
      !ville ||
      prix === undefined ||
      prix === "" ||
      !Number.isFinite(Number(prix)) ||
      Number(prix) < 0
    ) {
      return res.status(400).json({
        message: "Vérifie les champs obligatoires et le prix.",
      });
    }

    if (hasTransactionType && transactionType !== null && !["vente", "location"].includes(transactionType)) {
      return res.status(400).json({ message: "Type de transaction invalide." });
    }

    const parsedLat =
      body.latitude !== undefined && body.latitude !== null && body.latitude !== "" && Number.isFinite(Number(body.latitude))
        ? Number(body.latitude)
        : null;
    const parsedLng =
      body.longitude !== undefined && body.longitude !== null && body.longitude !== "" && Number.isFinite(Number(body.longitude))
        ? Number(body.longitude)
        : null;

    // Autoriser le propriétaire de l'annonce ou un admin
    const isAdmin = req.user.role === "admin";
    const query = isAdmin
      ? `UPDATE properties
         SET titre = $1,
             description = $2,
             prix = $3,
             ville = $4,
             quartier = $5,
             type = $6,
             chambres = $7,
             douches = $8,
             image_url = COALESCE($9, image_url),
             latitude = $10,
             longitude = $11,
             transaction_type = CASE WHEN $12 THEN $13 ELSE transaction_type END
         WHERE id = $14
         RETURNING *`
      : `UPDATE properties
         SET titre = $1,
             description = $2,
             prix = $3,
             ville = $4,
             quartier = $5,
             type = $6,
             chambres = $7,
             douches = $8,
             image_url = COALESCE($9, image_url),
             latitude = $10,
             longitude = $11,
             transaction_type = CASE WHEN $12 THEN $13 ELSE transaction_type END
         WHERE id = $14 AND proprietaire_id = $15
         RETURNING *`;

    const params = [
      titre.trim(),
      description.trim(),
      Number(prix),
      ville,
      quartier,
      type,
      chambres === "" || chambres == null ? 0 : Number(chambres),
      douches === "" || douches == null ? 0 : Number(douches),
      image_url || null,
      parsedLat,
      parsedLng,
      hasTransactionType,
      transactionType,
      id,
    ];

    if (!isAdmin) {
      params.push(req.user.id);
    }

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Annonce introuvable ou tu n'en es pas le propriétaire.",
      });
    }

    const updated = result.rows[0];
    res.json({
      message: "Annonce modifiée avec succès ✅",
      property: {
        ...updated,
        title: updated.titre,
        price: Number(updated.prix),
        city: updated.ville,
      },
    });
  } catch (error) {
    console.error("Erreur de modification :", error);
    res.status(500).json({
      message: "Erreur lors de la modification de l'annonce.",
    });
  }
});

// 9. Supprimer un bien (sécurisé par propriétaire ou admin)
router.delete("/:id", authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user.role === "admin";

    if (!isAdmin) {
      const pendingPayment = await pool.query(
        `SELECT pp.id
         FROM property_payments pp
         JOIN properties p ON p.id = pp.property_id
         WHERE pp.property_id = $1
           AND p.proprietaire_id = $2
           AND pp.status = 'pending'
         LIMIT 1`,
        [id, req.user.id]
      );

      if (pendingPayment.rows.length > 0) {
        return res.status(409).json({
          message: "Un paiement est en cours pour cette annonce. Vérifie son statut avant de la supprimer.",
        });
      }
    }

    // Supprimer les dépendances (images, favoris) si nécessaire
    await pool.query("DELETE FROM property_images WHERE property_id = $1", [id]).catch(() => {});

    const query = isAdmin
      ? `DELETE FROM properties WHERE id = $1 RETURNING id`
      : `DELETE FROM properties WHERE id = $1 AND proprietaire_id = $2 RETURNING id`;

    const params = isAdmin ? [id] : [id, req.user.id];

    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Annonce introuvable ou tu n'en es pas le propriétaire.",
      });
    }

    res.json({
      message: "Annonce supprimée avec succès ✅",
    });
  } catch (error) {
    console.error("Erreur de suppression :", error);
    res.status(500).json({
      message: "Erreur lors de la suppression de l'annonce.",
    });
  }
});

// 10. Modifier le statut d'un bien (propriétaire uniquement)
router.patch("/:id/status", authMiddleware, async (req, res) => {
  try {
    const propertyId = Number(req.params.id);
    const userId = req.user.id;
    const { status } = req.body;

    const allowedStatuses = ["disponible", "loue", "vendu"];

    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Statut invalide." });
    }

    const property = await pool.query(
      `SELECT status, publication_payment_status
       FROM properties
       WHERE id = $1 AND proprietaire_id = $2`,
      [propertyId, userId]
    );

    if (property.rows.length === 0) {
      return res.status(404).json({ message: "Annonce introuvable ou non autorisée." });
    }

    if (property.rows[0].publication_payment_status === "pending") {
      return res.status(403).json({
        message: "Le paiement de 1 000 FCFA est nécessaire avant de publier cette annonce.",
      });
    }

    if (status === "disponible" && property.rows[0].status === "en_attente") {
      return res.status(403).json({
        message: "Cette annonce doit d'abord être approuvée par l'équipe Immo229.",
      });
    }

    const result = await pool.query(
      `UPDATE properties
       SET status = $1
       WHERE id = $2 AND proprietaire_id = $3
       RETURNING id, status`,
      [status, propertyId, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Annonce introuvable ou accès refusé.",
      });
    }

    if (property.rows[0].status !== "disponible" && status === "disponible") {
      const availableProperty = await pool.query(
        `SELECT p.*, u.email AS owner_email
         FROM properties p
         LEFT JOIN users u ON u.id = p.proprietaire_id
         WHERE p.id = $1`,
        [propertyId]
      );
      try {
        await notifyMatchingSearchAlerts(pool, req.app.get("io"), availableProperty.rows[0]);
      } catch (alertError) {
        console.error("Erreur alertes de recherche après disponibilité :", alertError.message);
      }
    }

    res.json({
      message: "Statut mis à jour.",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur mise à jour statut :", error);
    res.status(500).json({ message: "Erreur du serveur." });
  }
});

module.exports = router;
