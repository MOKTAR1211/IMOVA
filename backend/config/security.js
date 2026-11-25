const isProduction = process.env.NODE_ENV === "production" && !process.env.VERCEL;
const configuredSecret = process.env.JWT_SECRET;
const insecureSecrets = [
  "immo229_secret_change_moi",
  "remplacer_par_une_cle_secrete_ultra_securisee_immo229",
];

if (
  isProduction
  && (
    typeof configuredSecret !== "string"
    || configuredSecret.trim().length < 32
    || insecureSecrets.includes(configuredSecret.trim())
  )
) {
  throw new Error("En production, JWT_SECRET doit être défini avec au moins 32 caractères aléatoires.");
}

function validateProductionConfig() {
  if (!isProduction || process.env.VERCEL) return;

  const requiredHttpsUrl = (name) => {
    try {
      const url = new URL(process.env[name]);
      return url.protocol === "https:" && !["localhost", "127.0.0.1"].includes(url.hostname);
    } catch {
      return false;
    }
  };

  if (!requiredHttpsUrl("FRONTEND_URL") || !requiredHttpsUrl("BACKEND_PUBLIC_URL")) {
    throw new Error(
      "En production, FRONTEND_URL et BACKEND_PUBLIC_URL doivent être des URL HTTPS publiques."
    );
  }

  const smtpPort = Number.parseInt(process.env.SMTP_PORT || "", 10);
  if (
    !process.env.SMTP_HOST?.trim()
    || !process.env.SMTP_USER?.trim()
    || !process.env.SMTP_PASSWORD?.trim()
    || !process.env.SMTP_FROM?.trim()
    || !Number.isInteger(smtpPort)
    || smtpPort < 1
    || smtpPort > 65535
  ) {
    throw new Error(
      "En production, SMTP_HOST, SMTP_USER, SMTP_PASSWORD, SMTP_FROM et un SMTP_PORT valide sont obligatoires pour confirmer les comptes."
    );
  }
}

module.exports = {
  isProduction,
  jwtSecret: configuredSecret?.trim() || "immo229_secret_change_moi_long_secure_token_32_chars",
  validateProductionConfig,
};
