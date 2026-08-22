"use strict";

const config = require("../config");
const { notFound } = require("../lib/errors");

/** Turns an unmatched route into a 404 that flows through the error handler. */
function handleNotFound(req, res, next) {
  next(notFound(`No route matches ${req.method} ${req.originalUrl}`));
}

/** True when the client is asking for JSON rather than a rendered page. */
function wantsJson(req) {
  return (
    req.xhr ||
    req.path.startsWith("/api") ||
    (req.get("accept") ?? "").includes("application/json")
  );
}

/**
 * Central error handler.
 *
 * Errors marked `expected` (our AppError type) carry a message written for a
 * user and are passed through. Anything else is a fault we did not anticipate:
 * it is logged in full server-side and reduced to a generic message for the
 * client, so stack traces and SQL errors never reach a browser.
 */
// eslint-disable-next-line no-unused-vars -- Express identifies handlers by arity
function handleError(error, req, res, next) {
  const expected = error?.expected === true;
  const status = expected ? error.status : 500;

  if (!expected) {
    console.error(`[error] ${req.method} ${req.originalUrl}`, error);
  }

  const message = expected
    ? error.message
    : "Something went wrong on our end. Please try again.";

  if (wantsJson(req)) {
    return res.status(status).json({
      error: {
        code: expected ? error.code : "INTERNAL_ERROR",
        message,
        ...(expected && error.details ? { details: error.details } : {}),
        ...(config.isProduction || expected ? {} : { stack: error.stack }),
      },
    });
  }

  return res.status(status).render("error", {
    title: `Error ${status}`,
    status,
    message,
    showLoginLink: status === 401 || status === 403,
  });
}

module.exports = { handleNotFound, handleError };
