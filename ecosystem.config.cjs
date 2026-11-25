const path = require("node:path");

module.exports = {
  apps: [
    {
      name: "immo229-backend",
      cwd: path.resolve(__dirname, "backend"),
      script: "server.js",
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      env_production: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "5000",
      },
    },
  ],
};
