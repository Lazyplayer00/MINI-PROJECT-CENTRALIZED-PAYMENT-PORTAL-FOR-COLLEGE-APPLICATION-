"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const { rules, check } = require("../middleware/validate");

test("required rejects empty values", () => {
  assert.equal(rules.required("x"), null);
  assert.notEqual(rules.required(""), null);
  assert.notEqual(rules.required("   "), null);
  assert.notEqual(rules.required(undefined), null);
  assert.notEqual(rules.required(null), null);
});

test("email accepts valid addresses and rejects malformed ones", () => {
  assert.equal(rules.email("student@example.edu"), null);
  assert.notEqual(rules.email("student@"), null);
  assert.notEqual(rules.email("no-at-sign.edu"), null);
  assert.notEqual(rules.email("spaces in@example.edu"), null);
});

test("decimal accepts money-shaped values only", () => {
  assert.equal(rules.decimal("1000"), null);
  assert.equal(rules.decimal("1000.50"), null);
  assert.notEqual(rules.decimal("1000.505"), null);
  assert.notEqual(rules.decimal("-10"), null);
  assert.notEqual(rules.decimal("1,000"), null);
});

test("oneOf constrains to the allowed set", () => {
  const rule = rules.oneOf(["card", "upi"]);
  assert.equal(rule("card"), null);
  assert.notEqual(rule("cheque"), null);
});

test("check reports the first failing rule per field", () => {
  const errors = check(
    { email: "bad", password: "short" },
    {
      email: [rules.required, rules.email],
      password: [rules.required, rules.minLength(8)],
    }
  );

  assert.ok(errors.email.includes("valid email"));
  assert.ok(errors.password.includes("at least 8"));
});

test("check passes a valid payload", () => {
  const errors = check(
    { email: "student@example.edu", password: "Password@123" },
    {
      email: [rules.required, rules.email],
      password: [rules.required, rules.minLength(8)],
    }
  );

  assert.deepEqual(errors, {});
});

test("check skips optional fields that were not supplied", () => {
  const errors = check({}, { instrument: [rules.maxLength(32)] });
  assert.deepEqual(errors, {});
});
