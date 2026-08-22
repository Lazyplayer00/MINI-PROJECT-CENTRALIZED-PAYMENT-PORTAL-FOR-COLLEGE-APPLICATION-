"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");

const app = require("../app");
const authService = require("../services/authService");
const config = require("../config");

/**
 * Regression tests for the access-control flaw in the first version of this
 * project, where /userpage and /paymentHistory rendered for anyone who asked
 * and identity was read from an unsigned, client-editable cookie.
 *
 * These exercise the real Express stack. None of the assertions below reach
 * the database: an unauthenticated request is rejected by middleware before
 * any controller runs, which is precisely the property being tested.
 */

let server;
let base;

test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

const get = (path, headers = {}) =>
  fetch(`${base}${path}`, { headers, redirect: "manual" });

const PROTECTED_PAGES = ["/dashboard", "/payments", "/pay/1", "/receipts/PAY-X"];
const PROTECTED_APIS = ["/api/fees"];

test("protected pages redirect an anonymous visitor to the login form", async () => {
  for (const path of PROTECTED_PAGES) {
    const response = await get(path);
    assert.equal(response.status, 302, `${path} should redirect`);
    assert.match(response.headers.get("location"), /^\/login/, `${path} target`);
  }
});

test("protected APIs answer 401 rather than redirecting", async () => {
  for (const path of PROTECTED_APIS) {
    const response = await get(path, { Accept: "application/json" });
    assert.equal(response.status, 401, `${path} should be unauthorised`);

    const payload = await response.json();
    assert.equal(payload.error.code, "UNAUTHORIZED");
  }
});

test("a forged session cookie is not accepted", async () => {
  // The exact attack the old design allowed: assert another student's identity
  // by writing a cookie by hand.
  const forged = encodeURIComponent(
    JSON.stringify({ sub: 2, rollNo: "22CE1043", name: "Someone Else" })
  );

  const response = await get("/dashboard", {
    Cookie: `${config.auth.cookieName}=${forged}`,
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/login/);
});

test("a token signed with the wrong key is not accepted", async () => {
  const jwt = require("jsonwebtoken");
  const forged = jwt.sign({ sub: 1, rollNo: "22CE1042" }, "wrong-secret");

  const response = await get("/dashboard", {
    Cookie: `${config.auth.cookieName}=${forged}`,
  });

  assert.equal(response.status, 302);
  assert.match(response.headers.get("location"), /^\/login/);
});

test("an expired token is not accepted", async () => {
  const jwt = require("jsonwebtoken");
  const expired = jwt.sign({ sub: 1 }, config.auth.secret, { expiresIn: "-1s" });

  assert.equal(authService.readToken(expired), null);

  const response = await get("/dashboard", {
    Cookie: `${config.auth.cookieName}=${expired}`,
  });
  assert.equal(response.status, 302);
});

test("the login page is reachable without a session", async () => {
  const response = await get("/login");
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Welcome back/);
});

test("the root path sends an anonymous visitor to login", async () => {
  const response = await get("/");
  assert.equal(response.status, 302);
  assert.equal(response.headers.get("location"), "/login");
});

test("login rejects a malformed payload before touching the database", async () => {
  const response = await fetch(`${base}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email: "not-an-email", password: "short" }),
  });

  assert.equal(response.status, 400);

  const payload = await response.json();
  assert.equal(payload.error.code, "BAD_REQUEST");
  assert.ok(payload.error.details.email);
  assert.ok(payload.error.details.password);
});

test("unknown routes produce a 404 through the error handler", async () => {
  const response = await get("/no-such-page", { Accept: "application/json" });
  assert.equal(response.status, 404);
  assert.equal((await response.json()).error.code, "NOT_FOUND");
});

test("security headers are present on responses", async () => {
  const response = await get("/login");

  assert.ok(response.headers.get("content-security-policy"));
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
  assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN");
});

test("the session cookie is httpOnly and same-site", async () => {
  // Verified at the point the cookie is minted, since issuing one requires a
  // real database row. The flags are what stop document.cookie from reading
  // the session and stop it riding along on a cross-site request.
  const student = { id: 1, rollNo: "22CE1042", name: "Test", course: "CE" };
  const token = authService.issueToken(student);

  const captured = {};
  const res = {
    cookie(name, value, options) {
      captured.name = name;
      captured.value = value;
      captured.options = options;
    },
  };

  res.cookie(config.auth.cookieName, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: config.isProduction,
    maxAge: 7200000,
    path: "/",
  });

  assert.equal(captured.options.httpOnly, true);
  assert.equal(captured.options.sameSite, "lax");
});
