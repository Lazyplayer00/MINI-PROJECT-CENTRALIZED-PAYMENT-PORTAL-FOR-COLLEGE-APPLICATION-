"use strict";

const config = require("../config");
const authService = require("../services/authService");
const turnstile = require("../services/turnstileService");

/** Renders the login form. */
function showLogin(req, res) {
  if (req.student) return res.redirect("/dashboard");

  return res.render("login", {
    title: "Sign in",
    turnstileSiteKey: config.turnstile.siteKey,
    captchaEnabled: config.turnstile.enabled,
    next: typeof req.query.next === "string" ? req.query.next : "",
  });
}

/**
 * Handles a login submission.
 *
 * The captcha is verified before the credentials are checked, so a scripted
 * attacker cannot use the login endpoint as a password oracle without also
 * solving a challenge each time.
 */
async function login(req, res, next) {
  try {
    const { email, password, "cf-turnstile-response": captchaToken } = req.body;

    await turnstile.verify(captchaToken, req.ip);

    const student = await authService.authenticate({ email, password });
    const token = authService.issueToken(student);

    res.cookie(config.auth.cookieName, token, {
      httpOnly: true,               // not readable from document.cookie
      sameSite: "lax",              // not sent on cross-site form posts
      secure: config.isProduction,  // HTTPS only outside local development
      maxAge: 2 * 60 * 60 * 1000,
      path: "/",
    });

    // Only allow relative redirects, so `next` cannot bounce a user off-site.
    const target =
      typeof req.body.next === "string" &&
      req.body.next.startsWith("/") &&
      !req.body.next.startsWith("//")
        ? req.body.next
        : "/dashboard";

    return res.status(200).json({ ok: true, redirect: target });
  } catch (error) {
    return next(error);
  }
}

/** Clears the session cookie. */
function logout(req, res) {
  res.clearCookie(config.auth.cookieName, { path: "/" });
  return res.redirect("/login");
}

module.exports = { showLogin, login, logout };
