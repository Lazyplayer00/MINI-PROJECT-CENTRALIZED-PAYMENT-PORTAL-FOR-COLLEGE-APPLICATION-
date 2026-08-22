"use strict";

process.env.NODE_ENV = "test";

const test = require("node:test");
const assert = require("node:assert/strict");

const { validatePayment } = require("../services/paymentService");
const { sandboxGateway, generateReference } = require("../services/paymentGateway");

/** A fee with a 25,000.00 outstanding balance. */
function fee(overrides = {}) {
  return {
    id: 1,
    studentId: 1,
    semester: 3,
    academicYear: "2023-24",
    tuitionAmount: "340000.00",
    fineAmount: "5000.00",
    scholarship: "25000.00",
    amountPaid: "295000.00",
    balance: "25000.00",
    dueDate: "2023-08-15",
    ...overrides,
  };
}

test("accepts a payment for the exact balance", () => {
  const result = validatePayment(fee(), "25000.00", "card");
  assert.equal(result.amountPaise, 2500000);
  assert.equal(result.balancePaise, 2500000);
});

test("accepts a part payment", () => {
  const result = validatePayment(fee(), "10000", "upi");
  assert.equal(result.amountPaise, 1000000);
});

test("rejects a payment larger than the balance", () => {
  assert.throws(
    () => validatePayment(fee(), "25000.01", "card"),
    (error) => error.status === 400 && /exceeds the outstanding balance/.test(error.message)
  );
});

test("rejects zero and negative amounts", () => {
  assert.throws(() => validatePayment(fee(), "0", "card"), /greater than zero/);
  assert.throws(() => validatePayment(fee(), "-100", "card"), /greater than zero/);
});

test("rejects a non-numeric amount", () => {
  assert.throws(() => validatePayment(fee(), "1e5", "card"), /valid amount/);
  assert.throws(() => validatePayment(fee(), "abc", "card"), /valid amount/);
});

test("rejects payment against an already settled fee", () => {
  assert.throws(
    () => validatePayment(fee({ balance: "0.00" }), "100", "card"),
    /already settled/
  );
});

test("rejects an unsupported payment method", () => {
  assert.throws(() => validatePayment(fee(), "1000", "cheque"), /Unsupported payment method/);
});

test("rejects a missing fee with a 404", () => {
  assert.throws(
    () => validatePayment(null, "1000", "card"),
    (error) => error.status === 404
  );
});

test("sandbox gateway settles an ordinary card", async () => {
  const outcome = await sandboxGateway.charge({
    amountPaise: 2500000,
    currency: "INR",
    method: "card",
    reference: "PAY-TEST-1",
    instrument: "4111111111111111",
  });

  assert.equal(outcome.status, "successful");
  assert.ok(outcome.completedAt instanceof Date);
});

test("sandbox gateway declines the test decline card", async () => {
  const outcome = await sandboxGateway.charge({
    amountPaise: 2500000,
    currency: "INR",
    method: "card",
    reference: "PAY-TEST-2",
    instrument: "4111 1111 1111 0000",
  });

  assert.equal(outcome.status, "failed");
  assert.match(outcome.failureReason, /declined/i);
});

test("sandbox gateway reports the test processing error", async () => {
  const outcome = await sandboxGateway.charge({
    amountPaise: 100,
    currency: "INR",
    method: "card",
    reference: "PAY-TEST-3",
    instrument: "4111111111110119",
  });

  assert.equal(outcome.status, "failed");
  assert.match(outcome.failureReason, /processing error/i);
});

test("references are unique and fit the reference column", () => {
  const seen = new Set();

  for (let i = 0; i < 500; i += 1) {
    const reference = generateReference("RAIT");
    assert.ok(reference.length <= 32, `too long: ${reference}`);
    assert.equal(seen.has(reference), false, `duplicate: ${reference}`);
    seen.add(reference);
  }
});
