"use strict";

const app = require("./app");
const config = require("./config");
const db = require("./db/pool");

/**
 * Boot sequence.
 *
 * The database is checked before the listener opens, so a misconfigured
 * connection is a loud startup failure rather than a 500 on the first request.
 */
async function start() {
  try {
    await db.healthCheck();
    console.log(`[db]     connected to ${config.db.database}@${config.db.host}`);
  } catch (error) {
    console.error("[db]     connection failed:", error.message);
    console.error(
      "         Check the DB_* values in .env, and that MySQL is running.\n" +
        "         First time? Run: mysql -u root -p < db/schema.sql"
    );
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    console.log(`[server] listening on http://localhost:${config.port}`);
    console.log(`[server] environment: ${config.env}`);
    if (!config.turnstile.enabled) {
      console.log("[server] captcha disabled (no TURNSTILE_SECRET configured)");
    }
  });

  // Finish in-flight requests and release the pool before exiting.
  const shutdown = (signal) => async () => {
    console.log(`\n[server] ${signal} received, shutting down`);
    server.close(async () => {
      await db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };

  process.on("SIGINT", shutdown("SIGINT"));
  process.on("SIGTERM", shutdown("SIGTERM"));
}

start();
