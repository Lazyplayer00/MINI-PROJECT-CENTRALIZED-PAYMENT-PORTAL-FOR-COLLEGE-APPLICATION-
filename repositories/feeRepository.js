"use strict";

const db = require("../db/pool");

const BASE_SELECT = `
  SELECT f.id,
         f.student_id     AS studentId,
         f.semester,
         f.academic_year  AS academicYear,
         f.tuition_amount AS tuitionAmount,
         f.fine_amount    AS fineAmount,
         f.scholarship,
         f.amount_paid    AS amountPaid,
         f.balance,
         f.due_date       AS dueDate
    FROM fees f
`;

/** Every fee record for a student, most recent semester first. */
function listByStudent(studentId) {
  return db.query(
    `${BASE_SELECT} WHERE f.student_id = ? ORDER BY f.academic_year DESC, f.semester DESC`,
    [studentId]
  );
}

function findById(id) {
  return db.queryOne(`${BASE_SELECT} WHERE f.id = ?`, [id]);
}

/**
 * Loads a fee row for update, scoped to its owner.
 *
 * The `student_id` predicate is deliberate: it makes it impossible for a
 * request to touch another student's fee record even if a fee id is guessed,
 * and it runs inside the caller's transaction so the row stays locked.
 */
async function findOwnedForUpdate(connection, feeId, studentId) {
  const [rows] = await connection.execute(
    `${BASE_SELECT} WHERE f.id = ? AND f.student_id = ? FOR UPDATE`,
    [feeId, studentId]
  );
  return rows.length > 0 ? rows[0] : null;
}

/** Applies a settled payment to the fee balance inside a transaction. */
async function applyPayment(connection, feeId, amount) {
  await connection.execute(
    "UPDATE fees SET amount_paid = amount_paid + ? WHERE id = ?",
    [amount, feeId]
  );
}

/** The fee a student would most plausibly be paying next. */
async function findNextPayable(studentId) {
  return db.queryOne(
    `${BASE_SELECT}
      WHERE f.student_id = ? AND f.balance > 0
      ORDER BY f.due_date ASC
      LIMIT 1`,
    [studentId]
  );
}

module.exports = {
  listByStudent,
  findById,
  findOwnedForUpdate,
  applyPayment,
  findNextPayable,
};
