/**
 * Rate Limiter en mémoire pour protéger contre les attaques par force brute (Brute-Force Protection)
 */

function createRateLimiter({
  windowMs = 15 * 60 * 1000,
  max = 30,
  message = "Trop de requêtes. Veuillez réessayer plus tard.",
  keyGenerator,
} = {}) {
  const requests = new Map();

  // Nettoyage régulier des adresses expirées toutes les 5 minutes
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of requests.entries()) {
      if (now - entry.startTime > windowMs) {
        requests.delete(ip);
      }
    }
  }, 5 * 60 * 1000);
  cleanupInterval.unref();

  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || "unknown_ip";
    const key = keyGenerator ? keyGenerator(req, ip) : ip;
    const now = Date.now();

    const record = requests.get(key);

    if (!record) {
      requests.set(key, { count: 1, startTime: now });
      return next();
    }

    if (now - record.startTime > windowMs) {
      // Nouvelle fenêtre
      requests.set(key, { count: 1, startTime: now });
      return next();
    }

    record.count += 1;

    if (record.count > max) {
      const retryAfterSeconds = Math.ceil((windowMs - (now - record.startTime)) / 1000);
      res.setHeader("Retry-After", retryAfterSeconds);
      return res.status(429).json({
        message,
        retryAfter: `${retryAfterSeconds} secondes`,
      });
    }

    next();
  };
}

// Limiteur pour l'authentification (connexion / inscription) : 20 requêtes par 10 minutes
const authRateLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  max: 20,
  keyGenerator: (req, ip) => `${ip}:${req.baseUrl}${req.path}`,
  message: "Trop de tentatives de connexion depuis cette adresse IP. Veuillez patienter 10 minutes avant de réessayer.",
});

// Limiteur général d'API : 200 requêtes par minute
const apiRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 200,
  message: "Trop de requêtes envoyées à l'API. Ralentissez vos requêtes.",
});

module.exports = {
  createRateLimiter,
  authRateLimiter,
  apiRateLimiter,
};
