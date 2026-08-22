"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const money = require("../lib/money");

test("toPaise converts decimal strings exactly", () => {
  assert.equal(money.toPaise("325000.00"), 32500000);
  assert.equal(money.toPaise("0.01"), 1);
  assert.equal(money.toPaise("1000"), 100000);
  assert.equal(money.toPaise("1000.5"), 100050);
});

test("toPaise avoids binary floating point drift", () => {
  // 0.1 + 0.2 !== 0.3 in float arithmetic; in paise it is exact.
  assert.equal(money.toPaise("0.10") + money.toPaise("0.20"), money.toPaise("0.30"));
});

test("toPaise handles negative values", () => {
  assert.equal(money.toPaise("-500.25"), -50025);
});

test("toPaise rejects malformed input", () => {
  assert.throws(() => money.toPaise("abc"), TypeError);
  assert.throws(() => money.toPaise("1,000"), TypeError);
  assert.throws(() => money.toPaise(Number.NaN), TypeError);
});

test("toRupees round-trips through toPaise", () => {
  for (const value of ["0.00", "1.05", "325000.00", "99999999.99"]) {
    assert.equal(money.toRupees(money.toPaise(value)), value);
  }
});

test("toRupees rejects non-integer paise", () => {
  assert.throws(() => money.toRupees(10.5), TypeError);
});

test("format uses Indian digit grouping", () => {
  assert.equal(money.format(32500000), "₹3,25,000.00");
  assert.equal(money.format(100000), "₹1,000.00");
  assert.equal(money.format(99900), "₹999.00");
  assert.equal(money.format(0), "₹0.00");
});

test("format handles negatives and other currencies", () => {
  assert.equal(money.format(-150000), "-₹1,500.00");
  assert.equal(money.format(100000, { currency: "USD" }), "USD 1,000.00");
});

test("formatAscii avoids glyphs missing from the PDF base fonts", () => {
  // The rupee sign is not in WinAnsi, so receipts must not rely on it.
  assert.equal(money.formatAscii(32500000), "Rs. 3,25,000.00");
  assert.ok(!money.formatAscii(32500000).includes("₹"));
  assert.match(money.formatAscii(32500000), /^[\x20-\x7e]+$/);
});

test("format still uses the rupee sign for HTML output", () => {
  assert.ok(money.format(32500000).includes("₹"));
});

test("format accepts an explicit symbol override", () => {
  assert.equal(money.format(100000, { symbol: "INR " }), "INR 1,000.00");
});
