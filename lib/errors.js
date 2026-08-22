"use strict";

/**
 * An error that is safe to show a user and carries an HTTP status.
 *
 * Anything thrown that is *not* an AppError is treated by the error handler as
 * an unexpected fault: it is logged in full and reported to the client as a
 * generic 500, so internal details never leak into a response.
 */
class AppError extends Error {
  constructor(message, { status = 400, code = "BAD_REQUEST", details } = {}) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.code = code;
    this.details = details;
    this.expected = true;
    Error.captureStackTrace(this, AppError);
  }
}

const badRequest = (message, details) =>
  new AppError(message, { status: 400, code: "BAD_REQUEST", details });

const unauthorized = (message = "Authentication required") =>
  new AppError(message, { status: 401, code: "UNAUTHORIZED" });

const forbidden = (message = "You do not have access to this resource") =>
  new AppError(message, { status: 403, code: "FORBIDDEN" });

const notFound = (message = "Not found") =>
  new AppError(message, { status: 404, code: "NOT_FOUND" });

const tooManyRequests = (message = "Too many attempts, please wait") =>
  new AppError(message, { status: 429, code: "RATE_LIMITED" });

const paymentFailed = (message, details) =>
  new AppError(message, { status: 402, code: "PAYMENT_FAILED", details });

module.exports = {
  AppError,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  tooManyRequests,
  paymentFailed,
};
