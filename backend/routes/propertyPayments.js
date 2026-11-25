const crypto = require("node:crypto");
const express = require("express");
const { pool } = require("../db");
const authMiddleware = require("../middleware/auth");
const mtnMomo = require("../services/mtnMomo");
const { notifyMatchingSearchAlerts } = require("../utils/searchAlerts");

const router = express.Router();
const PUBLICATION_FEE = 1000;
const MESSAGING_FEE = 500;
const FINAL_FAILURE_STATUSES = new Set(["FAILED", "REJECTED", "CANCELLED", "EXPIRED"]);

function configError(res) {
  try {
    mtnMomo.assertConfig();
    return false;
  } catch (error) {
    res.status(error.status || 503).json({ message: error.message });
    return true;
  }
}

function normalizeStatus(status) {
  const providerStatus = String(status || "").toUpperCase();
  if (providerStatus === "SUCCESSFUL") return "paid";
  if (FINAL_FAILURE_STATUSES.has(providerStatus)) return "failed";
  return "pending";
}

async function updatePaymentStatus(table, referenceId, status) {
  await pool.query(
    `UPDATE ${table}
     SET status = $1, updated_at = CURRENT_TIMESTAMP
     WHERE provider_transaction_id = $2 AND status != 'paid'`,
    [status, referenceId]
  );
}

async function verifyProviderPayment(payment, table, expectedAmount) {
  if (
    Number(payment.amount) !== expectedAmount
    || String(payment.currency).toUpperCase() !== "XOF"
  ) {
    return { found: true, paid: false, status: "unverified" };
  }

  const transaction = await mtnMomo.getPaymentStatus(payment.provider_transaction_id);
  if (
    !transaction
    || String(transaction.externalId || "") !== String(payment.provider_transaction_id)
    || Number(transaction.amount) !== expectedAmount
    || String(transaction.currency || "").toUpperCase() !== "XOF"
  ) {
    return { found: true, paid: false, status: "unverified" };
  }

  const status = normalizeStatus(transaction.status);
  if (status !== "paid") {
    if (status === "failed") {
      await updatePaymentStatus(table, payment.provider_transaction_id, status);
    }
    return { found: true, paid: false, status };
  }

  if (table === "property_payments") {
    const publishedResult = await pool.query(
      `UPDATE properties
       SET status = 'disponible', publication_payment_status = 'paid'
       WHERE id = $1 AND proprietaire_id = $2
         AND status = 'en_attente'
         AND publication_payment_status = 'pending'
       RETURNING id`,
      [payment.property_id, payment.owner_id]
    );

    const propertyResult = publishedResult.rows.length > 0
      ? publishedResult
      : await pool.query(
        `SELECT id
         FROM properties
         WHERE id = $1 AND proprietaire_id = $2
           AND status = 'disponible'
           AND publication_payment_status = 'paid'`,
        [payment.property_id, payment.owner_id]
      );

    if (propertyResult.rows.length === 0) {
      return { found: true, paid: false, status: "payment_received" };
    }

    await updatePaymentStatus("property_payments", payment.provider_transaction_id, "paid");

    if (publishedResult.rows.length > 0) {
      try {
        await pool.query(
          `INSERT INTO notifications (user_id, title, message, link)
           VALUES ($1, 'Annonce publiée automatiquement ✅', $2, $3)`,
          [
            payment.owner_id,
            `Le paiement de 1 000 FCFA pour "${payment.property_title}" est confirmé. Votre annonce est désormais visible.`,
            `/bien/${payment.property_id}`,
          ]
        );
      } catch (error) {
        console.warn("Notification de paiement non envoyée:", error.message);
      }

      try {
        const propertyResult = await pool.query(
          `SELECT p.*, u.email AS owner_email
           FROM properties p
           LEFT JOIN users u ON u.id = p.proprietaire_id
           WHERE p.id = $1`,
          [payment.property_id]
        );
        await notifyMatchingSearchAlerts(pool, payment.io, propertyResult.rows[0]);
      } catch (error) {
        console.error("Erreur alertes de recherche après paiement :", error.message);
      }
    }
  } else {
    await updatePaymentStatus("messaging_payments", payment.provider_transaction_id, "paid");
  }

  return {
    found: true,
    paid: true,
    status: "SUCCESSFUL",
    propertyId: payment.property_id,
    clientId: payment.client_id,
  };
}

async function getPayment(table, referenceId) {
  if (table === "property_payments") {
    const result = await pool.query(
      `SELECT pp.*, p.titre AS property_title
       FROM property_payments pp
       JOIN properties p ON p.id = pp.property_id
       WHERE pp.provider_transaction_id = $1`,
      [referenceId]
    );
    return result.rows[0];
  }

  const result = await pool.query(
    `SELECT *
     FROM messaging_payments
     WHERE provider_transaction_id = $1`,
    [referenceId]
  );
  return result.rows[0];
}

async function verifyPayment(table, referenceId, io) {
  const payment = await getPayment(table, referenceId);
  if (!payment) return { found: false, paid: false };
  if (payment.status === "paid") {
    return { found: true, paid: true, status: "SUCCESSFUL", propertyId: payment.property_id };
  }

  return verifyProviderPayment(
    { ...payment, io },
    table,
    table === "property_payments" ? PUBLICATION_FEE : MESSAGING_FEE
  );
}

async function startPayment({ table, propertyId, userId, phoneNumber, amount, description }) {
  const referenceId = crypto.randomUUID();
  const msisdn = mtnMomo.normalizeMsisdn(phoneNumber);
  const isPublication = table === "property_payments";

  if (isPublication) {
    await pool.query(
      `INSERT INTO property_payments
       (property_id, owner_id, provider_transaction_id, payment_method, amount, currency, status)
       VALUES ($1, $2, $3, 'mtn_mobile_money', $4, 'XOF', 'pending')`,
      [propertyId, userId, referenceId, amount]
    );
  } else {
    await pool.query(
      `INSERT INTO messaging_payments
       (property_id, client_id, provider_transaction_id, payment_method, amount, currency, status)
       VALUES ($1, $2, $3, 'mtn_mobile_money', $4, 'XOF', 'pending')
       ON CONFLICT (property_id, client_id)
       DO UPDATE SET provider_transaction_id = EXCLUDED.provider_transaction_id,
                     payment_method = EXCLUDED.payment_method,
                     amount = EXCLUDED.amount, currency = EXCLUDED.currency,
                     status = 'pending', updated_at = CURRENT_TIMESTAMP`,
      [propertyId, userId, referenceId, amount]
    );
  }

  try {
    await mtnMomo.requestToPay({
      referenceId,
      phoneNumber: msisdn,
      amount,
      externalId: referenceId,
      payerMessage: description,
      payeeNote: "IMOVA",
    });
  } catch (error) {
    if (error.status === 400) {
      await updatePaymentStatus(table, referenceId, "failed");
    }
    throw error;
  }

  return {
    paid: false,
    status: "pending",
    amount,
    currency: "XOF",
    propertyId,
  };
}

router.post("/messaging/properties/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Cette action est réservée aux clients." });
    }

    const propertyId = Number(req.params.id);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant d'annonce invalide." });
    }

    const propertyResult = await pool.query(
      `SELECT p.id, p.proprietaire_id
       FROM properties p
       WHERE p.id = $1 AND p.status = 'disponible'`,
      [propertyId]
    );
    const property = propertyResult.rows[0];
    if (!property) {
      return res.status(404).json({ message: "Annonce disponible introuvable." });
    }
    if (String(property.proprietaire_id) === String(req.user.id)) {
      return res.status(400).json({ message: "Vous ne pouvez pas contacter votre propre annonce." });
    }

    const currentResult = await pool.query(
      `SELECT *
       FROM messaging_payments
       WHERE property_id = $1 AND client_id = $2`,
      [propertyId, req.user.id]
    );
    let existingPayment = currentResult.rows[0];
    if (existingPayment?.status === "paid") {
      return res.json({ paid: true, propertyId });
    }

    if (configError(res)) return;
    if (existingPayment?.status === "pending") {
      const verification = await verifyProviderPayment(
        existingPayment,
        "messaging_payments",
        MESSAGING_FEE
      );
      if (verification.paid) return res.json({ paid: true, propertyId });
      if (verification.status !== "failed") {
        return res.status(202).json({
          paid: false,
          status: verification.status || "pending",
          amount: MESSAGING_FEE,
          currency: "XOF",
          propertyId,
        });
      }
      existingPayment = { ...existingPayment, status: "failed" };
    }

    const result = await startPayment({
      table: "messaging_payments",
      propertyId,
      userId: req.user.id,
      phoneNumber: req.body.phoneNumber,
      amount: MESSAGING_FEE,
      description: `Accès messagerie IMOVA - annonce #${propertyId}`,
    });
    return res.status(202).json(result);
  } catch (error) {
    console.error("Erreur création paiement messagerie:", error.message);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Impossible de préparer le paiement de la messagerie.",
    });
  }
});

router.get("/messaging/properties/:id/status", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "client") {
      return res.status(403).json({ message: "Cette action est réservée aux clients." });
    }

    const propertyId = Number(req.params.id);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant d'annonce invalide." });
    }

    const result = await pool.query(
      `SELECT provider_transaction_id, status, property_id
       FROM messaging_payments
       WHERE property_id = $1 AND client_id = $2`,
      [propertyId, req.user.id]
    );
    const payment = result.rows[0];
    if (!payment) {
      return res.json({ paid: false, status: "unpaid", propertyId });
    }
    if (payment.status === "paid") {
      return res.json({ paid: true, status: "SUCCESSFUL", propertyId });
    }
    if (configError(res)) return;

    const verification = await verifyPayment(
      "messaging_payments",
      payment.provider_transaction_id,
      req.app.get("io")
    );
    return res.json({
      paid: verification.paid,
      status: verification.status || "pending",
      propertyId,
    });
  } catch (error) {
    console.error("Erreur vérification paiement messagerie:", error.message);
    return res.status(error.status || 502).json({
      message: error.status ? error.message : "Impossible de vérifier le paiement auprès de MTN Mobile Money.",
    });
  }
});

router.post("/properties/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "proprietaire") {
      return res.status(403).json({ message: "Cette action est réservée aux propriétaires." });
    }

    const propertyId = Number(req.params.id);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant d'annonce invalide." });
    }

    const propertyResult = await pool.query(
      `SELECT p.id, p.titre, p.status, p.publication_payment_status
       FROM properties p
       WHERE p.id = $1 AND p.proprietaire_id = $2`,
      [propertyId, req.user.id]
    );
    const property = propertyResult.rows[0];
    if (!property) {
      return res.status(404).json({ message: "Annonce introuvable ou non autorisée." });
    }
    if (
      property.status !== "en_attente"
      || property.publication_payment_status !== "pending"
    ) {
      if (property.publication_payment_status === "paid") {
        return res.json({ paid: true, propertyId });
      }
      return res.status(409).json({ message: "Cette annonce ne peut pas être payée dans son état actuel." });
    }

    const existingResult = await pool.query(
      `SELECT *
       FROM property_payments
       WHERE property_id = $1 AND owner_id = $2 AND status = 'pending'
       ORDER BY id DESC
       LIMIT 1`,
      [propertyId, req.user.id]
    );
    const existingPayment = existingResult.rows[0];

    if (existingPayment) {
      if (configError(res)) return;
      const verification = await verifyProviderPayment(
        { ...existingPayment, property_title: property.titre, io: req.app.get("io") },
        "property_payments",
        PUBLICATION_FEE
      );
      if (verification.paid) return res.json({ paid: true, propertyId });
      if (verification.status !== "failed") {
        return res.status(202).json({
          paid: false,
          status: verification.status || "pending",
          amount: PUBLICATION_FEE,
          currency: "XOF",
          propertyId,
        });
      }
    }

    if (configError(res)) return;
    const result = await startPayment({
      table: "property_payments",
      propertyId,
      userId: req.user.id,
      phoneNumber: req.body.phoneNumber,
      amount: PUBLICATION_FEE,
      description: `Publication annonce IMOVA #${propertyId}`,
    });
    return res.status(202).json(result);
  } catch (error) {
    console.error("Erreur création paiement annonce:", error.message);
    return res.status(error.status || 500).json({
      message: error.status ? error.message : "Impossible de préparer le paiement de l'annonce.",
    });
  }
});

router.get("/properties/:id/status", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "proprietaire") {
      return res.status(403).json({ message: "Cette action est réservée aux propriétaires." });
    }

    const propertyId = Number(req.params.id);
    if (!Number.isInteger(propertyId) || propertyId <= 0) {
      return res.status(400).json({ message: "Identifiant d'annonce invalide." });
    }

    const propertyResult = await pool.query(
      `SELECT status, publication_payment_status
       FROM properties
       WHERE id = $1 AND proprietaire_id = $2`,
      [propertyId, req.user.id]
    );
    const property = propertyResult.rows[0];
    if (!property) {
      return res.status(404).json({ message: "Annonce introuvable ou non autorisée." });
    }
    if (property.publication_payment_status === "paid") {
      return res.json({ paid: true, status: property.status, propertyId });
    }

    const paymentResult = await pool.query(
      `SELECT provider_transaction_id
       FROM property_payments
       WHERE property_id = $1 AND owner_id = $2 AND status = 'pending'
       ORDER BY id DESC
       LIMIT 1`,
      [propertyId, req.user.id]
    );
    const payment = paymentResult.rows[0];
    if (!payment) {
      return res.json({ paid: false, status: "unpaid", propertyId });
    }
    if (configError(res)) return;

    const verification = await verifyPayment(
      "property_payments",
      payment.provider_transaction_id,
      req.app.get("io")
    );
    return res.json({
      paid: verification.paid,
      status: verification.status || "pending",
      propertyId,
    });
  } catch (error) {
    console.error("Erreur vérification paiement annonce:", error.message);
    return res.status(error.status || 502).json({
      message: error.status ? error.message : "Impossible de vérifier le paiement auprès de MTN Mobile Money.",
    });
  }
});

module.exports = router;
