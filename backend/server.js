require("dotenv").config();
const securityConfig = require("./config/security");
try {
  securityConfig.validateProductionConfig();
} catch (error) {
  console.error("Configuration de production invalide :", error.message);
  process.exit(1);
}
const { jwtSecret } = securityConfig;
const path = require("path");
const http = require("http");
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const { pool, paymentSchemaReady } = require("./db");
const { apiRateLimiter } = require("./middleware/rateLimiter");

const authRoutes = require("./routes/auth");
const propertiesRoutes = require("./routes/properties");
const notificationsRoutes = require("./routes/notifications");
const messagesRoutes = require("./routes/messages");
const adminRoutes = require("./routes/admin");
const propertyPaymentsRoutes = require("./routes/propertyPayments");
const reportsRoutes = require("./routes/reports");
const searchAlertsRoutes = require("./routes/searchAlerts");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// 1. SÉCURITÉ : Masquer la signature Express
app.disable("x-powered-by");

// 2. SÉCURITÉ : En-têtes HTTP de protection (Security Headers)
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

// 3. SÉCURITÉ : Configuration CORS contrôlée
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  process.env.FRONTEND_URL,
].filter(Boolean);

const allowOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes("*")) {
    return callback(null, true);
  }
  return callback(new Error("Origine bloquée par la politique CORS"));
};

app.use(
  cors({
    origin: allowOrigin,
    methods: ["GET", "POST", "PATCH", "PUT", "DELETE"],
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 4. SÉCURITÉ : Limiter le débit global sur les routes API
app.use("/api", apiRateLimiter);

const io = new Server(server, {
  cors: {
    origin: allowOrigin,
    methods: ["GET", "POST", "PATCH", "PUT"],
    credentials: true,
  },
});

// Authentification Socket.IO
io.use(async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error("Authentification requise."));
    }

    const decoded = jwt.verify(
      token,
      jwtSecret
    );

    const result = await pool.query(
      "SELECT id, is_active FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0 || !result.rows[0].is_active) {
      return next(new Error("Compte utilisateur introuvable ou suspendu."));
    }

    socket.userId = result.rows[0].id;
    next();
  } catch {
    next(new Error("Connexion sécurisée impossible."));
  }
});

const onlineUsers = new Map();

io.on("connection", (socket) => {
  const userId = String(socket.userId);

  onlineUsers.set(
    userId,
    (onlineUsers.get(userId) || 0) + 1
  );

  socket.join(`user:${socket.userId}`);
  console.log(`🔔 Utilisateur ${socket.userId} connecté (Socket: ${socket.id}).`);

  socket.emit("users:online", Array.from(onlineUsers.keys()));

  io.emit("user:status", {
    userId,
    online: true,
  });

  socket.on("join:conversation", async (conversationId) => {
    const parsedId = Number(conversationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;

    try {
      const conversation = await pool.query(
        `SELECT c.id, c.buyer_id, c.property_id
         FROM conversations c
         WHERE c.id = $1
           AND (c.buyer_id = $2 OR c.seller_id = $2)`,
        [parsedId, socket.userId]
      );

      const membership = conversation.rows[0];
      let canJoin = Boolean(membership);

      if (membership && String(membership.buyer_id) === String(socket.userId)) {
        const payment = await pool.query(
          `SELECT id
           FROM messaging_payments
           WHERE property_id = $1 AND client_id = $2 AND status = 'paid'
           LIMIT 1`,
          [membership.property_id, membership.buyer_id]
        );
        canJoin = payment.rows.length > 0;
      }

      if (canJoin) {
        socket.join(`conversation:${parsedId}`);
      }
    } catch (error) {
      console.error("Erreur accès salle de messagerie :", error.message);
    }
  });

  socket.on("leave:conversation", (conversationId) => {
    const parsedId = Number(conversationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) return;
    const room = `conversation:${parsedId}`;
    if (socket.rooms.has(room)) {
      socket.to(room).emit("conversation:typing", {
        conversationId: parsedId,
        userId: socket.userId,
        typing: false,
      });
      socket.leave(room);
    }
  });

  socket.on("conversation:typing", (payload = {}) => {
    if (!payload || typeof payload !== "object") return;
    const { conversationId, typing } = payload;
    const parsedId = Number(conversationId);
    if (!Number.isInteger(parsedId) || parsedId <= 0 || typeof typing !== "boolean") return;
    const room = `conversation:${parsedId}`;
    if (!socket.rooms.has(room)) return;
    socket.to(room).emit("conversation:typing", {
      conversationId: parsedId,
      userId: socket.userId,
      typing,
    });
  });

  socket.on("disconnect", () => {
    const connections = onlineUsers.get(userId) || 0;

    if (connections <= 1) {
      onlineUsers.delete(userId);

      io.emit("user:status", {
        userId,
        online: false,
      });
    } else {
      onlineUsers.set(userId, connections - 1);
    }

    console.log(`Utilisateur ${socket.userId} déconnecté.`);
  });
});

app.set("io", io);

// Servir les images statiques depuis /uploads avec politique de cache (1 jour)
app.use(
  "/uploads",
  express.static(path.join(__dirname, "uploads"), {
    maxAge: "1d",
    etag: true,
    lastModified: true,
  })
);

// Routes API sécurisées
app.use("/api/auth", authRoutes);
app.use("/api/properties", propertiesRoutes);
app.use("/api/search-alerts", searchAlertsRoutes);
app.use("/api/property-payments", propertyPaymentsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/notifications", notificationsRoutes);
app.use("/api/messages", messagesRoutes);
app.use("/api/visits", require("./routes/visits"));
app.use("/api/favorites", require("./routes/favorites"));
app.use("/api/dashboard", require("./routes/dashboard"));
app.use("/api/admin", adminRoutes);

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", service: "immo229-backend", timestamp: new Date() });
});

// Gestionnaire d'erreurs global sécurisé (ne divulgue aucune trace technique)
app.use((err, req, res, next) => {
  console.error("Erreur serveur sécurisée :", err.message);

  if (err.message && err.message.includes("CORS")) {
    return res.status(403).json({ message: "Accès refusé par la politique de sécurité CORS." });
  }

  res.status(err.status || 400).json({
    message: err.message || "Une erreur est survenue lors du traitement de votre demande.",
  });
});

function startServer({ port = PORT, host = process.env.HOST || "0.0.0.0" } = {}) {
  return paymentSchemaReady.then(() => new Promise((resolve, reject) => {
    const handleError = (error) => {
      server.off("listening", handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off("error", handleError);
      const address = server.address();
      const displayAddress = typeof address === "object" && address
        ? `${host}:${address.port}`
        : `${host}:${port}`;
      console.log(`🚀 Serveur Immo229 sécurisé démarré sur http://${displayAddress}`);
      resolve(server);
    };

    server.once("error", handleError);
    server.once("listening", handleListening);
    server.listen(port, host);
  }));
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error("Démarrage du serveur impossible :", error.message);
    process.exitCode = 1;
  });
}

module.exports = { app, io, server, startServer };
