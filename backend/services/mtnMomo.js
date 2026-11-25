const DEFAULT_CURRENCY = "XOF";
let cachedToken = null;
let tokenExpiresAt = 0;

function getConfig() {
  const config = {
    apiBaseUrl: process.env.MTN_MOMO_API_BASE_URL?.replace(/\/+$/, ""),
    targetEnvironment: process.env.MTN_MOMO_TARGET_ENVIRONMENT,
    subscriptionKey: process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY,
    apiUser: process.env.MTN_MOMO_API_USER,
    apiKey: process.env.MTN_MOMO_API_KEY,
    countryCode: process.env.MTN_MOMO_COUNTRY_CODE || "229",
    currency: process.env.MTN_MOMO_CURRENCY || DEFAULT_CURRENCY,
  };

  if (
    !config.apiBaseUrl
    || !config.targetEnvironment
    || !config.subscriptionKey
    || !config.apiUser
    || !config.apiKey
  ) {
    return null;
  }

  let url;
  try {
    url = new URL(config.apiBaseUrl);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:"
    || !/^[A-Z]{3}$/.test(config.currency)
    || !/^\d{1,3}$/.test(config.countryCode)
  ) {
    return null;
  }

  return config;
}

function assertConfig() {
  const config = getConfig();
  if (!config) {
    const error = new Error(
      "Le paiement MTN Mobile Money n'est pas configuré. Les identifiants marchands doivent être ajoutés aux variables sécurisées du serveur."
    );
    error.status = 503;
    throw error;
  }
  return config;
}

function normalizeMsisdn(value, countryCode = "229") {
  const input = String(value || "").trim();
  if (!input || !/^[+\d\s().-]+$/.test(input)) {
    throw new Error("Saisissez un numéro Mobile Money valide.");
  }

  const digits = input.replace(/\D/g, "");
  const normalized = input.startsWith("+")
    ? digits
    : digits.startsWith(countryCode)
      ? digits
      : `${countryCode}${digits}`;

  if (!/^[1-9]\d{7,14}$/.test(normalized)) {
    throw new Error("Le numéro Mobile Money doit être au format international (ex. +229XXXXXXXXXX).");
  }

  return normalized;
}

async function readJson(response, message) {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    const error = new Error(message);
    error.status = 502;
    throw error;
  }
}

function providerError(message, status = 502) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function getAccessToken(config) {
  if (cachedToken && tokenExpiresAt > Date.now() + 30_000) {
    return cachedToken;
  }

  const credentials = Buffer.from(`${config.apiUser}:${config.apiKey}`).toString("base64");
  const response = await fetch(`${config.apiBaseUrl}/collection/token/`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
      "X-Target-Environment": config.targetEnvironment,
    },
    signal: AbortSignal.timeout(15000),
  });

  const data = await readJson(response, "MTN MoMo a retourné une réponse d'authentification illisible.");
  if (!response.ok || !data?.access_token) {
    throw providerError("Impossible d'authentifier le compte MTN Mobile Money.", response.status === 401 ? 503 : 502);
  }

  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + Math.max(Number(data.expires_in) || 0, 60) * 1000;
  return cachedToken;
}

async function providerRequest(path, { method = "GET", referenceId, body } = {}) {
  const config = assertConfig();
  const accessToken = await getAccessToken(config);
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Ocp-Apim-Subscription-Key": config.subscriptionKey,
      "X-Target-Environment": config.targetEnvironment,
      ...(referenceId ? { "X-Reference-Id": referenceId } : {}),
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(15000),
  });

  if (response.status === 202 || response.status === 204) {
    return null;
  }

  const data = await readJson(response, "MTN MoMo a retourné une réponse illisible.");
  if (!response.ok) {
    throw providerError("La demande Mobile Money a été refusée par MTN.", response.status >= 400 && response.status < 500 ? 400 : 502);
  }

  return data;
}

async function requestToPay({ referenceId, phoneNumber, amount, externalId, payerMessage, payeeNote }) {
  const config = assertConfig();
  const msisdn = normalizeMsisdn(phoneNumber, config.countryCode);
  const paymentAmount = Number(amount);

  if (!Number.isInteger(paymentAmount) || paymentAmount <= 0) {
    throw new Error("Le montant du paiement est invalide.");
  }

  await providerRequest("/collection/v1_0/requesttopay", {
    method: "POST",
    referenceId,
    body: {
      amount: String(paymentAmount),
      currency: config.currency,
      externalId: String(externalId),
      payer: {
        partyIdType: "MSISDN",
        partyId: msisdn,
      },
      payerMessage: String(payerMessage || "Paiement IMOVA").slice(0, 160),
      payeeNote: String(payeeNote || "Paiement IMOVA").slice(0, 160),
    },
  });

  return { referenceId, amount: paymentAmount, currency: config.currency };
}

async function getPaymentStatus(referenceId) {
  return providerRequest(
    `/collection/v1_0/requesttopay/${encodeURIComponent(referenceId)}`
  );
}

function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
}

module.exports = {
  assertConfig,
  clearTokenCache,
  getConfig,
  getPaymentStatus,
  normalizeMsisdn,
  requestToPay,
};
