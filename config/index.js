"use strict";

const path = require("path");
const dotenv = require("dotenv");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

/**
 * Reads an environment variable, falling back to a default.
 * Throws when a variable is required but missing, so the process fails at
 * boot rather than halfway through a request.
 */
function read(name, { fallback, required = false } = {}) {
  const value = process.env[name];

  if (value === undefined || value === "") {
    if (required) {
      throw new Error(
        `Missing required environment variable ${name}. ` +
          "Copy .env.example to .env and fill it in."
      );
    }
    return fallback;
  }

  return value;
}

function readInt(name, fallback) {
  const raw = read(name, { fallback: String(fallback) });
  const parsed = Number.parseInt(raw, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

const env = read("NODE_ENV", { fallback: "development" });
const isProduction = env === "production";
const isTest = env === "test";

const config = {
  env,
  isProduction,
  isTest,

  port: readInt("PORT", 3000),

  db: {
    host: read("DB_HOST", { fallback: "localhost" }),
    port: readInt("DB_PORT", 3306),
    user: read("DB_USER", { fallback: "root" }),
    password: read("DB_PASS", { fallback: "" }),
    database: read("DATABASE", { fallback: "college_payment_portal" }),
    connectionLimit: readInt("DB_POOL_SIZE", 10),
  },

  auth: {
    // A weak default is tolerable in dev/test but never in production.
    secret: read("JWT_SECRET", {
      fallback: isProduction ? undefined : "dev-only-insecure-secret",
      required: isProduction,
    }),
    expiresIn: read("JWT_EXPIRES_IN", { fallback: "2h" }),
    cookieName: "session",
    bcryptRounds: isTest ? 4 : 12,
  },

  turnstile: {
    siteKey: read("TURNSTILE_SITE_KEY", { fallback: "" }),
    secret: read("TURNSTILE_SECRET", { fallback: "" }),
    verifyUrl: "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    // Captcha is enforced only when a secret is configured. This keeps the
    // project runnable by an evaluator who has no Cloudflare account.
    get enabled() {
      return Boolean(this.secret);
    },
  },

  payment: {
    gateway: read("PAYMENT_GATEWAY", { fallback: "sandbox" }),
    currency: read("PAYMENT_CURRENCY", { fallback: "INR" }),
  },
};

module.exports = config;
