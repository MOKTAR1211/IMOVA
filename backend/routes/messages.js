const express = require("express");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const router = express.Router();
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");
const uploadMessageAttachment = require("../middleware/uploadMessageAttachment");

const privateUploadDir = path.join(__dirname, "../private-uploads");
const attachmentExtensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function hasValidImageSignature(buffer, mimeType) {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.toString("ascii", 0, 4) === "RIFF"
      && buffer.toString("ascii", 8, 12) === "WEBP";
  }
  return false;
}

async function getConversationForUser(conversationId, userId) {
  const result = await pool.query(
    `SELECT id, property_id, buyer_id, seller_id
     FROM conversations
     WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
    [conversationId, userId]
  );
  return result.rows[0] || null;
}

async function hasMessagingPayment(propertyId, clientId) {
  const result = await pool.query(
    `SELECT id FROM messaging_payments
     WHERE property_id = $1 AND client_id = $2 AND status = 'paid'
     LIMIT 1`,
    [propertyId, clientId]
  );
  return result.rows.length > 0;
}

function attachmentPublicFields(message) {
  if (!message.attachment_path) return {};
  return {
    attachmentUrl: `/api/messages/conversations/${message.conversation_id}/attachments/${message.id}`,
    attachmentName: message.attachment_name,
    attachmentMime: message.attachment_mime,
  };
}

// 1. Démarrer ou récupérer une conversation pour un bien
router.post("/conversations", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Seuls les clients peuvent démarrer une conversation." });
    }

    const propertyId = req.body.propertyId || req.body.property_id;
    const currentUserId = req.user.id;

    if (!propertyId) {
      return res.status(400).json({ message: "L'identifiant du bien est requis." });
    }

    // Récupérer le bien et identifier le propriétaire (proprietaire_id dans la base de données)
    const propResult = await pool.query(
      "SELECT id, proprietaire_id, titre, status FROM properties WHERE id = $1",
      [propertyId]
    );

    if (propResult.rows.length === 0) {
      return res.status(404).json({ message: "Bien immobilier introuvable." });
    }

    const property = propResult.rows[0];
    if (property.status !== "disponible") {
      return res.status(409).json({
        message: property.status === "loue"
          ? "Cette annonce est déjà louée. La messagerie n'est plus disponible pour ce bien."
          : "Cette annonce n'est plus disponible. La messagerie ne peut pas être activée.",
        propertyStatus: property.status,
      });
    }

    const sellerId = property.proprietaire_id;

    if (!sellerId) {
      return res.status(400).json({ message: "Ce bien n'a aucun propriétaire associé." });
    }

    if (sellerId === currentUserId) {
      return res.status(400).json({
        message: "Vous ne pouvez pas démarrer une conversation sur votre propre annonce.",
      });
    }

    const paidAccess = await pool.query(
      `SELECT id FROM messaging_payments
       WHERE property_id = $1 AND client_id = $2 AND status = 'paid'
       LIMIT 1`,
      [propertyId, currentUserId]
    );

    if (paidAccess.rows.length === 0) {
      return res.status(402).json({
        message: "Le paiement de 500 FCFA est requis pour accéder à la messagerie de cette annonce.",
        paymentRequired: true,
        propertyId,
      });
    }

    // Vérifier si une conversation existe déjà entre cet acheteur et ce vendeur pour ce bien
    const existing = await pool.query(
      `SELECT id FROM conversations 
       WHERE property_id = $1 
         AND ((buyer_id = $2 AND seller_id = $3) OR (buyer_id = $3 AND seller_id = $2))
       LIMIT 1`,
      [propertyId, currentUserId, sellerId]
    );

    if (existing.rows.length > 0) {
      return res.json({ id: existing.rows[0].id, isExisting: true });
    }

    // Créer la nouvelle conversation
    const newConvo = await pool.query(
      `INSERT INTO conversations (property_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       RETURNING id, created_at`,
      [propertyId, currentUserId, sellerId]
    );

    return res.status(201).json({ id: newConvo.rows[0].id, isExisting: false });
  } catch (error) {
    console.error("Erreur création conversation :", error);
    return res.status(500).json({ message: "Erreur lors de la création de la conversation." });
  }
});

// 2. Récupérer toutes les conversations de l'utilisateur connecté
router.get("/conversations", authMiddleware, async (req, res) => {
  try {
    const currentUserId = req.user.id;

    const query = `
      SELECT 
        c.id,
        c.property_id,
        c.buyer_id,
        c.seller_id,
        c.created_at,
        c.updated_at,
        p.titre AS property_title,
        p.image_url AS property_image,
        p.prix AS property_price,
        p.ville AS property_city,
        p.quartier AS property_neighborhood,
        p.status AS property_status,
        u_other.id AS other_user_id,
        u_other.nom AS other_user_nom,
        u_other.email AS other_user_email,
        u_other.role AS other_user_role,
        CASE
          WHEN last_message.content <> '' THEN last_message.content
          WHEN last_message.attachment_path IS NOT NULL THEN 'Photo jointe'
        END AS last_message,
        last_message.created_at AS last_message_date,
        COALESCE(unread.unread_count, 0)::int AS unread_count
    FROM conversations c
    LEFT JOIN properties p ON p.id = c.property_id
    LEFT JOIN messaging_payments paid_access
      ON paid_access.property_id = c.property_id
      AND paid_access.client_id = c.buyer_id
      AND paid_access.status = 'paid'
    LEFT JOIN (
      SELECT conversation_id, MAX(id) AS last_message_id
      FROM messages
      GROUP BY conversation_id
    ) latest ON latest.conversation_id = c.id
    LEFT JOIN messages last_message ON last_message.id = latest.last_message_id
    LEFT JOIN (
      SELECT conversation_id, COUNT(*)::int AS unread_count
      FROM messages
      WHERE sender_id <> $1 AND is_read = FALSE
      GROUP BY conversation_id
    ) unread ON unread.conversation_id = c.id
    JOIN users u_other ON u_other.id = CASE 
      WHEN c.buyer_id = $1 THEN c.seller_id 
      ELSE c.buyer_id 
    END
    WHERE (c.buyer_id = $1 OR c.seller_id = $1)
      AND (c.buyer_id <> $1 OR paid_access.id IS NOT NULL)
      AND (
        (c.buyer_id = $1 AND COALESCE(c.buyer_archived, FALSE) = FALSE)
        OR
        (c.seller_id = $1 AND COALESCE(c.seller_archived, FALSE) = FALSE AND COALESCE(c.owner_archived, FALSE) = FALSE)
      )
    ORDER BY COALESCE(
      last_message.created_at,
      c.created_at
    ) DESC
  `;

  const result = await pool.query(query, [currentUserId]);

  const formatted = result.rows.map((row) => ({
    id: row.id,
    propertyId: row.property_id,
    propertyTitle: row.property_title,
    propertyImage: row.property_image,
    propertyPrice: row.property_price,
    propertyCity: row.property_city,
    propertyNeighborhood: row.property_neighborhood,
    propertyStatus: row.property_status,
    last_message: row.last_message || "Aucun message pour le moment",
    lastMessage: row.last_message || "Aucun message pour le moment",
    lastMessageDate: row.last_message_date || row.created_at,
    unreadCount: row.unread_count || 0,
    first_name: row.other_user_nom ? row.other_user_nom.split(" ")[0] : "",
    last_name: row.other_user_nom ? row.other_user_nom.split(" ").slice(1).join(" ") : "",
    otherUser: {
      id: row.other_user_id,
      nom: row.other_user_nom,
      email: row.other_user_email,
      role: row.other_user_role,
    },
  }));

    return res.json(formatted);
  } catch (error) {
    console.error("Erreur récupération conversations :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// 3. Récupérer les messages d'une conversation spécifique (sécurisée)
router.get("/conversations/:conversationId", authMiddleware, async (req, res) => {
  try {
    const conversationId = parseInt(req.params.conversationId, 10);
    const currentUserId = req.user.id;

    if (isNaN(conversationId)) {
      return res.status(400).json({ message: "Identifiant invalide." });
    }

    // Sécurité stricte : vérifier que l'utilisateur est bien acheteur ou vendeur de la conversation
    const convoResult = await pool.query(
      `SELECT 
         c.id, c.property_id, c.buyer_id, c.seller_id, c.created_at,
         p.titre AS property_title,
         p.image_url AS property_image,
         p.prix AS property_price,
         p.ville AS property_city,
         p.quartier AS property_neighborhood,
         p.status AS property_status,
         u_other.id AS other_user_id,
         u_other.nom AS other_user_nom,
         u_other.email AS other_user_email,
         u_other.role AS other_user_role
       FROM conversations c
       LEFT JOIN properties p ON p.id = c.property_id
       JOIN users u_other ON u_other.id = CASE 
         WHEN c.buyer_id = $2 THEN c.seller_id 
         ELSE c.buyer_id 
       END
       WHERE c.id = $1 AND (c.buyer_id = $2 OR c.seller_id = $2)`,
      [conversationId, currentUserId]
    );

    if (convoResult.rows.length === 0) {
      return res.status(403).json({
        message: "Accès refusé. Vous n'avez pas accès à cette conversation.",
      });
    }

    const conversationData = convoResult.rows[0];

    if (
      req.user.role === "client"
      && String(conversationData.buyer_id) === String(currentUserId)
    ) {
      const paidAccess = await pool.query(
        `SELECT id FROM messaging_payments
         WHERE property_id = $1 AND client_id = $2 AND status = 'paid'
         LIMIT 1`,
        [conversationData.property_id, currentUserId]
      );
      if (paidAccess.rows.length === 0) {
        return res.status(402).json({
          message: "Le paiement de 500 FCFA est requis pour accéder à cette messagerie.",
          paymentRequired: true,
          propertyId: conversationData.property_id,
        });
      }
    }

    // Marquer les messages reçus comme lus
    const updateResult = await pool.query(
      `UPDATE messages 
       SET is_read = true 
       WHERE conversation_id = $1 AND sender_id != $2 AND is_read = false
       RETURNING id, sender_id`,
      [conversationId, currentUserId]
    );

    const io = req.app.get("io");
    if (io && updateResult.rows.length > 0) {
      const senderIds = [...new Set(updateResult.rows.map((r) => r.sender_id))];
      senderIds.forEach((sId) => {
        io.to(`user:${sId}`).emit("message:read", {
          conversationId: Number(conversationId),
          readerId: currentUserId,
        });
      });
      io.to(`conversation:${conversationId}`).emit("message:read", {
        conversationId: Number(conversationId),
        readerId: currentUserId,
      });
    }

    // Récupérer tous les messages
    const msgResult = await pool.query(
      `SELECT 
         m.id, 
         m.conversation_id, 
         m.sender_id, 
         m.content, 
         m.is_read, 
         m.created_at,
         m.attachment_path,
         m.attachment_name,
         m.attachment_mime,
         u.nom AS sender_name
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.conversation_id = $1
       ORDER BY m.created_at ASC`,
      [conversationId]
    );

    return res.json({
      conversation: {
        id: conversationData.id,
        propertyId: conversationData.property_id,
        propertyTitle: conversationData.property_title,
        propertyImage: conversationData.property_image,
        propertyPrice: conversationData.property_price,
        propertyCity: conversationData.property_city,
        propertyNeighborhood: conversationData.property_neighborhood,
        propertyStatus: conversationData.property_status,
        otherUser: {
          id: conversationData.other_user_id,
          nom: conversationData.other_user_nom,
          email: conversationData.other_user_email,
          role: conversationData.other_user_role,
        },
      },
      messages: msgResult.rows.map((message) => ({
        ...message,
        ...attachmentPublicFields(message),
        attachment_path: undefined,
      })),
    });
  } catch (error) {
    console.error("Erreur lecture conversation :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
});

// 4. Servir une pièce jointe uniquement aux participants autorisés.
router.get(
  "/conversations/:conversationId/attachments/:messageId",
  authMiddleware,
  async (req, res) => {
    try {
      const conversationId = Number(req.params.conversationId);
      const messageId = Number(req.params.messageId);
      if (!Number.isInteger(conversationId) || conversationId <= 0
        || !Number.isInteger(messageId) || messageId <= 0) {
        return res.status(400).json({ message: "Identifiant de pièce jointe invalide." });
      }

      const conversation = await getConversationForUser(conversationId, req.user.id);
      if (!conversation) {
        return res.status(403).json({ message: "Accès refusé à cette pièce jointe." });
      }
      if (
        String(conversation.buyer_id) === String(req.user.id)
        && !await hasMessagingPayment(conversation.property_id, req.user.id)
      ) {
        return res.status(402).json({
          message: "Le paiement de la messagerie est requis pour accéder à cette pièce jointe.",
          paymentRequired: true,
        });
      }

      const result = await pool.query(
        `SELECT attachment_path, attachment_mime
         FROM messages
         WHERE id = $1 AND conversation_id = $2 AND attachment_path IS NOT NULL`,
        [messageId, conversationId]
      );
      const attachment = result.rows[0];
      if (!attachment || !attachmentExtensions[attachment.attachment_mime]) {
        return res.status(404).json({ message: "Pièce jointe introuvable." });
      }

      const absolutePath = path.resolve(privateUploadDir, attachment.attachment_path);
      if (!absolutePath.startsWith(`${privateUploadDir}${path.sep}`)) {
        return res.status(404).json({ message: "Pièce jointe introuvable." });
      }

      return res.sendFile(absolutePath, {
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }, (error) => {
        if (error && !res.headersSent) {
          console.error("Erreur lecture pièce jointe de messagerie :", error.message);
          res.status(error.statusCode === 404 ? 404 : 500).json({
            message: error.statusCode === 404
              ? "Pièce jointe introuvable."
              : "Impossible de lire la pièce jointe.",
          });
        }
      });
    } catch (error) {
      console.error("Erreur accès pièce jointe de messagerie :", error.message);
      return res.status(500).json({ message: "Impossible de récupérer la pièce jointe." });
    }
  }
);

// 5. Envoyer un message texte, une image ou les deux.
router.post(
  "/conversations/:conversationId/messages",
  authMiddleware,
  uploadMessageAttachment.single("attachment"),
  async (req, res) => {
    let absoluteAttachmentPath = null;
    try {
      const conversationId = Number(req.params.conversationId);
      const currentUserId = req.user.id;
      const content = typeof req.body.content === "string" ? req.body.content.trim() : "";
      const file = req.file;

      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        return res.status(400).json({ message: "Identifiant de conversation invalide." });
      }
      if (!content && !file) {
        return res.status(400).json({ message: "Écrivez un message ou joignez une image." });
      }
      if (content.length > 5000) {
        return res.status(400).json({ message: "Le message ne peut pas dépasser 5 000 caractères." });
      }

      const conversation = await getConversationForUser(conversationId, currentUserId);
      if (!conversation) {
        return res.status(403).json({ message: "Vous ne faites pas partie de cette conversation." });
      }
      if (
        req.user.role === "client"
        && String(conversation.buyer_id) === String(currentUserId)
        && !await hasMessagingPayment(conversation.property_id, currentUserId)
      ) {
        return res.status(402).json({
          message: "Le paiement de 500 FCFA est requis avant d'envoyer un message.",
          paymentRequired: true,
          propertyId: conversation.property_id,
        });
      }

      if (file && !hasValidImageSignature(file.buffer, file.mimetype)) {
        return res.status(400).json({
          message: "Le fichier ne semble pas être une image JPG, PNG ou WEBP valide.",
        });
      }

      let attachmentPath = null;
      if (file) {
        const filename = `${crypto.randomUUID()}${attachmentExtensions[file.mimetype]}`;
        attachmentPath = path.join("messages", filename);
        absoluteAttachmentPath = path.join(privateUploadDir, attachmentPath);
        await fs.promises.mkdir(path.dirname(absoluteAttachmentPath), { recursive: true });
        await fs.promises.writeFile(absoluteAttachmentPath, file.buffer, { flag: "wx" });
      }

      const receiverId = String(conversation.buyer_id) === String(currentUserId)
        ? conversation.seller_id
        : conversation.buyer_id;
      let msgResult;
      try {
        const safeAttachmentName = file
          ? String(file.originalname).replace(/[\\/\r\n"]/g, "").slice(0, 255)
          : null;
        msgResult = await pool.query(
          `INSERT INTO messages (
             conversation_id, sender_id, content, attachment_path, attachment_name, attachment_mime
           )
           VALUES ($1, $2, $3, $4, $5, $6)
           RETURNING id, conversation_id, sender_id, content, is_read, created_at,
                     attachment_path, attachment_name, attachment_mime`,
          [
            conversationId,
            currentUserId,
            content,
            attachmentPath,
            safeAttachmentName,
            file?.mimetype || null,
          ]
        );
      } catch (error) {
        if (absoluteAttachmentPath) {
          await fs.promises.unlink(absoluteAttachmentPath).catch((cleanupError) => {
            console.error("Erreur nettoyage pièce jointe non enregistrée :", cleanupError.message);
          });
        }
        throw error;
      }

      const savedMessage = {
        ...msgResult.rows[0],
        ...attachmentPublicFields(msgResult.rows[0]),
        attachment_path: undefined,
      };
      absoluteAttachmentPath = null;

      await pool.query(
        "UPDATE conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = $1",
        [conversationId]
      );

      const io = req.app.get("io");
      if (io) {
        const payload = { ...savedMessage, conversationId };
        io.to(`user:${receiverId}`).to(`user:${currentUserId}`).emit("message:new", payload);
        io.to(`conversation:${conversationId}`).emit("message:new", payload);
      }

      try {
        const senderResult = await pool.query("SELECT nom FROM users WHERE id = $1", [currentUserId]);
        const senderName = senderResult.rows[0]?.nom || "Un utilisateur";
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, link)
           VALUES ($1, $2, $3, $4)`,
          [
            receiverId,
            "💬 Nouveau message",
            `Vous avez reçu un message de ${senderName}.`,
            `/messages/${conversationId}`,
          ]
        );
      } catch (notifErr) {
        console.warn("Notification error:", notifErr);
      }

      return res.status(201).json(savedMessage);
    } catch (error) {
      if (absoluteAttachmentPath) {
        await fs.promises.unlink(absoluteAttachmentPath).catch((cleanupError) => {
          if (cleanupError.code !== "ENOENT") {
            console.error("Erreur nettoyage pièce jointe non envoyée :", cleanupError.message);
          }
        });
      }
      console.error("Erreur envoi message :", error);
      return res.status(500).json({ message: "Erreur lors de l'envoi du message." });
    }
  }
);

router.post("/conversations/:id/reports", authMiddleware, async (req, res) => {
  const conversationId = Number(req.params.id);
  const messageId = Number(req.body.messageId);
  const reason = typeof req.body.reason === "string" ? req.body.reason : "";
  const description = typeof req.body.description === "string" ? req.body.description.trim() : "";
  const allowedReasons = ["harassment", "spam", "scam", "inappropriate", "other"];

  if (!Number.isInteger(conversationId) || conversationId < 1
    || !Number.isInteger(messageId) || messageId < 1
    || !allowedReasons.includes(reason)
    || description.length > 1000) {
    return res.status(400).json({ message: "Informations de signalement invalides." });
  }
  if (!["client", "proprietaire"].includes(req.user.role)) {
    return res.status(403).json({ message: "Seuls les participants peuvent signaler un message." });
  }

  try {
    const conversationResult = await pool.query(
      `SELECT id, property_id, buyer_id, seller_id
       FROM conversations
       WHERE id = $1 AND (buyer_id = $2 OR seller_id = $2)`,
      [conversationId, req.user.id]
    );
    if (!conversationResult.rows.length) {
      return res.status(404).json({ message: "Conversation introuvable." });
    }
    if (
      req.user.role === "client"
      && String(conversationResult.rows[0].buyer_id) === String(req.user.id)
      && !await hasMessagingPayment(conversationResult.rows[0].property_id, req.user.id)
    ) {
      return res.status(402).json({ message: "Le paiement de la messagerie est requis pour signaler un message." });
    }

    const messageResult = await pool.query(
      `SELECT id, sender_id
       FROM messages
       WHERE id = $1 AND conversation_id = $2`,
      [messageId, conversationId]
    );
    if (!messageResult.rows.length) {
      return res.status(404).json({ message: "Message introuvable dans cette conversation." });
    }
    if (String(messageResult.rows[0].sender_id) === String(req.user.id)) {
      return res.status(400).json({ message: "Vous ne pouvez pas signaler votre propre message." });
    }

    const result = await pool.query(
      `INSERT INTO conversation_message_reports
         (conversation_id, message_id, reporter_id, reason, description)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [conversationId, messageId, req.user.id, reason, description || null]
    );
    return res.status(201).json({
      message: "Le message a été signalé à l'équipe de modération.",
      report: result.rows[0],
    });
  } catch (error) {
    if (error.code === "23505") {
      return res.status(409).json({ message: "Vous avez déjà signalé ce message." });
    }
    console.error("Erreur signalement de message :", error);
    return res.status(500).json({ message: "Impossible de transmettre le signalement." });
  }
});

// 6. Masquer / Archiver une conversation
router.patch("/conversations/:id/archive", authMiddleware, async (req, res) => {
  try {
    const conversationId = Number(req.params.id);
    const userId = req.user.id;

    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({
        message: "Identifiant de conversation invalide.",
      });
    }

    const result = await pool.query(
      `UPDATE conversations
       SET buyer_archived = CASE
             WHEN buyer_id = $2 THEN TRUE
             ELSE buyer_archived
           END,
           seller_archived = CASE
             WHEN seller_id = $2 THEN TRUE
             ELSE seller_archived
           END,
           owner_archived = CASE
             WHEN seller_id = $2 THEN TRUE
             ELSE owner_archived
           END
       WHERE id = $1
         AND (buyer_id = $2 OR seller_id = $2)
       RETURNING id`,
      [conversationId, userId]
    );

    if (result.rowCount === 0 || result.rows.length === 0) {
      return res.status(404).json({
        message: "Conversation introuvable.",
      });
    }

    return res.json({
      message: "Conversation masquée.",
    });
  } catch (error) {
    console.error("Erreur archivage :", error);
    return res.status(500).json({
      message: "Erreur du serveur.",
    });
  }
});

module.exports = router;
