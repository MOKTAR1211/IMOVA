require("dotenv").config();
const bcrypt = require("bcrypt");
const { Pool: PgPool } = require("pg");
const { newDb } = require("pg-mem");
const { isProduction } = require("./config/security");

const useTestMemoryDatabase = process.env.IMOVA_TEST_DB === "memory";
if (useTestMemoryDatabase && isProduction) {
  throw new Error("La base mémoire isolée ne peut pas être utilisée en production.");
}

let memPool = null;
const seededPasswordHash = bcrypt.hashSync("test229", 10);

async function ensureDemoData(poolInstance) {
  if (isProduction) return;

  try {
    const demoUsers = [
      {
        email: "moktar@test.com",
        nom: "Moktar",
        first_name: "Moktar",
        last_name: "Kone",
        role: "proprietaire",
      },
      {
        email: "jean@test.com",
        nom: "Jean Acheteur",
        first_name: "Jean",
        last_name: "Acheteur",
        role: "client",
      },
      {
        email: "admin@immo229.bj",
        nom: "Administrateur Immo229",
        first_name: "Admin",
        last_name: "Immo229",
        role: "admin",
      },
    ];

    for (const user of demoUsers) {
      const existing = await poolInstance.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER($1)",
        [user.email]
      );

      await poolInstance.query(
        `INSERT INTO users (nom, first_name, last_name, email, password, role)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (email) DO UPDATE SET
           nom = EXCLUDED.nom,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           password = EXCLUDED.password,
           role = EXCLUDED.role`,
        [user.nom, user.first_name, user.last_name, user.email, seededPasswordHash, user.role]
      );
    }

    const cleanupResult = await poolInstance.query(
      `DELETE FROM properties AS p
       USING users AS u
       WHERE p.proprietaire_id = u.id
         AND LOWER(u.email) = LOWER($1)
         AND (
           (p.titre = $2 AND p.description = $3 AND p.prix = $4
            AND p.ville = $5 AND p.quartier = $6 AND p.type = $7
            AND p.image_url = $8)
           OR
           (p.titre = $9 AND p.description = $10 AND p.prix = $11
            AND p.ville = $12 AND p.quartier = $13 AND p.type = $14
            AND p.image_url = $15)
           OR
           (p.titre = $16 AND p.description = $17 AND p.prix = $18
            AND p.ville = $19 AND p.quartier = $20 AND p.type = $21
            AND p.image_url = $22)
         )
       RETURNING p.id`,
      [
        "moktar@test.com",
        "Appartement moderne",
        "Bel appartement moderne situé dans une zone calme de Tankpè.",
        100000,
        "Calavi",
        "Tankpè",
        "Appartement",
        "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80",
        "Maison familiale",
        "Belle maison familiale avec cour et garage.",
        25000000,
        "Cotonou",
        "Akpakpa",
        "Maison",
        "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        "Terrain constructible",
        "Terrain destiné à la construction dans une zone en fort développement.",
        8500000,
        "Abomey-Calavi",
        "Arconville",
        "Terrain",
        "https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80",
      ]
    );

    if (cleanupResult.rowCount > 0) {
      console.info(`Removed ${cleanupResult.rowCount} seeded demo properties.`);
    }
  } catch (error) {
    console.error("Demo data cleanup failed:", error.message);
    throw error;
  }
}

function getMemPool() {
  if (isProduction) {
    throw new Error("Le fallback en mémoire est désactivé en production.");
  }

  if (!memPool) {
    const db = newDb();
    db.public.none(
      `
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        nom VARCHAR(100),
        first_name VARCHAR(100),
        last_name VARCHAR(100),
        email VARCHAR(150) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        phone VARCHAR(50),
        address TEXT,
        profile_photo VARCHAR(500),
        role VARCHAR(20) DEFAULT 'client',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        email_verified BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS email_verification_codes (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        code_hash VARCHAR(64) NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        token_hash VARCHAR(64) NOT NULL UNIQUE,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS properties (
        id SERIAL PRIMARY KEY,
        titre VARCHAR(200) NOT NULL,
        description TEXT,
        prix NUMERIC(12, 2) NOT NULL,
        ville VARCHAR(100) NOT NULL,
        quartier VARCHAR(100),
        type VARCHAR(50) NOT NULL,
        transaction_type VARCHAR(20),
        chambres INTEGER DEFAULT 0,
        douches INTEGER DEFAULT 0,
        image_url TEXT,
        proprietaire_id INTEGER REFERENCES users(id),
        status VARCHAR(20) NOT NULL DEFAULT 'disponible'
          CHECK (status IN ('disponible', 'loue', 'vendu', 'en_attente', 'rejete')),
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        publication_payment_status VARCHAR(20) NOT NULL DEFAULT 'not_required',
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS property_images (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        image_url TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS property_payments (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_transaction_id VARCHAR(100) NOT NULL UNIQUE,
        payment_method VARCHAR(32),
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messaging_payments (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider_transaction_id VARCHAR(100) NOT NULL UNIQUE,
        payment_method VARCHAR(32),
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (property_id, client_id)
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        title VARCHAR(150) NOT NULL,
        message TEXT NOT NULL,
        link VARCHAR(255),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS search_alerts (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        city VARCHAR(100),
        type VARCHAR(50),
        min_price NUMERIC(12, 2),
        max_price NUMERIC(12, 2),
        min_bedrooms INTEGER,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) ON DELETE SET NULL,
        buyer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        seller_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        buyer_archived BOOLEAN NOT NULL DEFAULT FALSE,
        seller_archived BOOLEAN NOT NULL DEFAULT FALSE,
        owner_archived BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        content TEXT NOT NULL,
        attachment_path TEXT,
        attachment_name VARCHAR(255),
        attachment_mime VARCHAR(100),
        is_read BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS conversation_message_reports (
        id SERIAL PRIMARY KEY,
        conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
        message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(40) NOT NULL,
        description TEXT,
        status VARCHAR(20) NOT NULL DEFAULT 'pending',
        reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
        resolution_note TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        reviewed_at TIMESTAMP,
        UNIQUE (reporter_id, message_id)
      );

      CREATE TABLE IF NOT EXISTS visits (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
        user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        visit_date VARCHAR(50),
        visit_time VARCHAR(50),
        message TEXT,
        status VARCHAR(50) DEFAULT 'en_attente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS property_views (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        viewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        viewed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS favorites (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE (user_id, property_id)
      );

      CREATE INDEX IF NOT EXISTS idx_property_views_property_date
      ON property_views(property_id, viewed_at);

      CREATE TABLE IF NOT EXISTS reports (
        id SERIAL PRIMARY KEY,
        property_id INTEGER REFERENCES properties(id) ON DELETE CASCADE,
        reporter_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
        reason VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'en_attente',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      INSERT INTO users (nom, first_name, last_name, email, password, role)
      VALUES 
      ('Moktar', 'Moktar', 'Kone', 'moktar@test.com', '${seededPasswordHash}', 'proprietaire'),
      ('Jean Acheteur', 'Jean', 'Acheteur', 'jean@test.com', '${seededPasswordHash}', 'client'),
      ('Administrateur Immo229', 'Admin', 'Immo229', 'admin@immo229.bj', '${seededPasswordHash}', 'admin')
      ON CONFLICT DO NOTHING;

    `);
    const adapter = db.adapters.createPg();
    memPool = new adapter.Pool();
  }
  return memPool;
}

const realPool = new PgPool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "immo229",
  password: process.env.DB_PASSWORD || "postgres",
  port: parseInt(process.env.DB_PORT || "5432", 10),
  connectionTimeoutMillis: 1500,
});

const paymentSchemaReady = useTestMemoryDatabase
  ? Promise.resolve()
  : realPool.query("SELECT 1").then(() => {
  return realPool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE`
  ).then(() => realPool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE`
  )).then(() => realPool.query(
    `ALTER TABLE users
     ADD COLUMN IF NOT EXISTS email_verified BOOLEAN NOT NULL DEFAULT TRUE`
  )).then(() => realPool.query(
    `CREATE TABLE IF NOT EXISTS email_verification_codes (
       user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       code_hash VARCHAR(64) NOT NULL,
       expires_at TIMESTAMP NOT NULL,
       attempts INTEGER NOT NULL DEFAULT 0,
       created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
     )`
  )).then(() => realPool.query(
    `CREATE TABLE IF NOT EXISTS password_reset_tokens (
       user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
       token_hash VARCHAR(64) NOT NULL UNIQUE,
       expires_at TIMESTAMP NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`
  )).then(() => realPool.query(
    `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS publication_payment_status VARCHAR(20) NOT NULL DEFAULT 'not_required'`
  )).then(() => realPool.query(
    `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS is_verified BOOLEAN NOT NULL DEFAULT FALSE`
  )).then(() => realPool.query(
    `ALTER TABLE properties
     ADD COLUMN IF NOT EXISTS transaction_type VARCHAR(20)`
  )).then(() => realPool.query(
    `ALTER TABLE messages
     ADD COLUMN IF NOT EXISTS attachment_path TEXT,
     ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255),
     ADD COLUMN IF NOT EXISTS attachment_mime VARCHAR(100)`
  )).then(() => realPool.query(
    `CREATE TABLE IF NOT EXISTS search_alerts (
       id SERIAL PRIMARY KEY,
       user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       city VARCHAR(100),
       type VARCHAR(50),
       min_price NUMERIC(12, 2),
       max_price NUMERIC(12, 2),
       min_bedrooms INTEGER,
       is_active BOOLEAN NOT NULL DEFAULT TRUE,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
     )`
  )).then(() => {
    return realPool.query(
      `CREATE TABLE IF NOT EXISTS property_payments (
         id SERIAL PRIMARY KEY,
         property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
         owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         provider_transaction_id VARCHAR(100) NOT NULL UNIQUE,
         payment_method VARCHAR(32),
         amount INTEGER NOT NULL,
         currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
         status VARCHAR(20) NOT NULL DEFAULT 'pending',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
       )`
    ).then(() => realPool.query(
      `CREATE TABLE IF NOT EXISTS messaging_payments (
         id SERIAL PRIMARY KEY,
         property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
         client_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         provider_transaction_id VARCHAR(100) NOT NULL UNIQUE,
         payment_method VARCHAR(32),
         amount INTEGER NOT NULL,
         currency VARCHAR(3) NOT NULL DEFAULT 'XOF',
         status VARCHAR(20) NOT NULL DEFAULT 'pending',
         created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
         UNIQUE (property_id, client_id)
       )`
    )).then(() => realPool.query(
      `ALTER TABLE property_payments
       ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32)`
    )).then(() => realPool.query(
      `ALTER TABLE messaging_payments
       ADD COLUMN IF NOT EXISTS payment_method VARCHAR(32)`
    )).then(() => realPool.query(
      `CREATE TABLE IF NOT EXISTS conversation_message_reports (
         id SERIAL PRIMARY KEY,
         conversation_id INTEGER NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
         message_id INTEGER NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
         reporter_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
         reason VARCHAR(40) NOT NULL,
         description TEXT,
         status VARCHAR(20) NOT NULL DEFAULT 'pending',
         reviewed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
         resolution_note TEXT,
         created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
         reviewed_at TIMESTAMP,
         UNIQUE (reporter_id, message_id)
       )`
    ));
  });
}).then(async () => {
  await ensureDemoData(realPool);
  await realPool.query(
    `SELECT setval(
       pg_get_serial_sequence('properties', 'id'),
       COALESCE(MAX(id), 1),
       COUNT(*) > 0
     )
     FROM properties`
  );
}).catch((error) => {
  if (isProduction) {
    throw error;
  }

  const connectionUnavailable =
    error?.code === "ECONNREFUSED"
    || error?.code === "ETIMEDOUT"
    || error?.code === "28P01"
    || String(error?.message || "").toLowerCase().includes("could not connect")
    || String(error?.message || "").toLowerCase().includes("timed out")
    || String(error?.message || "").toLowerCase().includes("password authentication failed")
    || String(error?.message || "").toLowerCase().includes("connection terminated")
    || String(error?.message || "").toLowerCase().includes("connection lost");

  if (!connectionUnavailable) {
    console.error("Payment schema initialization failed:", error.message);
    throw error;
  }
});

class SmartPool {
  async query(text, params) {
    if (useTestMemoryDatabase) {
      return getMemPool().query(text, params);
    }

    try {
      return await realPool.query(text, params);
    } catch (err) {
      const message = String(err?.message || "").toLowerCase();
      const shouldFallback =
        err?.code === "ECONNREFUSED" ||
        err?.code === "ETIMEDOUT" ||
        err?.code === "28P01" ||
        message.includes("econnrefused") ||
        message.includes("timed out") ||
        message.includes("timeout") ||
        message.includes("password authentication failed") ||
        message.includes("could not connect") ||
        message.includes("connection terminated") ||
        message.includes("connection lost");

      if (shouldFallback) {
        if (isProduction) {
          throw new Error("La base de données de production est indisponible.");
        }
        return await getMemPool().query(text, params);
      }
      throw err;
    }
  }

  async end() {
    if (memPool) await memPool.end();
    if (!useTestMemoryDatabase) await realPool.end();
  }
}

const pool = new SmartPool();

module.exports = { pool, Pool: SmartPool, paymentSchemaReady };
