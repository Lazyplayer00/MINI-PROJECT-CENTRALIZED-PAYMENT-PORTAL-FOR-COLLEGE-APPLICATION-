"use strict";

const paymentService = require("../services/paymentService");
const receiptService = require("../services/receiptService");
const feeRepository = require("../repositories/feeRepository");
const paymentRepository = require("../repositories/paymentRepository");
const money = require("../lib/money");
const { notFound } = require("../lib/errors");

/** Renders the checkout form for one fee record. */
async function showCheckout(req, res, next) {
  try {
    const fee = await feeRepository.findById(req.params.feeId);

    // Ownership is checked here as well as in the service: a student must not
    // even be able to see the checkout page for someone else's fee record.
    if (!fee || fee.studentId !== req.student.id) {
      return next(notFound("Fee record not found"));
    }

    const balancePaise = money.toPaise(fee.balance);

    return res.render("checkout", {
      title: `Pay semester ${fee.semester}`,
      fee: {
        id: fee.id,
        semester: fee.semester,
        academicYear: fee.academicYear,
        balance: money.format(balancePaise),
        balanceRaw: money.toRupees(balancePaise),
      },
      settled: balancePaise <= 0,
      methods: [...paymentService.METHODS],
    });
  } catch (error) {
    return next(error);
  }
}

/** Executes a payment and returns the outcome as JSON. */
async function pay(req, res, next) {
  try {
    const result = await paymentService.payFee({
      studentId: req.student.id,
      collegeCode: req.student.collegeCode,
      feeId: Number(req.params.feeId),
      amount: req.body.amount,
      method: req.body.method,
      instrument: req.body.instrument,
    });

    return res.status(201).json({
      ok: true,
      reference: result.reference,
      amount: money.format(result.amountPaise),
      receiptUrl: `/receipts/${result.reference}`,
    });
  } catch (error) {
    return next(error);
  }
}

/** Streams the PDF receipt for a completed payment. */
async function downloadReceipt(req, res, next) {
  try {
    const payment = await paymentRepository.findOwnedByReference(
      req.params.reference,
      req.student.id
    );

    if (!payment) {
      return next(notFound("Receipt not found"));
    }

    if (payment.status !== "successful") {
      return next(notFound("No receipt exists for an unsuccessful payment"));
    }

    return receiptService.streamReceipt(res, {
      payment,
      student: req.student,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = { showCheckout, pay, downloadReceipt };
