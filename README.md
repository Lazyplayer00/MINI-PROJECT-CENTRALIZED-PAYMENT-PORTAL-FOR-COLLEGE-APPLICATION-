# Centralised Payment Portal for College Applications

A web portal that lets a student sign in once, see the fees owed across every
semester, pay them, and download a receipt for each completed transaction.

Built with Node.js, Express and MySQL.

> **About this repository.** The first version of this project was written in
> 2023 as a third-semester mini project. It worked well enough to demonstrate,
> but it had serious problems: passwords were stored and compared in plaintext,
> no page checked whether the visitor was logged in, and the signed-in identity
> was read from a cookie any user could edit in devtools. Version 2 is a
> rewrite that fixes those problems and fills in the parts that were only ever
> mocked up. `docs/ARCHITECTURE.md` explains what changed and why.

---

## Contents

- [Features](#features)
- [Screens](#screens)
- [Getting started](#getting-started)
- [Configuration](#configuration)
- [Project layout](#project-layout)
- [Data model](#data-model)
- [HTTP interface](#http-interface)
- [Security](#security)
- [Testing](#testing)
- [Known limitations](#known-limitations)

---

## Features

- **Authentication** with bcrypt-hashed passwords, signed session tokens in
  `httpOnly` cookies, per-account lockout and per-IP rate limiting.
- **Captcha** via Cloudflare Turnstile, verified server-side.
- **Fee dashboard** showing tuition, fines, scholarships, amount paid and
  outstanding balance per semester, with due/overdue/paid status.
- **Payments** through a pluggable gateway interface, with full and part
  payments, executed inside a database transaction.
- **Transaction ledger** recording successful *and* failed attempts, so a
  student can see why a payment did not go through.
- **PDF receipts** generated server-side from database records.
- **49 automated tests** covering currency arithmetic, validation,
  authentication, payment rules and HTTP access control.

## Screens

Screenshots of the original 2023 build are in [`screenshots/`](screenshots/).

## Getting started

### Requirements

- Node.js 18.17 or newer
- MySQL 8.0 or newer

### Setup

```bash
# 1. Install dependencies
npm install

# 2. Create your environment file and fill it in
cp .env.example .env

# 3. Create the schema and load sample data
npm run db:setup -- --seed

# 4. Start the development server
npm run dev
```

The portal is then at <http://localhost:3000>.

The seed data creates three students. Sign in with:

| Email                     | Password       | Notes                              |
| ------------------------- | -------------- | ---------------------------------- |
| `deeptanshu@example.edu`  | `Password@123` | One paid, one part-paid, one overdue |
| `aarav@example.edu`       | `Password@123` | One paid, one overdue with a fine  |
| `priya@example.edu`       | `Password@123` | Fully settled                      |

### Trying a payment

The project ships with a **sandbox gateway**, so no real payment credentials
are needed. On the checkout page, the card number decides the outcome:

| Card ending | Result                       |
| ----------- | ---------------------------- |
| `0000`      | Declined by issuing bank     |
| `0119`      | Gateway processing error     |
| anything else | Successful                 |

A successful payment updates the fee balance and produces a downloadable
receipt. A failed one is recorded in the history with its reason, and leaves
the balance untouched.

## Configuration

All configuration is read from `.env`. See [`.env.example`](.env.example) for
the full list.

| Variable | Purpose | Default |
| --- | --- | --- |
| `PORT` | HTTP port | `3000` |
| `NODE_ENV` | `development`, `test` or `production` | `development` |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASS` / `DATABASE` | MySQL connection | localhost / 3306 / root |
| `JWT_SECRET` | Signs session tokens. **Required in production.** | dev-only fallback |
| `JWT_EXPIRES_IN` | Session lifetime | `2h` |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET` | Cloudflare Turnstile. Captcha is skipped when the secret is empty. | empty |
| `PAYMENT_GATEWAY` | Gateway to use | `sandbox` |

## Project layout

```
app.js                  Express application assembly (middleware, views, errors)
server.js               Boot: verify the database, listen, shut down cleanly
config/                 Environment parsing and validation
db/
  pool.js               Shared connection pool, query helpers, transactions
  schema.sql            Table definitions
  seed.sql              Sample students, fees and payments
repositories/           All SQL. One module per table.
services/               Business logic: auth, payments, gateway, receipts, captcha
controllers/            Request handling; no SQL, no business rules
middleware/             Authentication, validation, error handling
routes/index.js         URL table
lib/                    Currency arithmetic and the error type
views/                  Handlebars templates and partials
public/                 Stylesheet, client scripts, logo
scripts/                Database setup and password hashing utilities
test/                   Automated tests
docs/ARCHITECTURE.md    Design decisions and the v1 -> v2 changelog
```

The dependency direction is strictly one-way:

```
routes -> controllers -> services -> repositories -> db
```

A controller never writes SQL, and a repository never contains business rules.
This is what makes the payment logic testable without a live database.

## Data model

Four tables. See [`db/schema.sql`](db/schema.sql) for the full definition and
[`ER Model.png`](ER%20Model.png) for the original diagram.

```
colleges ──< students ──< fees ──< payments
                  └──────────────────┘
```

- **colleges** — institutions a student can pay.
- **students** — portal accounts. Stores a bcrypt digest, never a password.
- **fees** — one row per student per semester. `balance` is a *generated
  column* (`tuition + fine - scholarship - paid`), so the outstanding figure
  can never contradict the values it is derived from.
- **payments** — an append-only ledger of every attempt, successful or not.

Money is stored as `DECIMAL(12,2)` and handled in integer paise in application
code. `FLOAT` is never used for currency: binary floating point cannot
represent values like `0.10` exactly, and the error compounds over repeated
arithmetic.

## HTTP interface

### Pages

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/` | – | Redirects to `/dashboard` or `/login` |
| `GET` | `/login` | – | Sign-in form |
| `GET` | `/dashboard` | ✔ | Fee summary across semesters |
| `GET` | `/payments` | ✔ | Transaction history |
| `GET` | `/pay/:feeId` | ✔ | Checkout for one fee record |
| `GET` | `/receipts/:reference` | ✔ | PDF receipt download |

### API

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | – | Sign in. Returns `{ ok, redirect }` |
| `POST` | `/auth/logout` | – | Clear the session cookie |
| `GET` | `/api/fees` | ✔ | Fee records as JSON |
| `POST` | `/api/fees/:feeId/pay` | ✔ | Execute a payment |
| `GET` | `/health` | – | Liveness probe |

Errors are returned in a consistent envelope:

```json
{ "error": { "code": "BAD_REQUEST", "message": "…", "details": { "…": "…" } } }
```

## Security

| Concern | How it is handled |
| --- | --- |
| Password storage | bcrypt, cost 12. Digests only; plaintext is never stored or logged. |
| Session integrity | JWT signed with `JWT_SECRET`, sent as an `httpOnly`, `sameSite=lax` cookie (`secure` in production). Claims are re-checked against the database on every request. |
| Access control | `requirePage` / `requireApi` guard every non-public route. |
| SQL injection | Every query is parameterised through `db.query`. No SQL is ever built by string concatenation. |
| Brute force | Per-account lockout after 5 failures (15 minutes) plus a per-IP rate limit on `/auth/login`. |
| Account enumeration | Login returns one generic message for unknown-email and wrong-password, and runs a dummy bcrypt comparison when the email is unknown so both paths take similar time. |
| Captcha | Turnstile tokens are exchanged with Cloudflare server-side. |
| XSS | Handlebars escapes interpolated values by default; a CSP is set via Helmet. |
| Error leakage | Unexpected errors are logged server-side and returned as a generic 500. |

## Testing

```bash
npm test
```

49 tests, no database required — the suite stubs at the repository boundary
and exercises the real Express stack for access control.

| File | Covers |
| --- | --- |
| `test/money.test.js` | Currency conversion, rounding, Indian digit grouping, PDF-safe formatting |
| `test/validate.test.js` | Field validation rules |
| `test/authService.test.js` | Hashing, token issue/verify, tampering, expiry, lockout |
| `test/paymentService.test.js` | Payment rules, gateway outcomes, reference uniqueness |
| `test/access.test.js` | Route protection, forged cookies, security headers, 404s |

## Known limitations

Stated plainly, since they are the natural next steps rather than oversights:

- **The gateway is a sandbox.** It mimics the request/response shape of a real
  provider but moves no money. Integrating Razorpay or Stripe means adding one
  module in `services/paymentGateway.js`; nothing else changes.
- **No self-service registration.** Student rows are created by an
  administrator. `npm run hash` generates the digest for a new row.
- **No administrative interface.** Colleges cannot yet log in to reconcile
  payments; the reporting feature described in the original proposal is
  unbuilt.
- **Receipts are generated on demand** rather than archived, so a receipt
  reflects the payment record at the time it is downloaded.
- **Single-currency.** Amounts are formatted for INR; the schema carries a
  currency column but no conversion is performed.

## Licence

MIT.
