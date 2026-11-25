require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const propertiesRouter = require('./routes/properties');
const authRouter = require('./routes/auth');
const prisma = require('./db');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// Validate JWT secret in production
function validateJwtSecret() {
  const secret = process.env.JWT_SECRET;
  const placeholderValues = ['your_jwt_secret', 'changeme', 'default', 'example'];
  if (!secret) {
    console.error('❌ JWT_SECRET is not defined.');
    process.exit(1);
  }
  if (secret.length < 32) {
    console.error('❌ JWT_SECRET is too short (minimum 32 characters).');
    process.exit(1);
  }
  if (placeholderValues.includes(secret.toLowerCase())) {
    console.error('❌ JWT_SECRET contains a placeholder value.');
    process.exit(1);
  }
}
if (process.env.NODE_ENV === 'production') {
  validateJwtSecret();
}

// ─── Middlewares Express ───────────────────────────────────────────────────────
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(helmet());
app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
}));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// ─── Routes API REST ──────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/properties', propertiesRouter);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/visits', require('./routes/visits'));
app.use('/api/favorites', require('./routes/favorites'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Healthcheck
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'immo229-backend', timestamp: new Date() });
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST', 'PATCH'],
    credentials: true,
  },
});

// Middleware d'authentification Socket.IO via JWT
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentification requise'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.userId = Number(decoded.id);

    if (!Number.isInteger(socket.userId) || socket.userId <= 0) {
      return next(new Error('Utilisateur invalide'));
    }

    next();
  } catch {
    next(new Error('Token invalide ou expiré'));
  }
});

// Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  // Chaque utilisateur rejoint sa salle privée
  const userRoom = `user:${socket.userId}`;
  socket.join(userRoom);
  console.log(`🟢 Utilisateur ${socket.userId} connecté (socket: ${socket.id})`);

  // ── Envoyer un message en temps réel ────────────────────────────────────────
  socket.on('message:send', async (payload, callback) => {
    try {
      const receiverId = Number(payload?.receiver_id);
      const content = typeof payload?.content === 'string' ? payload.content.trim() : '';
      const propertyId = payload?.property_id ? Number(payload.property_id) : null;

      // Validations
      if (!Number.isInteger(receiverId) || receiverId <= 0 || receiverId === socket.userId) {
        return callback?.({ ok: false, message: 'Destinataire invalide' });
      }
      if (!content || content.length > 5000) {
        return callback?.({ ok: false, message: 'Message vide ou trop long (max 5000 car.)' });
      }

      // Vérifier que le destinataire existe
      const receiver = await prisma.user.findUnique({ where: { id: receiverId }, select: { id: true, nom: true } });
      if (!receiver) {
        return callback?.({ ok: false, message: 'Destinataire introuvable' });
      }

      // Vérifier que le bien existe si fourni
      if (propertyId !== null) {
        const bien = await prisma.bien.findUnique({ where: { id: propertyId }, select: { id: true } });
        if (!bien) {
          return callback?.({ ok: false, message: 'Bien immobilier introuvable' });
        }
      }

      // Sauvegarder en base via Prisma
      const message = await prisma.message.create({
        data: {
          senderId: socket.userId,
          receiverId,
          propertyId: propertyId || null,
          content,
        },
        include: {
          sender: { select: { id: true, nom: true } },
          receiver: { select: { id: true, nom: true } },
        },
      });

      // Formater pour le frontend
      const formatted = {
        id: message.id,
        sender_id: message.senderId,
        receiver_id: message.receiverId,
        property_id: message.propertyId,
        content: message.content,
        is_read: message.isRead,
        created_at: message.createdAt,
        sender_name: message.sender.nom,
        receiver_name: message.receiver.nom,
      };

      // Diffuser en temps réel aux deux participants
      io.to(`user:${socket.userId}`)
        .to(`user:${receiverId}`)
        .emit('message:new', formatted);

      // Notification (sans bloquer)
      const { createNotification } = require('./utils/notifications');
      createNotification(
        receiverId,
        '💬 Nouveau message',
        `Vous avez reçu un nouveau message de ${message.sender.nom}.`,
        'message',
        message.id
      ).catch(() => {});

      callback?.({ ok: true, message: formatted });

    } catch (error) {
      console.error('❌ Socket message:send error:', error);
      callback?.({ ok: false, message: "Impossible d'envoyer le message" });
    }
  });

  // ── Indicateur "en train d'écrire" ──────────────────────────────────────────
  socket.on('typing:start', ({ receiver_id }) => {
    const rid = Number(receiver_id);
    if (Number.isInteger(rid) && rid > 0) {
      socket.to(`user:${rid}`).emit('typing:start', { sender_id: socket.userId });
    }
  });

  socket.on('typing:stop', ({ receiver_id }) => {
    const rid = Number(receiver_id);
    if (Number.isInteger(rid) && rid > 0) {
      socket.to(`user:${rid}`).emit('typing:stop', { sender_id: socket.userId });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔴 Utilisateur ${socket.userId} déconnecté`);
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`🚀 Serveur Backend Immo229 démarré sur http://localhost:${PORT}`);
});
