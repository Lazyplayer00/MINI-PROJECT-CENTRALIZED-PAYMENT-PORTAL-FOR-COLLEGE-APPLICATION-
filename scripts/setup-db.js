#!/usr/bin/env node
"use strict";

/**
 * Creates the schema and loads sample data.
 *
 *   npm run db:setup           # schema only
 *   npm run db:setup -- --seed # schema + sample students, fees and payments
 *
 * Exists so an evaluator can go from a clean checkout to a working database
 * with one command, without needing the mysql client on their PATH.
 */
const fs = require("node:fs/promises");
const path = require("node:path");
const mysql = require("mysql2/promise");
const config = require("../config");

async function run() {
  const withSeed = process.argv.includes("--seed");

  // Connect without selecting a database: schema.sql creates it.
  const connection = await mysql.createConnection({
    host: config.db.host,
    port: config.db.port,
    user: config.db.user,
    password: config.db.password,
    multipleStatements: true,
  });

  try {
    const schema = await fs.readFile(
      path.join(__dirname, "..", "db", "schema.sql"),
      "utf8"
    );
    await connection.query(schema);
    console.log("[db] schema created");

    if (withSeed) {
      const seed = await fs.readFile(
        path.join(__dirname, "..", "db", "seed.sql"),
        "utf8"
      );
      await connection.query(seed);
      console.log("[db] sample data loaded");
      console.log("[db] sign in with deeptanshu@example.edu / Password@123");
    }
  } finally {
    await connection.end();
  }
}

run().catch((error) => {
  console.error("[db] setup failed:", error.message);
  process.exit(1);
});
