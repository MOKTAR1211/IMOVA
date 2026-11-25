const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const jwt = require("jsonwebtoken");
const { startIsolatedTestServer } = require("./testUtils/isolatedServer");
const { jwtSecret } = require("./config/security");

async function createUser(pool, suffix, role, name) {
  const result = await pool.query(
    `INSERT INTO users (nom, first_name, last_name, email, password, role)
     VALUES ($1, $2, $3, $4, 'unused', $5)
     RETURNING id`,
    [name, name.split(" ")[0], name.split(" ").slice(1).join(" "), `${suffix}@example.test`, role]
  );
  return result.rows[0].id;
}

async function responseJson(response) {
  return { response, data: await response.json() };
}

async function run() {
  const server = await startIsolatedTestServer();

  try {
    const suffix = crypto.randomUUID();
    const ownerId = await createUser(server.pool, `admin-module-owner-${suffix}`, "proprietaire", "Owner Test");
    const clientId = await createUser(server.pool, `admin-module-client-${suffix}`, "client", "Client Test");
    const adminId = await createUser(server.pool, `admin-module-admin-${suffix}`, "admin", "Admin Test");
    const createToken = (id, role) => jwt.sign({ id, role }, jwtSecret);
    const adminHeaders = { Authorization: `Bearer ${createToken(adminId, "admin")}` };
    const clientHeaders = { Authorization: `Bearer ${createToken(clientId, "client")}` };
    const ownerHeaders = { Authorization: `Bearer ${createToken(ownerId, "proprietaire")}` };

    const propertyResult = await server.pool.query(
      `INSERT INTO properties (titre, description, prix, ville, type, proprietaire_id)
       VALUES ('Annonce admin test', 'Annonce utilisée pour les tests admin.', 125000, 'Cotonou', 'Appartement', $1)
       RETURNING id`,
      [ownerId]
    );
    const propertyId = propertyResult.rows[0].id;
    await server.pool.query(
      `INSERT INTO property_payments
       (property_id, owner_id, provider_transaction_id, payment_method, amount, status)
       VALUES ($1, $2, $3, 'mtn_mobile_money', 1000, 'paid')`,
      [propertyId, ownerId, `publication-${suffix}`]
    );
    await server.pool.query(
      `INSERT INTO messaging_payments
       (property_id, client_id, provider_transaction_id, payment_method, amount, status)
       VALUES ($1, $2, $3, 'mtn_mobile_money', 500, 'paid')`,
      [propertyId, clientId, `messaging-${suffix}`]
    );
    const conversationResult = await server.pool.query(
      `INSERT INTO conversations (property_id, buyer_id, seller_id)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [propertyId, clientId, ownerId]
    );
    const conversationId = conversationResult.rows[0].id;
    const reportedMessageResult = await server.pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, 'Message de test à signaler')
       RETURNING id`,
      [conversationId, ownerId]
    );
    await server.pool.query(
      `INSERT INTO messages (conversation_id, sender_id, content)
       VALUES ($1, $2, 'Contexte de conversation conservé')`,
      [conversationId, clientId]
    );

    const unauthenticatedPayments = await fetch(`${server.baseUrl}/api/admin/payments`);
    assert.equal(unauthenticatedPayments.status, 401, "paiements admin sans session refusés");
    const forbiddenPayments = await fetch(`${server.baseUrl}/api/admin/payments`, { headers: ownerHeaders });
    assert.equal(forbiddenPayments.status, 403, "paiements admin refusés aux propriétaires");
    const paymentsResponse = await fetch(`${server.baseUrl}/api/admin/payments?status=paid`, { headers: adminHeaders });
    const payments = await paymentsResponse.json();
    assert.equal(paymentsResponse.status, 200);
    assert.equal(payments.total, 2);
    assert.ok(payments.payments.every((payment) => payment.status === "paid"));
    assert.ok(payments.payments.some((payment) => payment.payment_method === "mtn_mobile_money"));

    const publicationPayment = payments.payments.find((payment) => payment.payment_type === "publication");
    const paymentDetailResponse = await fetch(
      `${server.baseUrl}/api/admin/payments/publication/${publicationPayment.id}`,
      { headers: adminHeaders }
    );
    const paymentDetail = await paymentDetailResponse.json();
    assert.equal(paymentDetailResponse.status, 200);
    assert.equal(paymentDetail.provider_transaction_id, `publication-${suffix}`);
    assert.equal(paymentDetail.payer_email, `admin-module-owner-${suffix}@example.test`);

    const forbiddenReports = await fetch(`${server.baseUrl}/api/admin/message-reports`, { headers: clientHeaders });
    assert.equal(forbiddenReports.status, 403, "file de modération admin refusée aux clients");
    const forbiddenPrivateMessages = await fetch(
      `${server.baseUrl}/api/messages/conversations/${conversationId}`,
      { headers: adminHeaders }
    );
    assert.equal(forbiddenPrivateMessages.status, 403, "un admin ne peut pas lire une conversation privée non signalée");

    const submittedReport = await responseJson(await fetch(
      `${server.baseUrl}/api/messages/conversations/${conversationId}/reports`,
      {
        method: "POST",
        headers: { ...clientHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({
          messageId: reportedMessageResult.rows[0].id,
          reason: "harassment",
          description: "Signalement d'intégration.",
        }),
      }
    ));
    assert.equal(submittedReport.response.status, 201, submittedReport.data.message);

    const reportsResponse = await fetch(`${server.baseUrl}/api/admin/message-reports?status=pending`, { headers: adminHeaders });
    const reports = await reportsResponse.json();
    assert.equal(reportsResponse.status, 200);
    assert.equal(reports.length, 1);
    assert.equal(reports[0].reported_message, "Message de test à signaler");
    const reportId = reports[0].id;

    const reportDetailResponse = await fetch(`${server.baseUrl}/api/admin/message-reports/${reportId}`, { headers: adminHeaders });
    const reportDetail = await reportDetailResponse.json();
    assert.equal(reportDetailResponse.status, 200);
    assert.equal(reportDetail.messages.length, 2);
    assert.ok(reportDetail.messages.every((message) => !("attachment_path" in message)));

    const resolvedResponse = await responseJson(await fetch(
      `${server.baseUrl}/api/admin/message-reports/${reportId}/resolve`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote: "Examens des éléments signalés." }),
      }
    ));
    assert.equal(resolvedResponse.response.status, 200, resolvedResponse.data.message);
    assert.equal(resolvedResponse.data.report.reviewed_by, adminId);
    const duplicateResolution = await fetch(
      `${server.baseUrl}/api/admin/message-reports/${reportId}/resolve`,
      {
        method: "PATCH",
        headers: { ...adminHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ resolutionNote: "" }),
      }
    );
    assert.equal(duplicateResolution.status, 409);

    const profileResponse = await fetch(`${server.baseUrl}/api/auth/profile`, { headers: adminHeaders });
    assert.equal(profileResponse.status, 200, "le profil administrateur utilise l'API personnelle existante");
    const notificationsResponse = await fetch(`${server.baseUrl}/api/notifications`, { headers: adminHeaders });
    assert.equal(notificationsResponse.status, 200, "les notifications utilisent l'API personnelle existante");

    console.log("✅ Tests admin paiements, confidentialité messagerie et modération réussis.");
  } finally {
    await server.close();
  }
}

run().catch((error) => {
  console.error("❌ Échec des tests des modules administrateur :", error);
  process.exitCode = 1;
});
