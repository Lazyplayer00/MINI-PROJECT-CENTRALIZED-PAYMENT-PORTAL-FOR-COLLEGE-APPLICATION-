"use strict";

const express = require("express");
const rateLimit = require("express-rate-limit");

const authController = require("../controllers/authController");
const feeController = require("../controllers/feeController");
const paymentController = require("../controllers/paymentController");
const { requirePage, requireApi } = require("../middleware/requireAuth");
const { rules, body } = require("../middleware/validate");
const paymentService = require("../services/paymentService");

const router = express.Router();

/**
 * Login is rate limited per IP. Without this, the login endpoint is an
 * unbounded password oracle -- the per-account lockout in the auth service
 * covers one account at a time, this covers a client spraying many accounts.
 */
const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: { code: "RATE_LIMITED", message: "Too many attempts, please wait." } },
});

const paymentLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});

// ---- Public --------------------------------------------------------------
router.get("/", (req, res) =>
  req.student ? res.redirect("/dashboard") : res.redirect("/login")
);

router.get("/login", authController.showLogin);

router.post(
  "/auth/login",
  loginLimiter,
  body({
    email: [rules.required, rules.email, rules.maxLength(160)],
    password: [rules.required, rules.minLength(8), rules.maxLength(128)],
  }),
  authController.login
);

router.post("/auth/logout", authController.logout);
router.get("/logout", authController.logout);

router.get("/health", (req, res) => res.json({ status: "ok" }));

// ---- Authenticated pages -------------------------------------------------
router.get("/dashboard", requirePage, feeController.showDashboard);
router.get("/payments", requirePage, feeController.showHistory);
router.get("/pay/:feeId", requirePage, paymentController.showCheckout);
router.get("/receipts/:reference", requirePage, paymentController.downloadReceipt);

// ---- Authenticated JSON API ----------------------------------------------
router.get("/api/fees", requireApi, feeController.listFees);

router.post(
  "/api/fees/:feeId/pay",
  requireApi,
  paymentLimiter,
  body({
    amount: [rules.required, rules.decimal],
    method: [rules.required, rules.oneOf([...paymentService.METHODS])],
    instrument: [rules.maxLength(32)],
  }),
  paymentController.pay
);

module.exports = router;
