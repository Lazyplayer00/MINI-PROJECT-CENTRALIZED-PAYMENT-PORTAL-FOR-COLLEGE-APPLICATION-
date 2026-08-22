"use strict";

const config = require("../config");
const { badRequest } = require("../lib/errors");

/**
 * Server-side verification of a Cloudflare Turnstile challenge.
 *
 * The original version of this project rendered the captcha widget but never
 * checked the token it produced, which made it decoration -- a scripted client
 * could simply omit the field and post the form directly. The token is only
 * meaningful once the server exchanges it with Cloudflare, which is what this
 * does.
 *
 * Verification is skipped when no secret is configured so the project remains
 * runnable without a Cloudflare account.
 */
async function verify(token, remoteIp) {
  if (!config.turnstile.enabled) {
    return { success: true, skipped: true };
  }

  if (!token) {
    throw badRequest("Please complete the captcha challenge");
  }

  const body = new URLSearchParams({
    secret: config.turnstile.secret,
    response: token,
  });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let payload;
  try {
    const response = await fetch(config.turnstile.verifyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: AbortSignal.timeout(5000),
    });
    payload = await response.json();
  } catch (cause) {
    // Cloudflare being unreachable must not become a silent bypass.
    throw badRequest("Could not verify the captcha. Please try again.");
  }

  if (!payload.success) {
    throw badRequest("Captcha verification failed. Please try again.");
  }

  return { success: true, skipped: false };
}

module.exports = { verify };
