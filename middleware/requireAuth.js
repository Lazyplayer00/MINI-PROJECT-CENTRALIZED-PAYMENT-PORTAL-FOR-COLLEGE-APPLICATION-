"use strict";

const config = require("../config");
const authService = require("../services/authService");
const students = require("../repositories/studentRepository");
const { unauthorized } = require("../lib/errors");

/**
 * Establishes `req.student` from the signed session cookie.
 *
 * This is the fix for the central flaw in the original design, which stored
 * the logged-in student's name, roll number and course in a plain readable
 * cookie and trusted whatever came back. Anyone could edit `user_data` in
 * devtools, put in someone else's roll number, and read their fee record.
 *
 * The cookie now carries a signed JWT: the server can verify it was the one it
 * issued and has not been altered. The claims are then used to re-load the
 * student from the database, so authorisation always reflects current data
 * rather than whatever was true when the token was minted.
 */
async function attachStudent(req, res, next) {
  const token = req.cookies?.[config.auth.cookieName];
  req.student = null;

  if (!token) return next();

  const claims = authService.readToken(token);
  if (!claims) {
    res.clearCookie(config.auth.cookieName);
    return next();
  }

  try {
    const student = await students.findById(claims.sub);
    if (student) {
      const { passwordHash, ...safe } = student;
      req.student = safe;
      res.locals.student = safe;
    }
    return next();
  } catch (error) {
    return next(error);
  }
}

/** Blocks a page request unless authenticated, redirecting to the login form. */
function requirePage(req, res, next) {
  if (req.student) return next();
  const target = encodeURIComponent(req.originalUrl);
  return res.redirect(`/login?next=${target}`);
}

/** Blocks an API request unless authenticated, responding with 401 JSON. */
function requireApi(req, res, next) {
  if (req.student) return next();
  return next(unauthorized());
}

module.exports = { attachStudent, requirePage, requireApi };
