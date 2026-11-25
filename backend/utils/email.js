const nodemailer = require("nodemailer");

const smtpPort = Number.parseInt(process.env.SMTP_PORT || "587", 10);
const transporter =
  process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD
    ? nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: smtpPort,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      })
    : null;
const isSmtpConfigured = Boolean(
  transporter && process.env.SMTP_FROM && Number.isInteger(smtpPort)
);
const testVerificationCodes = new Map();

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

async function sendSearchAlertEmail(email, property) {
  if (!isSmtpConfigured) return false;

  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const propertyUrl = new URL(`/bien/${property.id}`, frontendUrl).toString();
  const title = property.titre || "Nouveau bien immobilier";
  const location = [property.ville, property.quartier].filter(Boolean).join(", ");
  const price = `${Number(property.prix).toLocaleString("fr-FR")} FCFA`;

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: `Nouveau bien correspondant à votre recherche — ${title}`,
    text: `${title}\n${location}\n${price}\nConsulter l'annonce : ${propertyUrl}`,
    html: `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(location)}</p><p><strong>${escapeHtml(price)}</strong></p><p><a href="${escapeHtml(propertyUrl)}">Consulter l'annonce</a></p>`,
  });

  return true;
}

async function sendVerificationCodeEmail(email, code) {
  if (process.env.IMOVA_TEST_DB === "memory") {
    testVerificationCodes.set(email, code);
    return;
  }
  if (!isSmtpConfigured) {
    throw new Error("La configuration SMTP est incomplète.");
  }

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: email,
    subject: "Confirmez votre adresse e-mail — IMOVA",
    text: `Votre code de confirmation IMOVA est ${code}. Il est valable 10 minutes. Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
    html: `<p>Bienvenue sur IMOVA.</p><p>Votre code de confirmation est :</p><p style="font-size:28px;font-weight:bold;letter-spacing:8px">${code}</p><p>Ce code est valable 10 minutes et ne peut être utilisé qu'une seule fois.</p><p>Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
  });
}

function getTestVerificationCode(email) {
  return testVerificationCodes.get(email);
}

module.exports = {
  getTestVerificationCode,
  isSmtpConfigured,
  sendVerificationCodeEmail,
  sendSearchAlertEmail,
  smtpPort,
  transporter,
};
