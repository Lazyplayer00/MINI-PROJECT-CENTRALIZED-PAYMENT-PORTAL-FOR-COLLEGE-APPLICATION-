"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const config = require("../config");
const students = require("../repositories/studentRepository");
const { unauthorized, tooManyRequests } = require("../lib/errors");

/** Hashes a plaintext password for storage. */
function hashPassword(plaintext) {
  return bcrypt.hash(plaintext, config.auth.bcryptRounds);
}

/** Compares a candidate password against a stored bcrypt digest. */
function verifyPassword(plaintext, digest) {
  return bcrypt.compare(plaintext, digest);
}

/** True when the account is inside a lockout window. */
function isLocked(student, now = new Date()) {
  return Boolean(student.lockedUntil) && new Date(student.lockedUntil) > now;
}

/** Issues the signed token that becomes the session cookie. */
function issueToken(student) {
  return jwt.sign(
    {
      sub: student.id,
      rollNo: student.rollNo,
      name: student.name,
      course: student.course,
    },
    config.auth.secret,
    { expiresIn: config.auth.expiresIn }
  );
}

/** Verifies a session token, returning its claims or null when invalid. */
function readToken(token) {
  try {
    return jwt.verify(token, config.auth.secret);
  } catch {
    return null;
  }
}

/**
 * Authenticates a set of credentials.
 *
 * Two details matter here. First, the same generic message is returned whether
 * the email is unknown or the password is wrong -- distinguishing them tells an
 * attacker which accounts exist. Second, when the email is unknown a bcrypt
 * comparison is still run against a dummy digest so the response takes roughly
 * the same time either way, closing the timing side channel that would
 * otherwise reveal valid addresses.
 */
const DUMMY_DIGEST =
  "$2b$12$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

async function authenticate({ email, password }) {
  const student = await students.findByEmail(email);

  if (!student) {
    await bcrypt.compare(password, DUMMY_DIGEST);
    throw unauthorized("Incorrect email or password");
  }

  if (isLocked(student)) {
    throw tooManyRequests(
      "Too many failed attempts. Try again in a few minutes."
    );
  }

  const matches = await verifyPassword(password, student.passwordHash);

  if (!matches) {
    await students.registerFailedLogin(student.id);
    throw unauthorized("Incorrect email or password");
  }

  await students.clearFailedLogins(student.id);

  // The digest never leaves this function.
  const { passwordHash, failedLogins, lockedUntil, ...safe } = student;
  return safe;
}

module.exports = {
  hashPassword,
  verifyPassword,
  isLocked,
  issueToken,
  readToken,
  authenticate,
};
