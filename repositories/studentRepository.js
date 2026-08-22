"use strict";

const db = require("../db/pool");

const BASE_SELECT = `
  SELECT s.id,
         s.roll_no      AS rollNo,
         s.name,
         s.email,
         s.password_hash AS passwordHash,
         s.course,
         s.division,
         s.college_id   AS collegeId,
         s.failed_logins AS failedLogins,
         s.locked_until AS lockedUntil,
         c.name         AS collegeName,
         c.code         AS collegeCode
    FROM students s
    JOIN colleges c ON c.id = s.college_id
`;

/** Looks a student up by the identifier typed into the login form. */
function findByEmail(email) {
  return db.queryOne(`${BASE_SELECT} WHERE s.email = ?`, [email]);
}

function findById(id) {
  return db.queryOne(`${BASE_SELECT} WHERE s.id = ?`, [id]);
}

function findByRollNo(rollNo) {
  return db.queryOne(`${BASE_SELECT} WHERE s.roll_no = ?`, [rollNo]);
}

/** Records a failed login so repeated attempts can be throttled per account. */
function registerFailedLogin(id) {
  return db.query(
    `UPDATE students
        SET failed_logins = failed_logins + 1,
            locked_until = CASE
              WHEN failed_logins + 1 >= 5 THEN DATE_ADD(NOW(), INTERVAL 15 MINUTE)
              ELSE locked_until
            END
      WHERE id = ?`,
    [id]
  );
}

/** Clears the failure counter after a successful authentication. */
function clearFailedLogins(id) {
  return db.query(
    "UPDATE students SET failed_logins = 0, locked_until = NULL WHERE id = ?",
    [id]
  );
}

module.exports = {
  findByEmail,
  findById,
  findByRollNo,
  registerFailedLogin,
  clearFailedLogins,
};
