"use strict";

const fees = require("../repositories/feeRepository");
const payments = require("../repositories/paymentRepository");
const money = require("../lib/money");
const { formatDate } = require("../services/receiptService");

/** Shapes a fee row for display, deriving status from the balance and date. */
function presentFee(fee, today = new Date()) {
  const balancePaise = money.toPaise(fee.balance);
  const overdue = balancePaise > 0 && new Date(fee.dueDate) < today;

  return {
    id: fee.id,
    semester: fee.semester,
    academicYear: fee.academicYear,
    tuition: money.format(money.toPaise(fee.tuitionAmount)),
    fine: money.format(money.toPaise(fee.fineAmount)),
    scholarship: money.format(money.toPaise(fee.scholarship)),
    paid: money.format(money.toPaise(fee.amountPaid)),
    balance: money.format(balancePaise),
    balanceRaw: money.toRupees(balancePaise),
    dueDate: formatDate(fee.dueDate),
    settled: balancePaise <= 0,
    overdue,
    status: balancePaise <= 0 ? "Paid" : overdue ? "Overdue" : "Due",
  };
}

/** Dashboard: the student's fee position across every semester. */
async function showDashboard(req, res, next) {
  try {
    const rows = await fees.listByStudent(req.student.id);
    const presented = rows.map((fee) => presentFee(fee));

    const outstandingPaise = rows.reduce(
      (total, fee) => total + Math.max(0, money.toPaise(fee.balance)),
      0
    );

    return res.render("dashboard", {
      title: "Fee summary",
      fees: presented,
      outstanding: money.format(outstandingPaise),
      hasOutstanding: outstandingPaise > 0,
      nextPayable: presented.find((fee) => !fee.settled) ?? null,
    });
  } catch (error) {
    return next(error);
  }
}

/** JSON feed of fee records, consumed by the dashboard's refresh control. */
async function listFees(req, res, next) {
  try {
    const rows = await fees.listByStudent(req.student.id);
    return res.json({ fees: rows.map((fee) => presentFee(fee)) });
  } catch (error) {
    return next(error);
  }
}

/** Payment history page. */
async function showHistory(req, res, next) {
  try {
    const [rows, summary] = await Promise.all([
      payments.listByStudent(req.student.id),
      payments.summariseByStudent(req.student.id),
    ]);

    return res.render("payments", {
      title: "Payment history",
      payments: rows.map((payment) => ({
        reference: payment.reference,
        semester: payment.semester,
        academicYear: payment.academicYear,
        amount: money.format(money.toPaise(payment.amount), {
          currency: payment.currency,
        }),
        method: payment.method.toUpperCase(),
        status: payment.status,
        successful: payment.status === "successful",
        failureReason: payment.failureReason,
        date: formatDate(payment.completedAt ?? payment.createdAt),
      })),
      totalPaid: money.format(money.toPaise(summary.totalPaid)),
      attempts: summary.attempts,
      isEmpty: rows.length === 0,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { presentFee, showDashboard, listFees, showHistory };
