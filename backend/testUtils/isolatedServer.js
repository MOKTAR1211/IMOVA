const path = require("node:path");
require("dotenv").config({
  path: path.join(__dirname, "..", ".env"),
  quiet: true,
});

async function startIsolatedTestServer() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Les tests d'intégration ne peuvent pas s'exécuter en production.");
  }

  process.env.IMOVA_TEST_DB = "memory";
  process.env.PORT = "0";

  const { pool } = require("../db");
  const backend = require("../server");
  await backend.startServer({ port: 0, host: "127.0.0.1" });

  let closed = false;
  return {
    baseUrl: `http://127.0.0.1:${backend.server.address().port}`,
    pool,
    async close() {
      if (closed) return;
      closed = true;
      await new Promise((resolve) => backend.io.close(resolve));
      await pool.end();
    },
  };
}

module.exports = { startIsolatedTestServer };
