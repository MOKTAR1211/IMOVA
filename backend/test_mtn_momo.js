const assert = require("node:assert/strict");
const mtnMomo = require("./services/mtnMomo");

const originalFetch = global.fetch;
const envNames = [
  "MTN_MOMO_API_BASE_URL",
  "MTN_MOMO_TARGET_ENVIRONMENT",
  "MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY",
  "MTN_MOMO_API_USER",
  "MTN_MOMO_API_KEY",
  "MTN_MOMO_COUNTRY_CODE",
  "MTN_MOMO_CURRENCY",
];
const originalEnv = Object.fromEntries(envNames.map((name) => [name, process.env[name]]));
const requests = [];

function response(status, data) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => (data == null ? "" : JSON.stringify(data)),
  };
}

async function run() {
  process.env.MTN_MOMO_API_BASE_URL = "https://sandbox.example.test";
  process.env.MTN_MOMO_TARGET_ENVIRONMENT = "sandbox";
  process.env.MTN_MOMO_COLLECTION_SUBSCRIPTION_KEY = "test-subscription-key";
  process.env.MTN_MOMO_API_USER = "test-api-user";
  process.env.MTN_MOMO_API_KEY = "test-api-key";
  process.env.MTN_MOMO_COUNTRY_CODE = "229";
  process.env.MTN_MOMO_CURRENCY = "XOF";

  assert.equal(mtnMomo.normalizeMsisdn("97 00 00 00"), "22997000000");
  assert.equal(mtnMomo.normalizeMsisdn("+229 97 00 00 00"), "22997000000");
  assert.throws(() => mtnMomo.normalizeMsisdn("not a phone"), /numéro Mobile Money valide/);
  assert.equal(mtnMomo.getConfig().currency, "XOF");
  const apiUser = process.env.MTN_MOMO_API_USER;
  delete process.env.MTN_MOMO_API_USER;
  assert.throws(
    () => mtnMomo.assertConfig(),
    (error) => error.status === 503,
    "payment requests must fail explicitly until merchant credentials are configured"
  );
  process.env.MTN_MOMO_API_USER = apiUser;

  global.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    if (String(url).endsWith("/collection/token/")) {
      return response(200, { access_token: "test-access-token", expires_in: 3600 });
    }
    if (options.method === "POST") return response(202);
    return response(200, {
      externalId: "test-reference",
      amount: "1000",
      currency: "XOF",
      status: "SUCCESSFUL",
    });
  };

  mtnMomo.clearTokenCache();
  const payment = await mtnMomo.requestToPay({
    referenceId: "test-reference",
    phoneNumber: "97000000",
    amount: 1000,
    externalId: "test-reference",
    payerMessage: "Publication IMOVA",
    payeeNote: "IMOVA",
  });
  assert.deepEqual(payment, {
    referenceId: "test-reference",
    amount: 1000,
    currency: "XOF",
  });

  const request = requests.find(({ url, options }) => (
    url.endsWith("/collection/v1_0/requesttopay") && options.method === "POST"
  ));
  assert.ok(request);
  assert.equal(request.options.headers["X-Reference-Id"], "test-reference");
  assert.deepEqual(JSON.parse(request.options.body), {
    amount: "1000",
    currency: "XOF",
    externalId: "test-reference",
    payer: { partyIdType: "MSISDN", partyId: "22997000000" },
    payerMessage: "Publication IMOVA",
    payeeNote: "IMOVA",
  });

  const status = await mtnMomo.getPaymentStatus("test-reference");
  assert.equal(status.status, "SUCCESSFUL");
  assert.equal(requests.filter(({ url }) => url.endsWith("/collection/token/")).length, 1);
}

run()
  .then(() => console.log("MTN MoMo Collection tests passed."))
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    global.fetch = originalFetch;
    for (const [name, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
    mtnMomo.clearTokenCache();
  });
