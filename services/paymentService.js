"use strict";

const config = require("../config");
const db = require("../db/pool");
const fees = require("../repositories/feeRepository");
const payments = require("../repositories/paymentRepository");
const gatewayModule = require("./paymentGateway");
const money = require("../lib/money");
const { badRequest, notFound, paymentFailed } = require("../lib/errors");

const METHODS = new Set(["card", "netbanking", "upi"]);

/**
 * Display labels for each method. CSS `text-transform: capitalize` cannot be
 * used here -- it renders "upi" as "Upi" rather than the acronym.
 */
const METHOD_LABELS = {
  card: "Card",
  netbanking: "Net banking",
  upi: "UPI",
};

/**
 * Validates a requested payment against the fee it settles.
 *
 * Pure and side-effect free so it can be unit tested without a database, and
 * so every rule that decides whether money may move lives in one readable
 * place rather than being scattered through the controller.
 *
 * @param {object} fee          fee row, amounts as decimal strings
 * @param {string|number} amount requested amount in rupees
 * @param {string} method       payment instrument
 * @returns {{amountPaise: number, balancePaise: number}}
 */
function validatePayment(fee, amount, method) {
  if (!fee) {
    throw notFound("Fee record not found");
  }

  if (!METHODS.has(method)) {
    throw badRequest(
      `Unsupported payment method "${method}". Use one of: ${[...METHODS].join(", ")}`
    );
  }

  let amountPaise;
  try {
    amountPaise = money.toPaise(amount);
  } catch {
    throw badRequest("Enter a valid amount");
  }

  if (amountPaise <= 0) {
    throw badRequest("Payment amount must be greater than zero");
  }

  const balancePaise = money.toPaise(fee.balance);

  if (balancePaise <= 0) {
    throw badRequest("This semester's fees are already settled");
  }

  if (amountPaise > balancePaise) {
    throw badRequest(
      `Amount exceeds the outstanding balance of ${money.format(balancePaise)}`
    );
  }

  return { amountPaise, balancePaise };
}

/**
 * Runs a payment end to end.
 *
 * The fee row is locked, validated, charged and updated inside a single
 * transaction. A declined charge is still committed to the ledger with status
 * 'failed' -- the student needs to see why it failed -- so the transaction
 * body returns the outcome instead of throwing. Throwing here would roll the
 * attempt back and lose exactly the record we meant to keep; the rejection is
 * raised by the caller after the commit has landed.
 */
async function payFee({ studentId, collegeCode, feeId, amount, method, instrument }) {
  const gateway = gatewayModule.resolveGateway();
  const reference = gatewayModule.generateReference(collegeCode);

  const outcome = await db.transaction(async (connection) => {
    const fee = await fees.findOwnedForUpdate(connection, feeId, studentId);
    const { amountPaise } = validatePayment(fee, amount, method);

    const charge = await gateway.charge({
      amountPaise,
      currency: config.payment.currency,
      method,
      reference,
      instrument,
    });

    await payments.create(connection, {
      reference,
      feeId: fee.id,
      studentId,
      amount: money.toRupees(amountPaise),
      currency: config.payment.currency,
      method,
      status: charge.status,
      gateway: gateway.name,
      failureReason: charge.failureReason,
      completedAt: charge.completedAt,
    });

    // Only a successful charge moves the balance.
    if (charge.status === "successful") {
      await fees.applyPayment(connection, fee.id, money.toRupees(amountPaise));
    }

    return {
      reference,
      status: charge.status,
      failureReason: charge.failureReason,
      amountPaise,
      semester: fee.semester,
      academicYear: fee.academicYear,
    };
  });

  if (outcome.status !== "successful") {
    throw paymentFailed(outcome.failureReason ?? "Payment was declined", {
      reference: outcome.reference,
    });
  }

  return outcome;
}

module.exports = { validatePayment, payFee, METHODS, METHOD_LABELS };
