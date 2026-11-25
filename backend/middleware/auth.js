const jwt = require("jsonwebtoken");
const { pool } = require("../db");
const { jwtSecret } = require("../config/security");

/**
 * Middleware d'authentification standard (vérifie le token JWT)
 */
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({
      message: "Authentification requise pour accéder à cette ressource.",
    });
  }

  try {
    const decoded = jwt.verify(
      token,
      jwtSecret
    );
    const result = await pool.query(
      "SELECT is_active FROM users WHERE id = $1",
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        message: "Compte utilisateur introuvable.",
      });
    }

    if (!result.rows[0].is_active) {
      return res.status(403).json({
        message: "Ce compte est suspendu. Contactez l'assistance.",
      });
    }

    req.user = decoded;
    next();
  } catch (error) {
    if (error.name !== "JsonWebTokenError" && error.name !== "TokenExpiredError") {
      console.error("Erreur de vérification du compte :", error);
      return res.status(500).json({
        message: "Impossible de vérifier l'état du compte.",
      });
    }

    return res.status(401).json({
      message: "Session expirée ou jeton d'accès invalide.",
    });
  }
};

/**
 * Middleware d'autorisation Administrateur
 * Exige que req.user soit défini et que le rôle soit strictement 'admin'
 */
const adminMiddleware = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      message: "Authentification requise.",
    });
  }

  if (req.user.role !== "admin") {
    return res.status(403).json({
      message: "Accès refusé. Cette action est strictement réservée aux administrateurs.",
    });
  }

  next();
};

module.exports = authMiddleware;
module.exports.authMiddleware = authMiddleware;
module.exports.adminMiddleware = adminMiddleware;
