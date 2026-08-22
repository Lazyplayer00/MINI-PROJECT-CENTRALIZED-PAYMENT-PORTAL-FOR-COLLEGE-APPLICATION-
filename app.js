"use strict";

const path = require("path");
const express = require("express");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const hbs = require("hbs");

const config = require("./config");
const routes = require("./routes");
const { attachStudent } = require("./middleware/requireAuth");
const { handleNotFound, handleError } = require("./middleware/errorHandler");

const app = express();

// ---- View engine ---------------------------------------------------------
app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "views"));
hbs.registerPartials(path.join(__dirname, "views", "partials"));

hbs.registerHelper("eq", (a, b) => a === b);
hbs.registerHelper("year", () => new Date().getFullYear());

// ---- Security ------------------------------------------------------------
// Turnstile needs to load its script and frame from Cloudflare, so the default
// CSP is extended for exactly those origins rather than being switched off.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "https://challenges.cloudflare.com"],
        frameSrc: ["'self'", "https://challenges.cloudflare.com"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        formAction: ["'self'"],
      },
    },
    // Receipts are streamed as downloads; the default policy blocks that.
    crossOriginResourcePolicy: { policy: "same-origin" },
  })
);

// Behind a reverse proxy this makes req.ip the real client address, which the
// rate limiter and captcha verification both depend on.
if (config.isProduction) {
  app.set("trust proxy", 1);
}

// ---- Request parsing -----------------------------------------------------
app.use(express.urlencoded({ extended: false, limit: "16kb" }));
app.use(express.json({ limit: "16kb" }));
app.use(cookieParser());

// ---- Static assets -------------------------------------------------------
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: config.isProduction ? "7d" : 0,
  })
);

// ---- Application ---------------------------------------------------------
app.use(attachStudent);
app.use(routes);

// ---- Errors --------------------------------------------------------------
app.use(handleNotFound);
app.use(handleError);

module.exports = app;
