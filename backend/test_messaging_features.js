const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const { io: createSocket } = require("socket.io-client");
const { startIsolatedTestServer } = require("./testUtils/isolatedServer");

const backendDir = __dirname;
const privateUploadDir = path.resolve(backendDir, "private-uploads");

const fixture = { userIds: [], propertyId: null, conversationId: null };
const sockets = [];
let failures = 0;
let BASE_URL = "";
let db;
let testServer;
let dbConnected = false;

function check(label, passed, detail = "") {
  console.log(`${passed ? "✅ [PASS]" : "❌ [FAIL]"} ${label}${detail ? ` — ${detail}` : ""}`);
  if (!passed) failures += 1;
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function login(email, password) {
  const response = await fetch(`${BASE_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json();
  if (!response.ok || !data.token) {
    throw new Error(`Connexion au compte de test impossible (HTTP ${response.status}).`);
  }
  return data.token;
}

function connectSocket(token) {
  return new Promise((resolve, reject) => {
    const socket = createSocket(BASE_URL, {
      auth: { token },
      transports: ["websocket"],
      reconnection: false,
      timeout: 5000,
    });
    sockets.push(socket);
    const timer = setTimeout(() => reject(new Error("Délai de connexion Socket.IO dépassé.")), 6000);
    socket.once("connect", () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once("connect_error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

async function run() {
  testServer = await startIsolatedTestServer();
  db = testServer.pool;
  BASE_URL = testServer.baseUrl;
  await db.query("SELECT 1");
  dbConnected = true;
  console.log("Base de test isolée : pg-mem (aucune connexion à PostgreSQL/.env).");

  const suffix = crypto.randomUUID();
  const password = "TestMessagePass123!";
  const passwordHash = await bcrypt.hash(password, 10);
  const accounts = [
    { email: `message_owner_${suffix}@example.test`, role: "proprietaire", name: "Test Owner" },
    { email: `message_client_${suffix}@example.test`, role: "client", name: "Test Client" },
    { email: `message_outsider_${suffix}@example.test`, role: "client", name: "Test Outsider" },
  ];

  for (const account of accounts) {
    const result = await db.query(
      `INSERT INTO users (nom, first_name, last_name, email, password, role)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        account.name,
        account.name.split(" ")[0],
        account.name.split(" ")[1],
        account.email,
        passwordHash,
        account.role,
      ]
    );
    fixture.userIds.push(result.rows[0].id);
  }

  const [ownerId, clientId] = fixture.userIds;
  const propertyResult = await db.query(
    `INSERT INTO properties (titre, prix, ville, type, proprietaire_id, status)
     VALUES ('Messagerie test', 100000, 'Cotonou', 'Appartement', $1, 'disponible')
     RETURNING id`,
    [ownerId]
  );
  fixture.propertyId = propertyResult.rows[0].id;

  const conversationResult = await db.query(
    `INSERT INTO conversations (property_id, buyer_id, seller_id)
     VALUES ($1, $2, $3)
     RETURNING id`,
    [fixture.propertyId, clientId, ownerId]
  );
  fixture.conversationId = conversationResult.rows[0].id;

  await db.query(
    `INSERT INTO messaging_payments
       (property_id, client_id, provider_transaction_id, amount, currency, status)
     VALUES ($1, $2, $3, 500, 'XOF', 'paid')`,
    [fixture.propertyId, clientId, `test_${suffix}`]
  );

  const [ownerToken, clientToken, outsiderToken] = await Promise.all(
    accounts.map((account) => login(account.email, password))
  );

  const [clientConversationsResponse, ownerConversationsResponse] = await Promise.all([
    fetch(`${BASE_URL}/api/messages/conversations`, {
      headers: { Authorization: "Bearer " + clientToken },
    }),
    fetch(`${BASE_URL}/api/messages/conversations`, {
      headers: { Authorization: "Bearer " + ownerToken },
    }),
  ]);
  const [clientConversations, ownerConversations] = await Promise.all([
    clientConversationsResponse.json(),
    ownerConversationsResponse.json(),
  ]);
  check(
    "Liste des conversations chargée pour le client",
    clientConversationsResponse.status === 200
      && Array.isArray(clientConversations)
      && clientConversations.some((conversation) => String(conversation.id) === String(fixture.conversationId)),
    `HTTP ${clientConversationsResponse.status}`
  );
  check(
    "Liste des conversations chargée pour le propriétaire",
    ownerConversationsResponse.status === 200
      && Array.isArray(ownerConversations)
      && ownerConversations.some((conversation) => String(conversation.id) === String(fixture.conversationId)),
    `HTTP ${ownerConversationsResponse.status}`
  );

  const ownerSocket = await connectSocket(ownerToken);
  const clientSocket = await connectSocket(clientToken);
  const outsiderSocket = await connectSocket(outsiderToken);
  ownerSocket.emit("join:conversation", fixture.conversationId);
  clientSocket.emit("join:conversation", fixture.conversationId);
  outsiderSocket.emit("join:conversation", fixture.conversationId);
  await wait(300);

  const typingReceived = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2000);
    clientSocket.once("conversation:typing", (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
  ownerSocket.emit("conversation:typing", {
    conversationId: fixture.conversationId,
    typing: true,
  });
  const typingEvent = await typingReceived;
  check(
    "Indicateur de saisie transmis aux participants",
    typingEvent?.typing === true && String(typingEvent.userId) === String(ownerId)
  );

  const outsiderTyping = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 500);
    outsiderSocket.once("conversation:typing", (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
  ownerSocket.emit("conversation:typing", {
    conversationId: fixture.conversationId,
    typing: true,
  });
  check("Indicateur de saisie non divulgué à un tiers", await outsiderTyping === null);

  const png = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/Jx8AAAAASUVORK5CYII=",
    "base64"
  );
  const formData = new FormData();
  formData.append("content", "Photo de test");
  formData.append("attachment", new Blob([png], { type: "image/png" }), "photo.png");

  const realtimeMessage = new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), 2500);
    ownerSocket.once("message:new", (event) => {
      clearTimeout(timer);
      resolve(event);
    });
  });
  const sendResponse = await fetch(
    `${BASE_URL}/api/messages/conversations/${fixture.conversationId}/messages`,
    { method: "POST", headers: { Authorization: `Bearer ${clientToken}` }, body: formData }
  );
  const sentMessage = await sendResponse.json();
  check(
    "Envoi d’un message avec une image",
    sendResponse.status === 201
      && sentMessage.content === "Photo de test"
      && Boolean(sentMessage.attachmentUrl),
    `HTTP ${sendResponse.status}`
  );
  check(
    "Message et image diffusés en temps réel",
    (await realtimeMessage)?.attachmentUrl === sentMessage.attachmentUrl
  );

  const imageResponse = await fetch(`${BASE_URL}${sentMessage.attachmentUrl}`, {
    headers: { Authorization: `Bearer ${clientToken}` },
  });
  const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
  check(
    "Image récupérable par le participant autorisé",
    imageResponse.status === 200
      && imageResponse.headers.get("content-type").includes("image/png")
      && imageBytes.equals(png)
  );

  const outsiderImage = await fetch(`${BASE_URL}${sentMessage.attachmentUrl}`, {
    headers: { Authorization: `Bearer ${outsiderToken}` },
  });
  check("Image inaccessible à un tiers", outsiderImage.status === 403);

  const unauthenticatedImage = await fetch(`${BASE_URL}${sentMessage.attachmentUrl}`);
  check("Image inaccessible sans connexion", unauthenticatedImage.status === 401);

  const textMessage = await fetch(
    `${BASE_URL}/api/messages/conversations/${fixture.conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clientToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "Message texte de compatibilité" }),
    }
  );
  const textMessageData = await textMessage.json();
  check(
    "Envoi de texte seul reste compatible",
    textMessage.status === 201
      && textMessageData.content === "Message texte de compatibilité"
      && !textMessageData.attachmentUrl
  );

  const invalidImage = new FormData();
  invalidImage.append("attachment", new Blob(["not an image"], { type: "image/png" }), "fake.png");
  const invalidResponse = await fetch(
    `${BASE_URL}/api/messages/conversations/${fixture.conversationId}/messages`,
    { method: "POST", headers: { Authorization: `Bearer ${clientToken}` }, body: invalidImage }
  );
  check("Signature réelle de l’image vérifiée", invalidResponse.status === 400);

  const outsiderMessage = await fetch(
    `${BASE_URL}/api/messages/conversations/${fixture.conversationId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${outsiderToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: "Message non autorisé" }),
    }
  );
  check("Envoi refusé à un utilisateur hors conversation", outsiderMessage.status === 403);

}

async function cleanup() {
  sockets.forEach((socket) => socket.disconnect());
  if (dbConnected) {
    try {
      if (fixture.conversationId) {
        const attachments = await db.query(
          "SELECT attachment_path FROM messages WHERE conversation_id = $1 AND attachment_path IS NOT NULL",
          [fixture.conversationId]
        );
        for (const row of attachments.rows) {
          const filePath = path.resolve(privateUploadDir, row.attachment_path);
          if (filePath.startsWith(`${privateUploadDir}${path.sep}`)) {
            await fs.promises.unlink(filePath).catch((error) => {
              if (error.code !== "ENOENT") throw error;
            });
          }
        }
        await db.query("DELETE FROM conversations WHERE id = $1", [fixture.conversationId]);
      }
      if (fixture.propertyId) {
        await db.query("DELETE FROM properties WHERE id = $1", [fixture.propertyId]);
      }
      if (fixture.userIds.length) {
        await db.query("DELETE FROM users WHERE id = ANY($1::int[])", [fixture.userIds]);
      }
    } catch (error) {
      console.error("Erreur nettoyage test de messagerie :", error);
      failures += 1;
    }
    dbConnected = false;
  }

  if (testServer) await testServer.close();
}

run()
  .catch((error) => {
    console.error("Erreur test de messagerie :", error);
    failures += 1;
  })
  .finally(() => cleanup()
    .catch((error) => {
      console.error("Erreur arrêt du test de messagerie :", error);
      failures += 1;
    })
    .finally(() => {
      console.log(`Bilan test messagerie : ${failures === 0 ? "réussi" : `${failures} échec(s)`}`);
      if (failures) process.exitCode = 1;
    }));
