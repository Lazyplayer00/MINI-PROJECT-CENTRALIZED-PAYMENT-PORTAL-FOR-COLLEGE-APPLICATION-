#!/usr/bin/env node
"use strict";

/**
 * Generates a bcrypt digest for a plaintext password.
 *
 *   npm run hash -- 'Password@123'
 *
 * Used when adding a student row by hand: the database stores digests only,
 * so a plaintext password can never be inserted directly.
 */
const bcrypt = require("bcryptjs");
const config = require("../config");

const [, , plaintext] = process.argv;

if (!plaintext) {
  console.error("Usage: npm run hash -- '<password>'");
  process.exit(1);
}

if (plaintext.length < 8) {
  console.error("Refusing to hash a password shorter than 8 characters.");
  process.exit(1);
}

bcrypt.hash(plaintext, config.auth.bcryptRounds).then((digest) => {
  console.log(digest);
});
