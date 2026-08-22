"use strict";

const mysql = require("mysql2/promise");
const config = require("../config");

/**
 * A single shared connection pool for the whole process.
 *
 * The earlier version of this project opened a fresh `mysql.createConnection`
 * inside every controller, which meant each module held its own socket, none
 * of them reconnected after a dropped connection, and nothing was ever closed.
 * A pool fixes all three: connections are reused, handed back after each
 * query, and re-established transparently.
 */
const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: config.db.connectionLimit,
  queueLimit: 0,
  timezone: "Z",
  dateStrings: ["DATE"],
  namedPlaceholders: false,
});

/**
 * Runs a parameterised query and returns the rows.
 * Every caller in this project goes through here, so no SQL is ever built by
 * string concatenation.
 */
async function query(sql, params = []) {
  const [rows] = await pool.execute(sql, params);
  return rows;
}

/** Convenience helper for queries that are expected to match a single row. */
async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Runs `work` inside a transaction, committing on success and rolling back on
 * any thrown error. Used by the payment flow, where a payment row and the fee
 * balance must move together or not at all.
 */
async function transaction(work) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await work(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/** Verifies the database is reachable. Called once during boot. */
async function healthCheck() {
  await query("SELECT 1");
}

async function close() {
  await pool.end();
}

module.exports = { pool, query, queryOne, transaction, healthCheck, close };
