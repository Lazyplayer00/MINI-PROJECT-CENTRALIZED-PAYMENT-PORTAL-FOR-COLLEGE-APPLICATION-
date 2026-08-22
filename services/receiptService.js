"use strict";

const PDFDocument = require("pdfkit");
const money = require("../lib/money");
const { METHOD_LABELS } = require("./paymentService");

const ACCENT = "#a51818";
const INK = "#1a1a1a";
const MUTED = "#5c5c5c";
const RULE = "#d8d8d8";

function formatDate(value) {
  if (!value) return "--";
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Renders a fee receipt as a PDF and streams it to `res`.
 *
 * Generating this server-side rather than in the browser matters: the receipt
 * is evidence of a transaction, so its contents must come from the database
 * rather than from whatever the page happened to be displaying. The earlier
 * client-side jsPDF version filled the template with placeholder text and
 * could be edited by anyone with developer tools open.
 */
function streamReceipt(res, { payment, student }) {
  const doc = new PDFDocument({ size: "A4", margin: 56 });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="receipt-${payment.reference}.pdf"`
  );
  doc.pipe(res);

  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  // ---- Header -----------------------------------------------------------
  doc
    .fillColor(ACCENT)
    .fontSize(17)
    .font("Helvetica-Bold")
    .text(student.collegeName ?? "College", left, 56, {
      width,
      align: "center",
    });

  doc
    .fillColor(INK)
    .fontSize(12)
    .font("Helvetica")
    .text("Tuition Fee Receipt", { width, align: "center" });

  doc.moveDown(0.4);
  doc
    .fillColor(MUTED)
    .fontSize(9)
    .text(
      `Receipt reference ${payment.reference}`,
      { width, align: "center" }
    );

  doc.moveDown(1.2);
  doc
    .strokeColor(ACCENT)
    .lineWidth(2)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();
  doc.moveDown(1.2);

  // ---- Detail rows ------------------------------------------------------
  const labelWidth = 170;

  function row(label, value, { bold = false } = {}) {
    const y = doc.y;
    doc
      .fillColor(MUTED)
      .font("Helvetica")
      .fontSize(10)
      .text(label, left, y, { width: labelWidth });
    doc
      .fillColor(INK)
      .font(bold ? "Helvetica-Bold" : "Helvetica")
      .fontSize(bold ? 12 : 10)
      .text(String(value), left + labelWidth, y, {
        width: width - labelWidth,
      });
    doc.moveDown(0.75);
  }

  function sectionRule() {
    doc
      .strokeColor(RULE)
      .lineWidth(1)
      .moveTo(left, doc.y)
      .lineTo(right, doc.y)
      .stroke();
    doc.moveDown(0.75);
  }

  row("Student name", student.name);
  row("Roll number", student.rollNo);
  row("Course", student.course);
  if (student.division) row("Division", student.division);
  sectionRule();

  row("Semester", `Semester ${payment.semester} (${payment.academicYear})`);
  row("Payment method", METHOD_LABELS[payment.method] ?? payment.method);
  row("Transaction date", formatDate(payment.completedAt ?? payment.createdAt));
  row("Status", payment.status.toUpperCase());
  sectionRule();

  row("Amount paid", money.formatAscii(money.toPaise(payment.amount), {
    currency: payment.currency,
  }), { bold: true });

  // ---- Footer -----------------------------------------------------------
  const footerY = doc.page.height - doc.page.margins.bottom - 54;
  doc
    .strokeColor(RULE)
    .lineWidth(1)
    .moveTo(left, footerY)
    .lineTo(right, footerY)
    .stroke();

  doc
    .fillColor(MUTED)
    .fontSize(8)
    .font("Helvetica")
    .text(
      "This is a computer generated receipt and does not require a signature. " +
        `Generated on ${formatDate(new Date())}.`,
      left,
      footerY + 10,
      { width, align: "center" }
    );

  doc.end();
}

module.exports = { streamReceipt, formatDate };
