const express = require("express");
const router = express.Router();
const { pool } = require("../db");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");
const { createAndEmitNotification } = require("./notifications");
const { notifyMatchingSearchAlerts } = require("../utils/searchAlerts");

// Toutes les routes de ce fichier sont strictement réservées aux administrateurs
router.use(authMiddleware);
router.use(adminMiddleware);

router.get("/payments", async (req, res) => {
  const page = Number.parseInt(req.query.page, 10) || 1;
  const limit = Math.min(Number.parseInt(req.query.limit, 10) || 25, 100);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const { status, type, method } = req.query;
  const validStatuses = ["pending", "paid", "failed", "refunded"];
  const validTypes = ["publication", "messaging"];
  const validMethods = ["mtn_mobile_money", "unknown"];

  if (page < 1 || limit < 1 || search.length > 100) {
    return res.status(400).json({ message: "Filtres de paiement invalides." });
  }
  if (status && status !== "all" && !validStatuses.includes(status)) {
    return res.status(400).json({ message: "Statut de paiement invalide." });
  }
  if (type && type !== "all" && !validTypes.includes(type)) {
    return res.status(400).json({ message: "Type de paiement invalide." });
  }
  if (method && method !== "all" && !validMethods.includes(method)) {
    return res.status(400).json({ message: "Moyen de paiement invalide." });
  }

  try {
    const filters = [];
    const params = [];
    if (status && status !== "all") {
      params.push(status);
      filters.push(`status = $${params.length}`);
    }
    if (type && type !== "all") {
      params.push(type);
      filters.push(`payment_type = $${params.length}`);
    }
    if (method && method !== "all") {
      params.push(method);
      filters.push(`COALESCE(payment_method, 'unknown') = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      filters.push(`(
        LOWER(COALESCE(payer_name, '')) LIKE $${params.length}
        OR LOWER(COALESCE(payer_email, '')) LIKE $${params.length}
        OR LOWER(COALESCE(property_title, '')) LIKE $${params.length}
        OR LOWER(provider_transaction_id) LIKE $${params.length}
      )`);
    }

    const paymentRows = `
      SELECT pp.id, 'publication'::text AS payment_type, pp.payment_method,
             pp.provider_transaction_id, pp.amount, pp.currency, pp.status,
             pp.created_at, pp.updated_at, u.id AS payer_id, u.nom AS payer_name,
             u.email AS payer_email, p.id AS property_id, p.titre AS property_title
      FROM property_payments pp
      JOIN users u ON u.id = pp.owner_id
      JOIN properties p ON p.id = pp.property_id
      UNION ALL
      SELECT mp.id, 'messaging'::text AS payment_type, mp.payment_method,
             mp.provider_transaction_id, mp.amount, mp.currency, mp.status,
             mp.created_at, mp.updated_at, u.id AS payer_id, u.nom AS payer_name,
             u.email AS payer_email, p.id AS property_id, p.titre AS property_title
      FROM messaging_payments mp
      JOIN users u ON u.id = mp.client_id
      JOIN properties p ON p.id = mp.property_id
    `;
    const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";
    const countResult = await pool.query(
      `WITH payment_rows AS (${paymentRows})
       SELECT COUNT(*)::int AS total FROM payment_rows ${where}`,
      params
    );
    const rowsParams = [...params, limit, (page - 1) * limit];
    const rowsResult = await pool.query(
      `WITH payment_rows AS (${paymentRows})
       SELECT * FROM payment_rows ${where}
       ORDER BY created_at DESC, id DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      rowsParams
    );

    return res.json({
      payments: rowsResult.rows,
      page,
      limit,
      total: countResult.rows[0]?.total || 0,
    });
  } catch (error) {
    console.error("Erreur liste paiements admin :", error);
    return res.status(500).json({ message: "Impossible de récupérer les paiements." });
  }
});

router.get("/payments/:type/:id", async (req, res) => {
  const paymentId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(paymentId) || paymentId < 1) {
    return res.status(400).json({ message: "Identifiant de paiement invalide." });
  }

  const queries = {
    publication: `
      SELECT pp.id, 'publication' AS payment_type, pp.payment_method,
             pp.provider_transaction_id, pp.amount, pp.currency, pp.status,
             pp.created_at, pp.updated_at, u.id AS payer_id, u.nom AS payer_name,
             u.email AS payer_email, u.phone AS payer_phone, p.id AS property_id,
             p.titre AS property_title, p.ville AS property_city
      FROM property_payments pp
      JOIN users u ON u.id = pp.owner_id
      JOIN properties p ON p.id = pp.property_id
      WHERE pp.id = $1
    `,
    messaging: `
      SELECT mp.id, 'messaging' AS payment_type, mp.payment_method,
             mp.provider_transaction_id, mp.amount, mp.currency, mp.status,
             mp.created_at, mp.updated_at, u.id AS payer_id, u.nom AS payer_name,
             u.email AS payer_email, u.phone AS payer_phone, p.id AS property_id,
             p.titre AS property_title, p.ville AS property_city
      FROM messaging_payments mp
      JOIN users u ON u.id = mp.client_id
      JOIN properties p ON p.id = mp.property_id
      WHERE mp.id = $1
    `,
  };
  const query = queries[req.params.type];
  if (!query) {
    return res.status(400).json({ message: "Type de paiement invalide." });
  }

  try {
    const result = await pool.query(query, [paymentId]);
    if (!result.rows.length) {
      return res.status(404).json({ message: "Paiement introuvable." });
    }
    return res.json(result.rows[0]);
  } catch (error) {
    console.error("Erreur détail paiement admin :", error);
    return res.status(500).json({ message: "Impossible de récupérer le détail du paiement." });
  }
});

router.get("/message-reports", async (req, res) => {
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
  const status = typeof req.query.status === "string" ? req.query.status : "pending";
  if (search.length > 100 || !["pending", "reviewed", "all"].includes(status)) {
    return res.status(400).json({ message: "Filtres de signalement invalides." });
  }

  try {
    const params = [];
    const filters = [];
    if (status !== "all") {
      params.push(status);
      filters.push(`mr.status = $${params.length}`);
    }
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      filters.push(`(
        LOWER(COALESCE(reporter.nom, '')) LIKE $${params.length}
        OR LOWER(COALESCE(buyer.nom, '')) LIKE $${params.length}
        OR LOWER(COALESCE(seller.nom, '')) LIKE $${params.length}
        OR LOWER(COALESCE(p.titre, '')) LIKE $${params.length}
        OR LOWER(mr.reason) LIKE $${params.length}
        OR LOWER(COALESCE(mr.description, '')) LIKE $${params.length}
      )`);
    }
    const result = await pool.query(
      `SELECT mr.id, mr.conversation_id, mr.message_id, mr.reporter_id,
              reporter.nom AS reporter_name, buyer.nom AS buyer_name,
              seller.nom AS seller_name, p.titre AS property_title,
              mr.reason, mr.description, mr.status, mr.created_at,
              mr.reviewed_by, mr.reviewed_at, mr.resolution_note,
              m.content AS reported_message
       FROM conversation_message_reports mr
       JOIN conversations c ON c.id = mr.conversation_id
       JOIN messages m ON m.id = mr.message_id AND m.conversation_id = c.id
       JOIN users reporter ON reporter.id = mr.reporter_id
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users seller ON seller.id = c.seller_id
       LEFT JOIN properties p ON p.id = c.property_id
       ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""}
       ORDER BY CASE WHEN mr.status = 'pending' THEN 0 ELSE 1 END,
                mr.created_at DESC
       LIMIT 100`,
      params
    );
    return res.json(result.rows);
  } catch (error) {
    console.error("Erreur signalements de messagerie admin :", error);
    return res.status(500).json({ message: "Impossible de récupérer les signalements de messagerie." });
  }
});

router.get("/message-reports/:id", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(reportId) || reportId < 1) {
    return res.status(400).json({ message: "Identifiant de signalement invalide." });
  }

  try {
    const reportResult = await pool.query(
      `SELECT mr.id, mr.conversation_id, mr.message_id, mr.reporter_id,
              reporter.nom AS reporter_name, buyer.nom AS buyer_name,
              buyer.email AS buyer_email, seller.nom AS seller_name,
              seller.email AS seller_email, p.titre AS property_title,
              mr.reason, mr.description, mr.status, mr.created_at,
              mr.reviewed_by, mr.reviewed_at, mr.resolution_note
       FROM conversation_message_reports mr
       JOIN conversations c ON c.id = mr.conversation_id
       JOIN users reporter ON reporter.id = mr.reporter_id
       JOIN users buyer ON buyer.id = c.buyer_id
       JOIN users seller ON seller.id = c.seller_id
       LEFT JOIN properties p ON p.id = c.property_id
       WHERE mr.id = $1`,
      [reportId]
    );
    if (!reportResult.rows.length) {
      return res.status(404).json({ message: "Signalement introuvable." });
    }

    const report = reportResult.rows[0];
    const messagesResult = await pool.query(
      `SELECT m.id, m.sender_id, u.nom AS sender_name, m.content,
              m.created_at, m.attachment_name, m.attachment_mime
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT 100`,
      [report.conversation_id]
    );
    return res.json({
      report,
      messages: messagesResult.rows.reverse(),
    });
  } catch (error) {
    console.error("Erreur détail signalement de messagerie admin :", error);
    return res.status(500).json({ message: "Impossible de récupérer le contexte du signalement." });
  }
});

router.patch("/message-reports/:id/resolve", async (req, res) => {
  const reportId = Number.parseInt(req.params.id, 10);
  const resolutionNote = typeof req.body.resolutionNote === "string"
    ? req.body.resolutionNote.trim()
    : "";
  if (!Number.isInteger(reportId) || reportId < 1 || resolutionNote.length > 1000) {
    return res.status(400).json({ message: "Décision ou identifiant de signalement invalide." });
  }

  try {
    const result = await pool.query(
      `UPDATE conversation_message_reports
       SET status = 'reviewed', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP,
           resolution_note = $2
       WHERE id = $3 AND status = 'pending'
       RETURNING id, status, reviewed_by, reviewed_at, resolution_note`,
      [req.user.id, resolutionNote || null, reportId]
    );
    if (!result.rows.length) {
      const exists = await pool.query(
        "SELECT id FROM conversation_message_reports WHERE id = $1",
        [reportId]
      );
      return exists.rows.length
        ? res.status(409).json({ message: "Ce signalement a déjà été examiné." })
        : res.status(404).json({ message: "Signalement introuvable." });
    }
    return res.json({ message: "Signalement examiné.", report: result.rows[0] });
  } catch (error) {
    console.error("Erreur résolution signalement de messagerie admin :", error);
    return res.status(500).json({ message: "Impossible d'enregistrer la décision de modération." });
  }
});

// 1. Statistiques globales de la plateforme (Admin)
router.get("/stats", async (req, res) => {
  try {
    const [usersRes, propRes, pendingRes, approvedRes, rejectedRes] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM users"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'en_attente' AND publication_payment_status <> 'pending'"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'disponible'"),
      pool.query("SELECT COUNT(*)::int AS count FROM properties WHERE status = 'rejete'"),
    ]);

    res.json({
      users: usersRes.rows[0]?.count || 0,
      properties: propRes.rows[0]?.count || 0,
      pending: pendingRes.rows[0]?.count || 0,
      approved: approvedRes.rows[0]?.count || 0,
      rejected: rejectedRes.rows[0]?.count || 0,
    });
  } catch (error) {
    console.error("Erreur stats admin :", error);
    res.status(500).json({ message: "Erreur lors du calcul des statistiques." });
  }
});

// 1b. Récupérer tous les biens pour l'administration (avec filtres optionnels)
router.get("/properties", async (req, res) => {
  try {
    const { status, search } = req.query;
    let query = `
      SELECT p.*, u.nom AS proprietaire_nom, u.email AS proprietaire_email, u.phone AS proprietaire_phone
      FROM properties p
      LEFT JOIN users u ON p.proprietaire_id = u.id
      WHERE 1=1
    `;
    const params = [];

    if (status && status !== "all") {
      params.push(status);
      query += ` AND p.status = $${params.length}`;
    }

    if (search && search.trim() !== "") {
      params.push(`%${search.trim().toLowerCase()}%`);
      query += ` AND (LOWER(p.titre) LIKE $${params.length} OR LOWER(p.ville) LIKE $${params.length} OR LOWER(COALESCE(u.nom, '')) LIKE $${params.length})`;
    }

    query += " ORDER BY p.created_at DESC";

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error("Erreur liste biens admin :", error);
    res.status(500).json({ message: "Impossible de récupérer les biens pour l'administration." });
  }
});

// 1c. Statistiques mensuelles globales (inscriptions utilisateurs et publications de biens réelles)
router.get("/analytics/monthly", async (req, res) => {
  try {
    const [usersRes, propsRes] = await Promise.all([
      pool.query("SELECT created_at FROM users WHERE created_at IS NOT NULL ORDER BY created_at ASC"),
      pool.query("SELECT created_at FROM properties WHERE created_at IS NOT NULL ORDER BY created_at ASC"),
    ]);

    const monthsMap = {};
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
      monthsMap[key] = { monthKey: key, mois: label, utilisateurs: 0, biens: 0 };
    }

    usersRes.rows.forEach((u) => {
      if (u.created_at) {
        const d = new Date(u.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthsMap[key]) {
          monthsMap[key].utilisateurs++;
        } else {
          const label = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
          monthsMap[key] = { monthKey: key, mois: label, utilisateurs: 1, biens: 0 };
        }
      }
    });

    propsRes.rows.forEach((p) => {
      if (p.created_at) {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (monthsMap[key]) {
          monthsMap[key].biens++;
        } else {
          const label = d.toLocaleDateString("fr-FR", { month: "short", year: "numeric" });
          monthsMap[key] = { monthKey: key, mois: label, utilisateurs: 0, biens: 1 };
        }
      }
    });

    const sortedData = Object.values(monthsMap).sort((a, b) => a.monthKey.localeCompare(b.monthKey));
    res.json(sortedData);
  } catch (error) {
    console.error("Erreur analytics admin :", error);
    res.status(500).json({ message: "Erreur lors du calcul des analyses." });
  }
});

// 1d. Flux d'activité réelle de la plateforme
router.get("/activity", async (req, res) => {
  try {
    const [recentUsers, recentProps, recentReports, recentVisits] = await Promise.all([
      pool.query("SELECT id, nom, email, role, created_at FROM users ORDER BY created_at DESC LIMIT 5"),
      pool.query("SELECT id, titre, prix, status, created_at FROM properties ORDER BY created_at DESC LIMIT 5"),
      pool.query(
        `SELECT r.id, r.reason, r.status, r.created_at, p.titre AS property_title
         FROM reports r
         LEFT JOIN properties p ON r.property_id = p.id
         ORDER BY r.created_at DESC LIMIT 5`
      ),
      pool.query(
        `SELECT v.id, v.visit_date, v.visit_time, v.status, v.created_at, p.titre AS property_title, u.nom AS client_name
         FROM visits v
         LEFT JOIN properties p ON v.property_id = p.id
         LEFT JOIN users u ON v.user_id = u.id
         ORDER BY v.created_at DESC LIMIT 5`
      ),
    ]);

    const activities = [];

    recentUsers.rows.forEach((u) => {
      activities.push({
        id: `user-${u.id}`,
        type: "user_registered",
        title: "Nouvel utilisateur inscrit",
        description: `${u.nom || "Utilisateur"} (${u.email}) — Rôle: ${u.role}`,
        timestamp: u.created_at,
        icon: "user",
        color: "blue",
      });
    });

    recentProps.rows.forEach((p) => {
      const isPending = p.status === "en_attente";
      const isRejected = p.status === "rejete";
      activities.push({
        id: `prop-${p.id}`,
        type: isPending ? "property_pending" : isRejected ? "property_rejected" : "property_added",
        title: isPending ? "Bien soumis pour modération" : isRejected ? "Bien rejeté" : "Bien publié / disponible",
        description: `« ${p.titre} » — ${Number(p.prix).toLocaleString("fr-FR")} FCFA (Statut: ${p.status})`,
        timestamp: p.created_at,
        icon: "building",
        color: isPending ? "amber" : isRejected ? "red" : "emerald",
      });
    });

    recentReports.rows.forEach((r) => {
      activities.push({
        id: `report-${r.id}`,
        type: "report_filed",
        title: "Signalement d'annonce",
        description: `Sur « ${r.property_title || "Bien"} » : ${r.reason} (${r.status})`,
        timestamp: r.created_at,
        icon: "alert-triangle",
        color: "orange",
      });
    });

    recentVisits.rows.forEach((v) => {
      activities.push({
        id: `visit-${v.id}`,
        type: "visit_booked",
        title: "Visite programmée",
        description: `${v.client_name || "Client"} sur « ${v.property_title || "Bien"} » le ${v.visit_date} à ${v.visit_time}`,
        timestamp: v.created_at,
        icon: "calendar",
        color: "purple",
      });
    });

    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    res.json(activities.slice(0, 10));
  } catch (error) {
    console.error("Erreur flux activité admin :", error);
    res.status(500).json({ message: "Erreur lors de la récupération de l'activité." });
  }
});

// 2. Récupérer les biens en attente de validation
router.get("/properties/pending", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, u.nom AS proprietaire_nom, u.email AS proprietaire_email
       FROM properties p
       LEFT JOIN users u ON p.proprietaire_id = u.id
       WHERE p.status = 'en_attente'
         AND p.publication_payment_status <> 'pending'
       ORDER BY p.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur biens en attente admin :", error);
    res.status(500).json({ message: "Impossible de récupérer les biens en attente." });
  }
});

// 3. Approuver un bien
router.patch("/properties/:id/approve", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id, 10);
    if (isNaN(propertyId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const result = await pool.query(
      `UPDATE properties
       SET status = 'disponible'
       WHERE id = $1
         AND status = 'en_attente'
         AND publication_payment_status <> 'pending'
       RETURNING *`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      const property = await pool.query(
        "SELECT id, publication_payment_status FROM properties WHERE id = $1",
        [propertyId]
      );
      if (property.rows[0]?.publication_payment_status === "pending") {
        return res.status(409).json({
          message: "Cette annonce doit d'abord être payée par son propriétaire.",
        });
      }
      return res.status(404).json({ message: "Bien introuvable." });
    }

    // Notifier le propriétaire
    try {
      await createAndEmitNotification(req.app.get("io"), {
        userId: result.rows[0].proprietaire_id,
        title: "Annonce approuvée ✅",
        message: `Votre annonce "${result.rows[0].titre}" a été validée et est désormais visible.`,
        link: `/bien/${propertyId}`,
      });
    } catch (notifErr) {
      console.warn("Notification admin non envoyée:", notifErr.message);
    }

    try {
      await notifyMatchingSearchAlerts(pool, req.app.get("io"), result.rows[0]);
    } catch (alertError) {
      console.error("Erreur alertes de recherche après approbation :", alertError.message);
    }

    res.json({
      message: "Bien approuvé avec succès ✅",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur approbation bien admin :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// 4. Rejeter un bien
router.patch("/properties/:id/reject", async (req, res) => {
  try {
    const propertyId = parseInt(req.params.id, 10);
    const { reason } = req.body;

    if (isNaN(propertyId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const result = await pool.query(
      `UPDATE properties
       SET status = 'rejete'
       WHERE id = $1
         AND publication_payment_status <> 'pending'
       RETURNING *`,
      [propertyId]
    );

    if (result.rows.length === 0) {
      const property = await pool.query(
        "SELECT id, publication_payment_status FROM properties WHERE id = $1",
        [propertyId]
      );
      if (property.rows[0]?.publication_payment_status === "pending") {
        return res.status(409).json({
          message: "Cette annonce ne peut pas être rejetée avant le paiement requis.",
        });
      }
      return res.status(404).json({ message: "Bien introuvable." });
    }

    // Notifier le propriétaire avec le motif
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, title, message, link)
         VALUES ($1, 'Annonce rejetée ❌', $2, '/mes-annonces')`,
        [
          result.rows[0].proprietaire_id,
          `Votre annonce "${result.rows[0].titre}" a été rejetée. Motif : ${reason || "Non conforme"}.`,
        ]
      );
    } catch (notifErr) {
      console.warn("Notification admin non envoyée:", notifErr.message);
    }

    res.json({
      message: "Bien rejeté.",
      property: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur rejet bien admin :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// 5. Récupérer les signalements
router.get("/reports", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, p.titre AS property_title, u.nom AS reporter_name
       FROM reports r
       LEFT JOIN properties p ON r.property_id = p.id
       LEFT JOIN users u ON r.reporter_id = u.id
       WHERE r.status = 'en_attente'
       ORDER BY r.created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur signalements admin :", error);
    res.status(500).json({ message: "Impossible de récupérer les signalements." });
  }
});

// 6. Marquer un signalement comme traité
router.patch("/reports/:id/resolve", async (req, res) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    if (isNaN(reportId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    const result = await pool.query(
      `UPDATE reports
       SET status = 'resolu'
       WHERE id = $1
       RETURNING *`,
      [reportId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Signalement introuvable." });
    }

    res.json({ message: "Signalement marqué comme traité ✅" });
  } catch (error) {
    console.error("Erreur résolution signalement :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

// 7. Liste des utilisateurs (sans hash de mot de passe)
router.get("/users", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, nom, email, phone, role, is_active, is_verified, created_at,
              (id = $1) AS is_current_user
       FROM users
       ORDER BY created_at DESC`,
      [req.user.id]
    );

    res.json(result.rows);
  } catch (error) {
    console.error("Erreur liste utilisateurs admin :", error);
    res.status(500).json({ message: "Erreur serveur." });
  }
});

router.patch("/users/:id/verification", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  const { is_verified: isVerified } = req.body;

  if (!Number.isInteger(userId) || userId < 1 || typeof isVerified !== "boolean") {
    return res.status(400).json({ message: "Identifiant ou statut de vérification invalide." });
  }

  try {
    const target = await pool.query(
      "SELECT id, nom, role FROM users WHERE id = $1",
      [userId]
    );
    if (!target.rows.length) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    if (target.rows[0].role !== "proprietaire") {
      return res.status(400).json({ message: "Seuls les comptes propriétaires peuvent être vérifiés." });
    }

    const result = await pool.query(
      `UPDATE users SET is_verified = $1 WHERE id = $2
       RETURNING id, nom, email, phone, role, is_active, is_verified, created_at`,
      [isVerified, userId]
    );

    try {
      await createAndEmitNotification(req.app.get("io"), {
        userId,
        title: isVerified ? "Compte propriétaire vérifié" : "Vérification du compte modifiée",
        message: isVerified
          ? "L'équipe Immo229 a vérifié votre compte propriétaire."
          : "Le badge de vérification de votre compte propriétaire a été retiré.",
        link: "/profile",
      });
    } catch (notificationError) {
      console.warn("Notification de vérification propriétaire non envoyée:", notificationError.message);
    }

    return res.json({ message: "Statut de vérification mis à jour.", user: result.rows[0] });
  } catch (error) {
    console.error("Erreur vérification propriétaire :", error.message);
    return res.status(500).json({ message: "Impossible de mettre à jour la vérification du compte." });
  }
});

router.patch("/properties/:id/verification", async (req, res) => {
  const propertyId = Number.parseInt(req.params.id, 10);
  const { is_verified: isVerified } = req.body;

  if (!Number.isInteger(propertyId) || propertyId < 1 || typeof isVerified !== "boolean") {
    return res.status(400).json({ message: "Identifiant ou statut de vérification invalide." });
  }

  try {
    const property = await pool.query(
      `UPDATE properties
       SET is_verified = $1
       WHERE id = $2
         AND ($1 = FALSE OR status = 'disponible')
       RETURNING *`,
      [isVerified, propertyId]
    );
    if (!property.rows.length) {
      const existing = await pool.query("SELECT id, status FROM properties WHERE id = $1", [propertyId]);
      if (!existing.rows.length) {
        return res.status(404).json({ message: "Annonce introuvable." });
      }
      return res.status(409).json({ message: "Seules les annonces disponibles peuvent recevoir ce badge." });
    }

    try {
      await createAndEmitNotification(req.app.get("io"), {
        userId: property.rows[0].proprietaire_id,
        title: isVerified ? "Annonce vérifiée" : "Vérification de l'annonce modifiée",
        message: isVerified
          ? `L'équipe Immo229 a vérifié votre annonce « ${property.rows[0].titre} ».`
          : `Le badge de vérification de votre annonce « ${property.rows[0].titre} » a été retiré.`,
        link: `/bien/${propertyId}`,
      });
    } catch (notificationError) {
      console.warn("Notification de vérification d'annonce non envoyée:", notificationError.message);
    }

    return res.json({ message: "Statut de vérification de l'annonce mis à jour.", property: property.rows[0] });
  } catch (error) {
    console.error("Erreur vérification annonce :", error.message);
    return res.status(500).json({ message: "Impossible de mettre à jour la vérification de l'annonce." });
  }
});

router.patch("/users/:id/status", async (req, res) => {
  const userId = Number.parseInt(req.params.id, 10);
  const { is_active: isActive } = req.body;

  if (!Number.isInteger(userId) || userId < 1 || typeof isActive !== "boolean") {
    return res.status(400).json({ message: "Identifiant ou statut invalide." });
  }
  if (userId === Number(req.user.id)) {
    return res.status(400).json({ message: "Vous ne pouvez pas suspendre votre propre compte." });
  }

  try {
    const target = await pool.query(
      "SELECT role FROM users WHERE id = $1",
      [userId]
    );
    if (target.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }
    if (target.rows[0].role === "admin") {
      return res.status(403).json({ message: "La suspension d'un compte administrateur n'est pas autorisée." });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = $1
       WHERE id = $2
       RETURNING id, nom, email, role, is_active`,
      [isActive, userId]
    );

    if (!isActive) {
      req.app.get("io")?.in(`user:${userId}`).disconnectSockets(true);
    }

    return res.json({
      message: isActive ? "Compte réactivé." : "Compte suspendu.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur changement de statut utilisateur :", error);
    return res.status(500).json({ message: "Impossible de modifier le statut du compte." });
  }
});

module.exports = router;
