"use strict";

const db = require("../db/pool");

const BASE_SELECT = `
  SELECT p.id,
         p.reference,
         p.fee_id         AS feeId,
         p.student_id     AS studentId,
         p.amount,
         p.currency,
         p.method,
         p.status,
         p.gateway,
         p.failure_reason AS failureReason,
         p.created_at     AS createdAt,
         p.completed_at   AS completedAt,
         f.semester,
         f.academic_year  AS academicYear
    FROM payments p
    JOIN fees f ON f.id = p.fee_id
`;

/** Full transaction history for a student, newest first. */
function listByStudent(studentId) {
  return db.query(
    `${BASE_SELECT} WHERE p.student_id = ? ORDER BY p.created_at DESC`,
    [studentId]
  );
}

/**
 * Fetches a single payment, always scoped by student id so one student can
 * never read another's receipt by guessing a reference.
 */
function findOwnedByReference(reference, studentId) {
  return db.queryOne(
    `${BASE_SELECT} WHERE p.reference = ? AND p.student_id = ?`,
    [reference, studentId]
  );
}

/** Inserts the ledger row for an attempt, inside the caller's transaction. */
async function create(connection, payment) {
  const [result] = await connection.execute(
    `INSERT INTO payments
       (reference, fee_id, student_id, amount, currency, method, status,
        gateway, failure_reason, completed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      payment.reference,
      payment.feeId,
      payment.studentId,
      payment.amount,
      payment.currency,
      payment.method,
      payment.status,
      payment.gateway,
      payment.failureReason ?? null,
      payment.completedAt ?? null,
    ]
  );
  return result.insertId;
}

/** Aggregate figures used by the payment history page. */
async function summariseByStudent(studentId) {
  const row = await db.queryOne(
    `SELECT COUNT(*) AS attempts,
            COALESCE(SUM(CASE WHEN status = 'successful' THEN amount END), 0)
              AS totalPaid,
            COALESCE(SUM(status = 'failed'), 0) AS failures
       FROM payments
      WHERE student_id = ?`,
    [studentId]
  );
  return row ?? { attempts: 0, totalPaid: 0, failures: 0 };
}

module.exports = {
  listByStudent,
  findOwnedByReference,
  create,
  summariseByStudent,
};
