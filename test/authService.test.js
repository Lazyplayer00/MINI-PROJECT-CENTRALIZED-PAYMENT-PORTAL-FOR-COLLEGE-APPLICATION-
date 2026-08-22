"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const authService = require("../services/authService");

test("a hashed password verifies against its plaintext", async () => {
  const digest = await authService.hashPassword("Password@123");

  assert.notEqual(digest, "Password@123", "the plaintext must not be stored");
  assert.match(digest, /^\$2[aby]\$/, "should be a bcrypt digest");
  assert.equal(await authService.verifyPassword("Password@123", digest), true);
});

test("a wrong password does not verify", async () => {
  const digest = await authService.hashPassword("Password@123");

  assert.equal(await authService.verifyPassword("Password@124", digest), false);
  assert.equal(await authService.verifyPassword("", digest), false);
});

test("hashing the same password twice produces different digests", async () => {
  // Distinct salts, so identical passwords are not identifiable in the table.
  const [a, b] = await Promise.all([
    authService.hashPassword("Password@123"),
    authService.hashPassword("Password@123"),
  ]);

  assert.notEqual(a, b);
  assert.equal(await authService.verifyPassword("Password@123", a), true);
  assert.equal(await authService.verifyPassword("Password@123", b), true);
});

test("issued tokens round-trip through verification", () => {
  const token = authService.issueToken({
    id: 7,
    rollNo: "22CE1042",
    name: "Deeptanshu Lal",
    course: "Computer Engineering",
  });

  const claims = authService.readToken(token);

  assert.equal(claims.sub, 7);
  assert.equal(claims.rollNo, "22CE1042");
  assert.ok(claims.exp > Math.floor(Date.now() / 1000));
});

test("a tampered token is rejected", () => {
  const token = authService.issueToken({ id: 7, rollNo: "22CE1042" });

  // Flip a character in the payload segment: the signature no longer matches.
  const [header, payload, signature] = token.split(".");
  const tampered = `${header}.${payload.slice(0, -2)}XY.${signature}`;

  assert.equal(authService.readToken(tampered), null);
});

test("a token signed with the wrong secret is rejected", () => {
  const jwt = require("jsonwebtoken");
  const forged = jwt.sign({ sub: 1 }, "not-the-real-secret");

  assert.equal(authService.readToken(forged), null);
});

test("garbage is rejected rather than throwing", () => {
  assert.equal(authService.readToken("not-a-token"), null);
  assert.equal(authService.readToken(""), null);
});

test("isLocked reflects the lockout window", () => {
  const future = new Date(Date.now() + 60_000);
  const past = new Date(Date.now() - 60_000);

  assert.equal(authService.isLocked({ lockedUntil: future }), true);
  assert.equal(authService.isLocked({ lockedUntil: past }), false);
  assert.equal(authService.isLocked({ lockedUntil: null }), false);
});
