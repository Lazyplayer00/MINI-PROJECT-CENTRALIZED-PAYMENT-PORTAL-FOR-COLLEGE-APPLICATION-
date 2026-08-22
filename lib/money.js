"use strict";

/**
 * Currency helpers.
 *
 * MySQL returns DECIMAL columns as strings to avoid the precision loss that
 * comes with binary floating point. Rather than eagerly turning them into
 * JavaScript numbers, all arithmetic in this project happens in integer paise
 * (1 rupee = 100 paise) and is converted back only for display.
 */

/** Converts a rupee value (string or number) to an integer paise count. */
function toPaise(value) {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot convert ${value} to paise`);
    }
    return Math.round(value * 100);
  }

  const text = String(value).trim();
  if (!/^-?\d+(\.\d+)?$/.test(text)) {
    throw new TypeError(`Malformed currency value: ${value}`);
  }

  const negative = text.startsWith("-");
  const [rupees, fraction = ""] = text.replace("-", "").split(".");
  const paise =
    Number(rupees) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2));

  return negative ? -paise : paise;
}

/** Converts integer paise back to a fixed-2 rupee string for the database. */
function toRupees(paise) {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`Expected integer paise, received ${paise}`);
  }
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  return `${sign}${Math.floor(absolute / 100)}.${String(absolute % 100).padStart(2, "0")}`;
}

/**
 * Formats paise in the Indian digit grouping used on receipts,
 * e.g. 32500000 -> "3,25,000.00".
 *
 * `symbol` overrides the currency mark. This exists because the rupee sign
 * (U+20B9) is absent from the WinAnsi encoding of PDFKit's built-in Helvetica
 * -- it measures zero width and renders as nothing at all -- so PDF output
 * passes an ASCII symbol while HTML output keeps the real glyph.
 */
const SYMBOLS = { INR: "\u20b9" };

function format(paise, { currency = "INR", symbol } = {}) {
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  const rupees = String(Math.floor(absolute / 100));
  const decimals = String(absolute % 100).padStart(2, "0");

  // Indian grouping: last three digits, then pairs.
  const last3 = rupees.slice(-3);
  const rest = rupees.slice(0, -3);
  const grouped = rest
    ? `${rest.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${last3}`
    : last3;

  const mark = symbol ?? SYMBOLS[currency] ?? `${currency} `;
  return `${sign}${mark}${grouped}.${decimals}`;
}

/** Currency formatting restricted to characters the PDF base fonts contain. */
function formatAscii(paise, { currency = "INR" } = {}) {
  return format(paise, {
    currency,
    symbol: currency === "INR" ? "Rs. " : `${currency} `,
  });
}

module.exports = { toPaise, toRupees, format, formatAscii };
