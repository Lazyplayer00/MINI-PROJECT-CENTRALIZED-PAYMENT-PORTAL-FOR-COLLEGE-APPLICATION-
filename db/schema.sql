-- ============================================================================
--  Centralised Payment Portal for College Applications
--  Database schema (MySQL 8.0+)
--
--  Usage:
--     mysql -u root -p < db/schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS college_payment_portal
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE college_payment_portal;

-- Dropped in reverse dependency order so the script is re-runnable.
DROP TABLE IF EXISTS payments;
DROP TABLE IF EXISTS fees;
DROP TABLE IF EXISTS students;
DROP TABLE IF EXISTS colleges;

-- ---------------------------------------------------------------------------
-- colleges: the institutions a student can pay. The "centralised" part of the
-- portal -- one student account, many payable institutions.
-- ---------------------------------------------------------------------------
CREATE TABLE colleges (
  id            INT UNSIGNED    NOT NULL AUTO_INCREMENT,
  code          VARCHAR(16)     NOT NULL,
  name          VARCHAR(160)    NOT NULL,
  city          VARCHAR(80)             DEFAULT NULL,
  created_at    TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_colleges_code (code)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- students: portal accounts.
--
-- `password_hash` stores a bcrypt digest -- never a plaintext password. The
-- column is sized at 255 to leave room for a future algorithm change.
-- ---------------------------------------------------------------------------
CREATE TABLE students (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  roll_no        VARCHAR(24)    NOT NULL,
  name           VARCHAR(120)   NOT NULL,
  email          VARCHAR(160)   NOT NULL,
  password_hash  VARCHAR(255)   NOT NULL,
  course         VARCHAR(80)    NOT NULL,
  division       VARCHAR(8)             DEFAULT NULL,
  college_id     INT UNSIGNED   NOT NULL,
  failed_logins  SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until   DATETIME               DEFAULT NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_students_roll_no (roll_no),
  UNIQUE KEY uq_students_email (email),
  KEY idx_students_college (college_id),
  CONSTRAINT fk_students_college
    FOREIGN KEY (college_id) REFERENCES colleges (id)
    ON DELETE RESTRICT
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- fees: one row per student per semester.
--
-- Money is stored as DECIMAL(12,2), never FLOAT -- binary floating point
-- cannot represent currency exactly and would drift over repeated arithmetic.
-- `amount_paid` is maintained by the payment transaction; `balance` is a
-- generated column so the outstanding figure can never disagree with the
-- amounts it is derived from.
-- ---------------------------------------------------------------------------
CREATE TABLE fees (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  student_id     INT UNSIGNED   NOT NULL,
  semester       TINYINT UNSIGNED NOT NULL,
  academic_year  VARCHAR(9)     NOT NULL,
  tuition_amount DECIMAL(12,2)  NOT NULL,
  fine_amount    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  scholarship    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  amount_paid    DECIMAL(12,2)  NOT NULL DEFAULT 0.00,
  due_date       DATE           NOT NULL,
  balance        DECIMAL(12,2)
                 AS (tuition_amount + fine_amount - scholarship - amount_paid)
                 STORED,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP
                                ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_fees_student_semester (student_id, semester, academic_year),
  KEY idx_fees_due_date (due_date),
  CONSTRAINT fk_fees_student
    FOREIGN KEY (student_id) REFERENCES students (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_fees_non_negative
    CHECK (tuition_amount >= 0 AND fine_amount >= 0
           AND scholarship >= 0 AND amount_paid >= 0)
) ENGINE = InnoDB;

-- ---------------------------------------------------------------------------
-- payments: an append-only ledger of attempted and completed transactions.
--
-- Rows are never updated in place except to move `status` forward, so a failed
-- payment stays visible in the student's history. `reference` is the id handed
-- back by the payment gateway and is what appears on the printed receipt.
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id             INT UNSIGNED   NOT NULL AUTO_INCREMENT,
  reference      VARCHAR(32)    NOT NULL,
  fee_id         INT UNSIGNED   NOT NULL,
  student_id     INT UNSIGNED   NOT NULL,
  amount         DECIMAL(12,2)  NOT NULL,
  currency       CHAR(3)        NOT NULL DEFAULT 'INR',
  method         ENUM('card','netbanking','upi') NOT NULL,
  status         ENUM('pending','successful','failed') NOT NULL DEFAULT 'pending',
  gateway        VARCHAR(32)    NOT NULL DEFAULT 'sandbox',
  failure_reason VARCHAR(160)           DEFAULT NULL,
  created_at     TIMESTAMP      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at   DATETIME               DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_payments_reference (reference),
  KEY idx_payments_student (student_id, created_at),
  KEY idx_payments_fee (fee_id),
  CONSTRAINT fk_payments_fee
    FOREIGN KEY (fee_id) REFERENCES fees (id)
    ON DELETE CASCADE,
  CONSTRAINT fk_payments_student
    FOREIGN KEY (student_id) REFERENCES students (id)
    ON DELETE CASCADE,
  CONSTRAINT chk_payments_amount_positive
    CHECK (amount > 0)
) ENGINE = InnoDB;
