"use strict";

const { badRequest } = require("../lib/errors");

/**
 * Minimal request validation.
 *
 * A schema is an object of `{ field: [rule, ...] }`. Rules are small pure
 * predicates, which keeps validation readable and dependency-free, and means
 * the rules themselves are directly unit testable.
 */
const rules = {
  required: (value) =>
    value !== undefined && value !== null && String(value).trim() !== ""
      ? null
      : "is required",

  email: (value) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? null : "must be a valid email address",

  minLength: (n) => (value) =>
    String(value).length >= n ? null : `must be at least ${n} characters`,

  maxLength: (n) => (value) =>
    String(value).length <= n ? null : `must be at most ${n} characters`,

  integer: (value) =>
    /^\d+$/.test(String(value)) ? null : "must be a whole number",

  decimal: (value) =>
    /^\d+(\.\d{1,2})?$/.test(String(value)) ? null : "must be an amount like 1000 or 1000.50",

  oneOf: (allowed) => (value) =>
    allowed.includes(value) ? null : `must be one of: ${allowed.join(", ")}`,
};

/** Runs a schema over an object, returning a map of field -> message. */
function check(source, schema) {
  const errors = {};

  for (const [field, fieldRules] of Object.entries(schema)) {
    const value = source?.[field];

    // Skip optional fields that were not supplied.
    const isRequired = fieldRules.includes(rules.required);
    if (!isRequired && (value === undefined || value === "")) continue;

    for (const rule of fieldRules) {
      const message = rule(value);
      if (message) {
        errors[field] = `${field} ${message}`;
        break;
      }
    }
  }

  return errors;
}

/** Express middleware factory that validates `req.body` against a schema. */
function body(schema) {
  return (req, res, next) => {
    const errors = check(req.body, schema);
    if (Object.keys(errors).length > 0) {
      return next(badRequest("Please correct the highlighted fields", errors));
    }
    return next();
  };
}

module.exports = { rules, check, body };
