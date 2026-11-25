const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { jwtSecret } = require("../config/security");

const router = express.Router();

const { pool } = require("../db");
const uploadProfile = require("../middleware/uploadProfile");
const authMiddleware = require("../middleware/auth");

const { authRateLimiter } = require("../middleware/rateLimiter");

const {
  getTestVerificationCode,
  isSmtpConfigured,
  sendVerificationCodeEmail,
  transporter: resetEmailTransporter,
} = require("../utils/email");

const passwordResetMessage =
  "Si un compte correspond à cette adresse, un e-mail de réinitialisation va être envoyé.";
const verificationMessage =
  "Un code de confirmation a été envoyé à votre adresse e-mail.";
const testEmailVerification = process.env.IMOVA_TEST_DB === "memory";

function hashVerificationCode(code) {
  return crypto.createHmac("sha256", jwtSecret).update(code).digest("hex");
}

async function createEmailVerificationCode(userId, email) {
  const code = String(crypto.randomInt(100000, 1000000));
  const codeHash = hashVerificationCode(code);

  await pool.query(
    `INSERT INTO email_verification_codes (user_id, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '10 minutes', 0, CURRENT_TIMESTAMP)
     ON CONFLICT (user_id) DO UPDATE
     SET code_hash = EXCLUDED.code_hash,
         expires_at = EXCLUDED.expires_at,
         attempts = 0,
         created_at = CURRENT_TIMESTAMP`,
    [userId, codeHash]
  );

  try {
    await sendVerificationCodeEmail(email, code);
  } catch (error) {
    console.error("Échec d'envoi du code de confirmation :", error.message);
    await pool.query(
      "DELETE FROM email_verification_codes WHERE user_id = $1 AND code_hash = $2",
      [userId, codeHash]
    );
    throw error;
  }

  return testEmailVerification ? getTestVerificationCode(email) : undefined;
}

// Inscription sécurisée
router.post("/register", authRateLimiter, async (req, res) => {
  try {
    const { nom, email, password, role } = req.body;

    // 1. Validation de la présence des champs
    if (!nom?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Validation du format d'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        message: "Format d'adresse e-mail invalide.",
      });
    }

    // 3. Validation de la longueur du mot de passe (min 6 caractères)
    if (password.length < 6) {
      return res.status(400).json({
        message: "Le mot de passe doit contenir au moins 6 caractères.",
      });
    }

    if (!isSmtpConfigured && !testEmailVerification) {
      return res.status(503).json({
        message: "La confirmation par e-mail n'est pas configurée. Réessayez plus tard.",
      });
    }

    // 4. Protection contre l'élévation de privilèges : seuls 'client' et 'proprietaire' sont autorisés
    // Le rôle 'admin' ne peut JAMAIS être auto-attribué via l'inscription publique
    const allowedRoles = ["client", "proprietaire"];
    const assignedRole = allowedRoles.includes(role) ? role : "client";

    // 5. Vérifier si l'email existe déjà
    const existingUser = await pool.query(
      "SELECT id FROM users WHERE LOWER(email) = $1",
      [cleanEmail]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        message: "Cette adresse e-mail est déjà utilisée.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
      (nom, email, password, role, email_verified)
      VALUES ($1, $2, $3, $4, FALSE)
      RETURNING id, nom, email, role`,
      [
        nom.trim(),
        cleanEmail,
        hashedPassword,
        assignedRole,
      ]
    );

    try {
      const testCode = await createEmailVerificationCode(result.rows[0].id, cleanEmail);
      return res.status(201).json({
        message: verificationMessage,
        user: result.rows[0],
        ...(testEmailVerification ? { testVerificationCode: testCode } : {}),
      });
    } catch {
      return res.status(503).json({
        message: "Le compte a été créé, mais l'e-mail de confirmation n'a pas pu être envoyé. Utilisez le renvoi du code.",
        email: cleanEmail,
        code: "EMAIL_SEND_FAILED",
      });
    }

  } catch (error) {
    console.error("Erreur register:", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Cette adresse e-mail est déjà utilisée.",
      });
    }

    res.status(500).json({
      message: "Erreur serveur lors de l'inscription.",
    });
  }
});

router.post("/verify-email", authRateLimiter, async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  const code = typeof req.body.code === "string" ? req.body.code.trim() : "";

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(code)) {
    return res.status(400).json({ message: "Saisissez une adresse e-mail et un code à 6 chiffres valides." });
  }

  try {
    const result = await pool.query(
      `SELECT c.user_id, c.code_hash, c.expires_at, c.attempts, u.email_verified
       FROM email_verification_codes c
       JOIN users u ON u.id = c.user_id
       WHERE LOWER(u.email) = $1`,
      [email]
    );
    const verification = result.rows[0];

    if (!verification || verification.email_verified || new Date(verification.expires_at) <= new Date()) {
      return res.status(400).json({ message: "Ce code est invalide ou expiré. Demandez un nouveau code." });
    }
    if (verification.attempts >= 5) {
      return res.status(429).json({ message: "Trop de codes incorrects. Demandez un nouveau code." });
    }

    const submittedHash = Buffer.from(hashVerificationCode(code), "hex");
    const expectedHash = Buffer.from(verification.code_hash, "hex");
    if (
      submittedHash.length !== expectedHash.length
      || !crypto.timingSafeEqual(submittedHash, expectedHash)
    ) {
      await pool.query(
        `UPDATE email_verification_codes
         SET attempts = attempts + 1
         WHERE user_id = $1 AND attempts < 5`,
        [verification.user_id]
      );
      return res.status(400).json({ message: "Le code saisi est incorrect." });
    }

    const consumed = await pool.query(
      `DELETE FROM email_verification_codes
       WHERE user_id = $1 AND code_hash = $2
         AND expires_at > CURRENT_TIMESTAMP AND attempts < 5
       RETURNING user_id`,
      [verification.user_id, verification.code_hash]
    );
    if (consumed.rows.length === 0) {
      return res.status(400).json({ message: "Ce code est invalide ou expiré. Demandez un nouveau code." });
    }

    await pool.query(
      "UPDATE users SET email_verified = TRUE WHERE id = $1",
      [verification.user_id]
    );
    return res.json({ message: "Adresse e-mail confirmée. Vous pouvez maintenant vous connecter." });
  } catch (error) {
    console.error("Erreur confirmation e-mail :", error);
    return res.status(500).json({ message: "Impossible de confirmer l'adresse e-mail pour le moment." });
  }
});

router.post("/resend-verification-code", authRateLimiter, async (req, res) => {
  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Saisissez une adresse e-mail valide." });
  }
  if (!isSmtpConfigured && !testEmailVerification) {
    return res.status(503).json({
      message: "La confirmation par e-mail n'est pas configurée. Réessayez plus tard.",
    });
  }

  try {
    const result = await pool.query(
      "SELECT id, email, email_verified FROM users WHERE LOWER(email) = $1",
      [email]
    );
    const user = result.rows[0];
    if (!user || user.email_verified) {
      return res.json({ message: verificationMessage });
    }

    const existingCode = await pool.query(
      `SELECT created_at
       FROM email_verification_codes
       WHERE user_id = $1 AND created_at > CURRENT_TIMESTAMP - INTERVAL '1 minute'`,
      [user.id]
    );
    if (existingCode.rows.length > 0) {
      return res.status(429).json({ message: "Attendez une minute avant de demander un autre code." });
    }

    const testCode = await createEmailVerificationCode(user.id, user.email);
    return res.json({
      message: verificationMessage,
      ...(testEmailVerification ? { testVerificationCode: testCode } : {}),
    });
  } catch (error) {
    console.error("Erreur renvoi code de confirmation :", error);
    return res.status(503).json({ message: "Impossible d'envoyer le code de confirmation. Réessayez plus tard." });
  }
});

// Connexion sécurisée avec limitation des tentatives
router.post("/login", authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(401).json({
        message: "Email et mot de passe requis.",
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    const result = await pool.query(
      "SELECT * FROM users WHERE LOWER(email) = $1",
      [cleanEmail]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect",
      });
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        message: "Email ou mot de passe incorrect",
      });
    }

    if (user.is_active === false) {
      return res.status(403).json({
        message: "Ce compte est suspendu. Contactez l'assistance.",
      });
    }
    if (user.email_verified === false) {
      return res.status(403).json({
        message: "Confirmez votre adresse e-mail avant de vous connecter.",
        code: "EMAIL_NOT_VERIFIED",
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        role: user.role,
      },
      jwtSecret,
      {
        expiresIn: "7d",
      }
    );

    res.json({
      message: "Connexion réussie",
      token,
      user: {
        id: user.id,
        nom: user.nom,
        email: user.email,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("Erreur login:", error);

    res.status(500).json({
      message: "Erreur serveur",
    });
  }
});

router.post("/forgot-password", authRateLimiter, async (req, res) => {
  if (!isSmtpConfigured) {
    console.error("Réinitialisation du mot de passe indisponible : configuration SMTP incomplète.");
    return res.status(503).json({
      message: "La récupération par e-mail n'est pas configurée. Contactez l'assistance.",
    });
  }

  const email = typeof req.body.email === "string" ? req.body.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ message: "Saisissez une adresse e-mail valide." });
  }

  try {
    const result = await pool.query(
      "SELECT id, email FROM users WHERE LOWER(email) = $1 AND is_active = TRUE",
      [email]
    );
    const user = result.rows[0];

    if (user) {
      const token = crypto.randomBytes(32).toString("hex");
      const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
      const frontendUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
      const resetUrl = `${frontendUrl}/reinitialiser-mot-de-passe?token=${token}`;

      await pool.query(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '30 minutes')
         ON CONFLICT (user_id) DO UPDATE
         SET token_hash = EXCLUDED.token_hash,
             expires_at = EXCLUDED.expires_at,
             created_at = CURRENT_TIMESTAMP`,
        [user.id, tokenHash]
      );

      try {
        await resetEmailTransporter.sendMail({
          from: process.env.SMTP_FROM,
          to: user.email,
          subject: "Réinitialisation de votre mot de passe Immo229",
          text: `Pour choisir un nouveau mot de passe, ouvrez ce lien valable 30 minutes : ${resetUrl}`,
          html: `<p>Vous avez demandé à réinitialiser votre mot de passe Immo229.</p>
            <p><a href="${resetUrl}">Choisir un nouveau mot de passe</a></p>
            <p>Ce lien est valable 30 minutes et ne peut être utilisé qu'une seule fois. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
        });
      } catch (error) {
        console.error("Échec d'envoi du courriel de réinitialisation :", error.message);
        await pool.query(
          "DELETE FROM password_reset_tokens WHERE user_id = $1 AND token_hash = $2",
          [user.id, tokenHash]
        );
      }
    }

    return res.json({ message: passwordResetMessage });
  } catch (error) {
    console.error("Erreur demande de réinitialisation :", error);
    return res.status(500).json({
      message: "Impossible de traiter la demande pour le moment.",
    });
  }
});

router.post("/reset-password", authRateLimiter, async (req, res) => {
  const { token, password, confirmPassword } = req.body;
  if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
    return res.status(400).json({ message: "Ce lien de réinitialisation est invalide ou expiré." });
  }
  if (typeof password !== "string" || password.length < 8) {
    return res.status(400).json({ message: "Le mot de passe doit contenir au moins 8 caractères." });
  }
  if (password !== confirmPassword) {
    return res.status(400).json({ message: "Les deux mots de passe ne correspondent pas." });
  }

  try {
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
    const consumedToken = await pool.query(
      `DELETE FROM password_reset_tokens
       WHERE token_hash = $1 AND expires_at > CURRENT_TIMESTAMP
       RETURNING user_id`,
      [tokenHash]
    );

    if (consumedToken.rows.length === 0) {
      return res.status(400).json({ message: "Ce lien de réinitialisation est invalide ou expiré." });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [passwordHash, consumedToken.rows[0].user_id]
    );

    return res.json({ message: "Mot de passe réinitialisé. Vous pouvez vous connecter." });
  } catch (error) {
    console.error("Erreur réinitialisation du mot de passe :", error);
    return res.status(500).json({
      message: "Impossible de réinitialiser le mot de passe pour le moment.",
    });
  }
});

// Récupérer les informations du profil
router.get("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, nom, first_name, last_name, email, phone, address, profile_photo, role
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const u = result.rows[0];
    const firstName = u.first_name || (u.nom ? u.nom.split(" ")[0] : "");
    const lastName = u.last_name || (u.nom && u.nom.includes(" ") ? u.nom.substring(u.nom.indexOf(" ") + 1) : "");

    res.json({
      id: u.id,
      first_name: firstName,
      last_name: lastName,
      name: u.nom || `${firstName} ${lastName}`.trim(),
      nom: u.nom || `${firstName} ${lastName}`.trim(),
      email: u.email,
      phone: u.phone || "",
      address: u.address || "",
      profile_photo: u.profile_photo || null,
      role: u.role,
    });
  } catch (error) {
    console.error("Erreur profil :", error);
    res.status(500).json({ message: "Erreur lors du chargement du profil." });
  }
});

// Alias /me pour la compatibilité avec le Dashboard
router.get("/me", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await pool.query(
      `SELECT id, nom, first_name, last_name, email, phone, address, profile_photo, role
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    const u = result.rows[0];
    const firstName = u.first_name || (u.nom ? u.nom.split(" ")[0] : "");
    const lastName = u.last_name || (u.nom && u.nom.includes(" ") ? u.nom.substring(u.nom.indexOf(" ") + 1) : "");

    const profileData = {
      id: u.id,
      first_name: firstName,
      last_name: lastName,
      name: u.nom || `${firstName} ${lastName}`.trim(),
      nom: u.nom || `${firstName} ${lastName}`.trim(),
      email: u.email,
      phone: u.phone || "",
      address: u.address || "",
      profile_photo: u.profile_photo || null,
      role: u.role,
    };

    res.json({ user: profileData, ...profileData });
  } catch (error) {
    console.error("Erreur /me :", error);
    res.status(500).json({ message: "Erreur lors du chargement du profil." });
  }
});

// Modifier les informations du profil
router.put("/profile", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { first_name, last_name, email, phone, address } = req.body;

    if (!first_name?.trim() || !last_name?.trim() || !email?.trim()) {
      return res.status(400).json({
        message: "Le prénom, le nom et l'e-mail sont obligatoires.",
      });
    }

    const fullName = `${first_name.trim()} ${last_name.trim()}`;

    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           nom = $3,
           email = $4,
           phone = $5,
           address = $6
       WHERE id = $7
       RETURNING id, first_name, last_name, nom, email, phone, address`,
      [
        first_name.trim(),
        last_name.trim(),
        fullName,
        email.trim(),
        phone?.trim() || null,
        address?.trim() || null,
        userId,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Utilisateur introuvable." });
    }

    res.json({
      message: "Profil mis à jour avec succès.",
      user: result.rows[0],
    });
  } catch (error) {
    console.error("Erreur modification profil :", error);

    if (error.code === "23505") {
      return res.status(409).json({
        message: "Cette adresse e-mail est déjà utilisée.",
      });
    }

    res.status(500).json({ message: "Erreur lors de la modification du profil." });
  }
});

// Upload ou mise à jour de la photo de profil
router.post(
  "/profile/photo",
  authMiddleware,
  uploadProfile.single("photo"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          message: "Choisis une photo avant de continuer.",
        });
      }

      const photoPath = `/uploads/profiles/${req.file.filename}`;

      const result = await pool.query(
        `UPDATE users
         SET profile_photo = $1
         WHERE id = $2
         RETURNING id, profile_photo`,
        [photoPath, req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          message: "Utilisateur introuvable.",
        });
      }

      res.json({
        message: "Photo de profil mise à jour.",
        profile_photo: result.rows[0].profile_photo,
      });
    } catch (error) {
      console.error("Erreur photo de profil :", error);

      res.status(500).json({
        message: "Impossible de mettre à jour la photo.",
      });
    }
  }
);

// Changer le mot de passe
router.put("/change-password", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        message: "Le nouveau mot de passe doit contenir au moins 8 caractères.",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        message: "Les deux nouveaux mots de passe ne correspondent pas.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        message: "Choisis un mot de passe différent de l'ancien.",
      });
    }

    const result = await pool.query(
      "SELECT password FROM users WHERE id = $1",
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        message: "Utilisateur introuvable.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      result.rows[0].password
    );

    if (!passwordMatches) {
      return res.status(400).json({
        message: "Le mot de passe actuel est incorrect.",
      });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await pool.query(
      "UPDATE users SET password = $1 WHERE id = $2",
      [hashedPassword, userId]
    );

    return res.json({
      message: "Ton mot de passe a été modifié avec succès.",
    });
  } catch (error) {
    console.error("Erreur changement de mot de passe :", error);

    return res.status(500).json({
      message: "Une erreur est survenue. Réessaie plus tard.",
    });
  }
});

module.exports = router;
