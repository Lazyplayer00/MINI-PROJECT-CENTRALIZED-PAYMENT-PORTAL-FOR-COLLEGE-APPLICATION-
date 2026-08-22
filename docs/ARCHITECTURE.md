# Architecture and design decisions

This document explains how the portal is put together, why it is arranged this
way, and what changed between the 2023 version and the current one.

---

## 1. Layering

```
HTTP request
   │
   ▼
routes/index.js          URL table; attaches rate limiters and validators
   │
   ▼
controllers/             Reads the request, calls a service, renders or replies
   │
   ▼
services/                Business rules. No knowledge of HTTP.
   │
   ▼
repositories/            All SQL. One module per table.
   │
   ▼
db/pool.js               Connection pool, parameterised queries, transactions
```

Each layer may only call the one beneath it. Two consequences matter:

**Business rules are testable without a database.** `validatePayment` is a pure
function over a fee row, so every rule about when money may move is covered by
fast unit tests with no MySQL involved.

**SQL lives in exactly one place per table.** When the query for a student's
fees needs to change, there is one file to open.

## 2. Why the original design had to change

The 2023 version worked in a demonstration but had three structural flaws.

### 2.1 Identity came from an editable cookie

After a successful login the server did this:

```js
const user = { name, email, rollno, course };
res.cookie('user_data', JSON.stringify(user), { maxAge: 86400000 });
```

and the fee endpoint did this:

```js
const userData = JSON.parse(req.cookies.user_data);
const rollno = userData.rollno;
db.query('SELECT ... FROM fees WHERE rollno = ?', [rollno], ...);
```

The cookie was not signed. Anyone could open devtools, change `rollno` to
another student's number, reload, and read that student's fee record. The
parameterised query prevented SQL injection but did nothing about
authorisation — the server was faithfully answering a question it should never
have accepted.

**Now:** the cookie holds a JWT signed with a server-side secret. The server
verifies the signature, then re-loads the student from the database using the
`sub` claim. A modified token fails verification, and `test/access.test.js`
asserts exactly that with a hand-forged cookie.

### 2.2 No page checked for a session

`/userpage` and `/paymentHistory` were plain `res.render` calls. Visiting either
URL directly returned the page whether or not anyone had logged in. The page
looked empty because the client-side script found no cookie — but the server had
already agreed to serve it.

**Now:** `requirePage` and `requireApi` guard every non-public route, and the
test suite walks the full list of protected paths asserting a redirect or 401.

### 2.3 Passwords were plaintext

```js
db.query('SELECT * FROM user WHERE email = ? AND password = ?', [email, password])
```

The password column held readable text, and the comparison happened in SQL. A
single leaked dump would expose every account — and, because people reuse
passwords, accounts elsewhere too.

**Now:** the column stores a bcrypt digest at cost 12. The database returns the
digest and `bcrypt.compare` checks it in the application. Two further details:
the same generic error is returned for unknown-email and wrong-password, and an
unknown email still triggers a dummy bcrypt comparison so the two paths take
comparable time. Without that, response timing alone reveals which addresses
are registered.

## 3. Money

Currency is never a floating point number.

`0.1 + 0.2 === 0.30000000000000004` in IEEE-754 double arithmetic. Over
repeated additions this drifts, and a fee balance that is a few paise wrong is
a bug that surfaces as an unpayable ₹0.01 remainder.

The portal stores money as `DECIMAL(12,2)` in MySQL — which `mysql2` returns as
a *string*, deliberately, to avoid the lossy conversion — and converts to
integer paise for arithmetic. `lib/money.js` owns every conversion, and
`test/money.test.js` asserts exact round-tripping.

`fees.balance` is a generated column:

```sql
balance DECIMAL(12,2)
  AS (tuition_amount + fine_amount - scholarship - amount_paid) STORED
```

The outstanding figure is derived by the database rather than maintained by
application code, so it cannot fall out of step with its inputs.

## 4. The payment transaction

A payment touches two tables and must not half-happen.

```js
db.transaction(async (connection) => {
  const fee = await fees.findOwnedForUpdate(connection, feeId, studentId);
  const { amountPaise } = validatePayment(fee, amount, method);
  const charge = await gateway.charge({ ... });
  await payments.create(connection, { ..., status: charge.status });
  if (charge.status === "successful") {
    await fees.applyPayment(connection, fee.id, money.toRupees(amountPaise));
  }
  return { ... };
});
```

Three decisions are worth spelling out.

**`FOR UPDATE` locks the fee row.** Two concurrent requests paying the same fee
would otherwise both read the same balance and both be allowed through,
over-paying the fee. The lock serialises them; the second sees the updated
balance.

**Ownership is part of the query, not a separate check.**
`findOwnedForUpdate` filters on `student_id` as well as `id`. There is no
window between "check it belongs to them" and "use it", because they are the
same statement.

**A declined charge still commits.** The failed attempt is written to the
ledger and the transaction commits — only `applyPayment` is skipped, so the
balance is untouched. The rejection is thrown *after* the commit returns. An
earlier draft threw inside the transaction body, which rolled back the very
record it was trying to keep; the tests for failed payments would have passed
while the history silently lost every declined attempt.

## 5. The gateway interface

`services/paymentGateway.js` defines one shape:

```js
charge({ amountPaise, currency, method, reference, instrument })
  -> { status: 'successful' | 'failed', failureReason?, completedAt }
```

The portal depends on this interface, not on any provider. The shipped
`sandbox` implementation returns deterministic outcomes driven by the test card
number, which means the whole payment path — including failure handling — can
be demonstrated and tested offline, with no account, no keys and no network.

Adding a real provider means writing one module with a `charge` method and
registering it in the `gateways` map. No controller, repository or view
changes.

## 6. Receipts

Receipts are rendered server-side with PDFKit from the stored payment record.

The original version built the receipt in the browser with jsPDF, filling an
HTML template that contained `[Name]`, `[Roll No.]` and a hard-coded
`INR 3,25,000` — placeholders that were never substituted. A receipt is
evidence of a transaction, so its contents must come from the database, and it
must not be editable by the person it is issued to.

One implementation detail worth recording: the rupee sign (U+20B9) is **not**
in the WinAnsi encoding used by PDFKit's built-in Helvetica. It measures zero
width and renders as nothing, so an amount would print with no currency mark at
all. `money.formatAscii` renders `Rs.` for PDF output while HTML keeps the real
glyph; a test asserts the PDF path stays inside printable ASCII.

## 7. Error handling

`lib/errors.js` defines `AppError`, carrying an HTTP status, a machine-readable
code and a message written for a human. Every deliberate rejection throws one.

`middleware/errorHandler.js` distinguishes the two cases:

- **Expected** (`error.expected === true`) — the message is shown to the user.
- **Unexpected** — logged in full server-side, returned as a generic 500.

That split is why a malformed SQL statement or a dropped connection can never
put a stack trace or a table name in front of a user, without any handler
having to remember to be careful.

The handler content-negotiates: `/api/*` and XHR requests get JSON, page
requests get the rendered error view.

## 8. What is deliberately not built

- **Real payment processing.** See §5 — the seam exists, the integration does
  not.
- **Self-registration and password reset.** Both need an email delivery path,
  which is beyond the scope of the mini project.
- **A college-side administrative view.** The original proposal mentions
  colleges tracking payments and generating reports. The data model supports it
  (`payments` joined to `colleges` through `students`), but no interface exists.
- **CSRF tokens.** The session cookie is `sameSite=lax` and every state-changing
  endpoint is `POST` with a JSON content type, which blocks the cross-site form
  post. A synchroniser token would be the next hardening step.

## 9. Changelog: v1 (2023) to v2

| Area | Before | After |
| --- | --- | --- |
| Passwords | Plaintext column, compared in SQL | bcrypt cost 12, compared in application |
| Session | Unsigned JSON cookie holding identity | Signed JWT in an `httpOnly` cookie |
| Route protection | None | `requirePage` / `requireApi` on every private route |
| Captcha | Widget rendered, token ignored | Verified server-side with Cloudflare |
| DB connections | One `createConnection` per controller, never closed | One shared pool with transactions |
| Payments | "PAY NOW" button did nothing | Full flow with gateway, ledger and receipts |
| History | One hard-coded table row | Real query with per-attempt status |
| Receipts | Client-side jsPDF with `[Name]` placeholders | Server-side PDFKit from database records |
| Money | Numbers from the database | Integer paise, `DECIMAL` storage, generated balance |
| Errors | `console.log` and a 500 | Typed errors, central handler, negotiated format |
| Views | Four templates duplicating header and nav | Layout plus partials |
| Tests | `npm test` printed a message and exited 1 | 49 tests across five files |
