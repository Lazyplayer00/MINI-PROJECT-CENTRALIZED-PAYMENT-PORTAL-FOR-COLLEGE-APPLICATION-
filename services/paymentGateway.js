"use strict";

const crypto = require("crypto");
const config = require("../config");

/**
 * Payment gateway abstraction.
 *
 * The portal talks to this interface only, so swapping the sandbox for a real
 * provider (Razorpay, Stripe, PayU) means adding one module here and changing
 * PAYMENT_GATEWAY in .env -- no controller or repository changes.
 *
 * A gateway exposes:
 *   name
 *   charge({ amountPaise, currency, method, reference, student })
 *     -> { status: 'successful' | 'failed', failureReason?, completedAt }
 */

/** Gateway reference ids are opaque to the portal but must be unique. */
function generateReference(collegeCode = "GEN") {
  const random = crypto.randomBytes(6).toString("hex").toUpperCase();
  const stamp = Date.now().toString(36).toUpperCase();
  return `PAY-${collegeCode.slice(0, 5)}-${stamp}-${random}`.slice(0, 32);
}

/**
 * A deterministic sandbox that mimics the shape of a real gateway response
 * without moving money, so the flow can be demonstrated and tested offline.
 *
 * Test cards drive the outcome, mirroring how real providers expose sandbox
 * behaviour:
 *   card ending 0000 -> declined
 *   card ending 0119 -> processing error
 *   anything else    -> successful
 */
const sandboxGateway = {
  name: "sandbox",

  async charge({ amountPaise, currency, method, reference, instrument = "" }) {
    // Simulate the round trip so the UI's pending state is observable.
    await new Promise((resolve) => setTimeout(resolve, 150));

    const tail = String(instrument).replace(/\D/g, "").slice(-4);

    if (method === "card" && tail === "0000") {
      return {
        reference,
        status: "failed",
        failureReason: "Card declined by issuing bank",
        completedAt: new Date(),
      };
    }

    if (method === "card" && tail === "0119") {
      return {
        reference,
        status: "failed",
        failureReason: "Gateway processing error",
        completedAt: new Date(),
      };
    }

    return {
      reference,
      status: "successful",
      amountPaise,
      currency,
      completedAt: new Date(),
    };
  },
};

const gateways = { sandbox: sandboxGateway };

function resolveGateway(name = config.payment.gateway) {
  const gateway = gateways[name];
  if (!gateway) {
    throw new Error(
      `Unknown payment gateway "${name}". Available: ${Object.keys(gateways).join(", ")}`
    );
  }
  return gateway;
}

module.exports = { resolveGateway, generateReference, sandboxGateway };
